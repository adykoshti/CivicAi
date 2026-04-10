import uvicorn
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import joblib
import shap
import traceback
from pymongo import MongoClient
from datetime import datetime, timedelta
import asyncio
import os
import random
import json
import hashlib
import urllib.request
import urllib.error
import urllib.parse
from ml.train_model import train  # Import training function
from ml.dataset_utils import load_and_merge_datasets, calculate_aqi
from routers.ml_ahmedabad_grap import router as grap_router
from routers.pollutant_forecast import router as forecast_router

# ---------------------------
# FASTAPI APP INITIALIZATION
# ---------------------------
app = FastAPI(title="CivicAI Backend")
app.include_router(grap_router)
app.include_router(forecast_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # Allow frontend, Hoppscotch, etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IoTConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

iot_ws_manager = IoTConnectionManager()

# ---------------------------
# LOAD MODELS & ARTIFACTS
# ---------------------------
import sys
if sys.version_info[:2] != (3, 10):
    raise RuntimeError(f"Python 3.10 is required. Current version: {sys.version}")

try:
    rf_model = joblib.load("artifacts/aqi_model.pkl")
    feature_cols = joblib.load("artifacts/feature_cols.pkl")
    shap_explainer = joblib.load("artifacts/shap_explainer.pkl")
    print("[OK] RF model + SHAP loaded.")
except Exception as e:
    print("[ERROR] Model loading failed:", e)
    rf_model, feature_cols, shap_explainer = None, None, None

# Load Forecast Models
try:
    aqi_min_model = joblib.load("artifacts/aqi_min_10d_model.pkl")
    aqi_max_model = joblib.load("artifacts/aqi_max_10d_model.pkl")
    print("[OK] Forecast models (Min/Max) loaded.")
except Exception as e:
    print(f"[WARN] Forecast models not found: {e}. Run train_forecast.py")
    aqi_min_model, aqi_max_model = None, None

feature_means = {}
aqi_caps = {"upper": None}
try:
    _df = pd.read_csv("data/air_quality_india.csv")
    if feature_cols:
        for col in feature_cols:
            if col in _df.columns:
                feature_means[col] = _df[col].mean()
            else:
                feature_means[col] = 0.0
    if "AQI" in _df.columns:
        cap = float(_df["AQI"].quantile(0.85))
        if np.isfinite(cap) and cap > 0:
            aqi_caps["upper"] = min(cap, 300.0)
    print(f"[OK] Feature means calculated: {feature_means}")
except Exception as e:
    print(f"[WARN] Could not calculate feature means: {e}")
    feature_means = {c: 0.0 for c in (feature_cols or [])}

# Mandatory BiLSTM
from tensorflow.keras.models import load_model
try:
    bilstm_model = load_model("artifacts/bilstm_model.h5", compile=False)
    print("[OK] BiLSTM loaded.")
except Exception as e:
    print(f"[ERROR] Failed to load BiLSTM model: {e}")
    raise RuntimeError("BiLSTM model is mandatory but failed to load.") from e


# ---------------------------
# MONGODB CONNECTION
# ---------------------------
try:
    mongo_client = MongoClient("mongodb://localhost:27017")
    db = mongo_client["civicaidb"] # User requested CivicAi>civicaidb>iot_readings (Database: civicaidb)
    iot_collection = db["iot_readings"]
    print("[OK] Connected to MongoDB (civicaidb).")
except:
    print("[WARN] MongoDB NOT running. IoT storage disabled.")
    mongo_client = None
    iot_collection = None


import math

# ---------------------------
# UTILITY FUNCTIONS
# ---------------------------
def calculate_reliability_index():
    """
    Calculates the Reliability Index based on model metrics.
    Formula: Index = α * R² + β * (1 − NRMSE) + γ * (1 − NMAE)
    Weights (default): α=0.4, β=0.3, γ=0.3
    
    UPDATED: Statically set to 0.69 as per user request.
    """
    return 0.69
    
    # ORIGINAL LOGIC COMMENTED OUT FOR REFERENCE
    # try:
    #     # Use the specific AQI model metrics
    #     metrics_path = "artifacts/aqi_model_metrics.json"
    #     
    #     # Fallback to general metrics if specific not found
    #     if not os.path.exists(metrics_path):
    #          metrics_path = "artifacts/model_metrics.json"
    #
    #     if not os.path.exists(metrics_path):
    #         return 0.87 # Fallback if no metrics
    #
    #     with open(metrics_path, "r") as f:
    #         metrics = json.load(f)
    #     
    #     if not metrics:
    #         return 0.87
    #
    #     total_reliability = 0
    #     count = 0
    #     
    #     alpha = 0.4
    #     beta = 0.3
    #     gamma = 0.3
    #     
    #     # Iterate over models in the file (e.g., "AQI_Model")
    #     for model_name, data in metrics.items():
    #         r2 = data.get("R2", 0)
    #         mae = data.get("MAE", 0)
    #         rmse = data.get("RMSE", 0)
    #         max_error = data.get("MAX_ERROR", 1) # Avoid div/0
    #         
    #         if max_error == 0: max_error = 1
    #
    #         nrmse = rmse / max_error
    #         nmae = mae / max_error
    #         
    #         # Clamp NRMSE/NMAE to 1 to avoid negative reliability contribution
    #         nrmse = min(nrmse, 1.0)
    #         nmae = min(nmae, 1.0)
    #         
    #         # Reliability for this model
    #         rel = (alpha * r2) + (beta * (1 - nrmse)) + (gamma * (1 - nmae))
    #         rel = max(0.0, min(1.0, rel)) # Clamp between 0 and 1
    #         
    #         total_reliability += rel
    #         count += 1
    #         
    #     if count == 0:
    #         return 0.87
    #         
    #     return round(total_reliability / count, 2)
    #     
    # except Exception as e:
    #     print(f"[WARN] Failed to calculate reliability index: {e}")
    #     return 0.87

def clean_for_json(data):
    """Recursively clean data to ensure it is JSON compliant (handle NaN, Infinity)."""
    if isinstance(data, dict):
        return {k: clean_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_for_json(v) for v in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    elif isinstance(data, (np.float32, np.float64)):
        if np.isnan(data) or np.isinf(data):
            return None
        return float(data)
    elif isinstance(data, (np.int32, np.int64)):
        return int(data)
    return data


def load_dataset():
    return pd.read_csv("data/air_quality_india.csv")


def _get_farthest_daily_forecast(series):
    if not series:
        return None
    items = []
    for item in series:
        day_str = item.get("day")
        if not day_str:
            continue
        try:
            day = datetime.strptime(day_str, "%Y-%m-%d").date()
        except Exception:
            continue
        items.append((day, item))
    if not items:
        return None
    items.sort(key=lambda x: x[0])
    return items[-1][1]


def get_waqi_10d_aqi_range():
    url = "https://api.waqi.info/feed/@8192/?token=4cee6bbd2f43daab8272a3d76ac253978ea7dcce"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    daily = (data.get("data") or {}).get("forecast", {}).get("daily", {})
    pm25_series = daily.get("pm25", [])
    pm10_series = daily.get("pm10", [])
    pm25_day = _get_farthest_daily_forecast(pm25_series)
    pm10_day = _get_farthest_daily_forecast(pm10_series)
    if not pm25_day and not pm10_day:
        return None
    pm25_min = pm25_day.get("min") if pm25_day else None
    pm25_max = pm25_day.get("max") if pm25_day else None
    pm10_min = pm10_day.get("min") if pm10_day else None
    pm10_max = pm10_day.get("max") if pm10_day else None
    min_aqi = calculate_aqi(pm25_min, pm10_min, None, None, None, None, None)
    max_aqi = calculate_aqi(pm25_max, pm10_max, None, None, None, None, None)
    if pd.isna(min_aqi) or pd.isna(max_aqi):
        return None
    return float(min_aqi), float(max_aqi)


def aqi_to_severity(aqi):
    if aqi <= 50: return "good"
    elif aqi <= 100: return "satisfactory"
    elif aqi <= 200: return "moderate"
    elif aqi <= 300: return "poor"
    elif aqi <= 400: return "very poor"
    return "severe"


def ensemble_prediction(rf_pred, lstm_pred):
    if lstm_pred is None:
        return rf_pred
    return (0.6 * rf_pred) + (0.4 * lstm_pred)

def apply_forecast_cap(forecast):
    upper = aqi_caps.get("upper")
    if upper is None:
        return forecast
    min_val = forecast.get("min")
    max_val = forecast.get("max")
    if min_val is None or max_val is None:
        return forecast
    if min_val > upper and max_val > upper:
        delta = max_val - upper
        capped_max = upper
        capped_min = max(0.0, min_val - delta)
    else:
        capped_min = min(min_val, upper)
        capped_max = min(max_val, upper)
    if capped_min > capped_max:
        capped_min, capped_max = capped_max, capped_min
    return {"min": round(capped_min, 1), "max": round(capped_max, 1)}

def adjust_forecast_relative(forecast, current_aqi):
    try:
        current = float(current_aqi)
    except:
        return forecast
    min_val = forecast.get("min")
    max_val = forecast.get("max")
    if min_val is None or max_val is None or current <= 0:
        return forecast
    far = (
        min_val < current * 0.7
        or max_val > current * 1.6
        or (max_val - min_val) > current * 0.9
    )
    if not far:
        return forecast
    target_min = current * 0.8
    target_max = current * 1.4
    if target_min > target_max:
        target_min, target_max = target_max, target_min
    return {"min": round(target_min, 1), "max": round(target_max, 1)}

def aqi_to_concentration(aqi, pollutant):
    ranges = {
        "pm25": [
            ((0, 50), (0.0, 12.0)),
            ((51, 100), (12.1, 35.4)),
            ((101, 150), (35.5, 55.4)),
            ((151, 200), (55.5, 150.4)),
            ((201, 300), (150.5, 250.4)),
        ],
        "pm10": [
            ((0, 50), (0.0, 54.0)),
            ((51, 100), (55.0, 154.0)),
            ((101, 150), (155.0, 254.0)),
            ((151, 200), (255.0, 354.0)),
            ((201, 300), (355.0, 424.0)),
        ],
        "no2": [
            ((0, 50), (0.0, 53.0)),
            ((51, 100), (54.0, 100.0)),
            ((101, 150), (101.0, 360.0)),
            ((151, 200), (361.0, 649.0)),
            ((201, 300), (650.0, 1249.0)),
        ],
        "o3": [
            ((0, 50), (0.0, 54.0)),
            ((51, 100), (55.0, 70.0)),
            ((101, 150), (71.0, 85.0)),
            ((151, 200), (86.0, 105.0)),
            ((201, 300), (106.0, 200.0)),
        ],
    }
    try:
        aqi = float(aqi)
    except:
        return None
    key = pollutant.lower()
    if key not in ranges:
        return aqi
    for (a_low, a_high), (c_low, c_high) in ranges[key]:
        if a_low <= aqi <= a_high:
            return ((aqi - a_low) / (a_high - a_low)) * (c_high - c_low) + c_low
    return aqi


# ---------------------------
# BACKGROUND RETRAINING
# ---------------------------
async def periodic_retraining():
    while True:
        await asyncio.sleep(600)  # 10 minutes = 600 seconds
        print("\n[AUTO-RETRAIN] Starting scheduled retraining...")
        try:
            # Load and merge data from 3 CSVs
            base_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(base_dir, "data")
            
            # Run in thread to avoid blocking
            merged_df = await asyncio.to_thread(load_and_merge_datasets, data_dir)
            
            if not merged_df.empty:
                print(f"[AUTO-RETRAIN] Training on {len(merged_df)} records.")
                global rf_model, shap_explainer, feature_cols
                
                # Run training in a thread
                loop = asyncio.get_event_loop()
                # train(extra_data=None, override_df=merged_df)
                model, r2, mae = await loop.run_in_executor(None, train, None, merged_df)
                
                # Update global model references
                rf_model = model
                # feature_cols remains same
                # Reload explainer
                shap_explainer = joblib.load("artifacts/shap_explainer.pkl")
                
                print(f"[AUTO-RETRAIN] Success! R2: {r2:.4f}, MAE: {mae:.4f}")
            else:
                print("[AUTO-RETRAIN] No data found. Skipping.")
                
        except Exception as e:
            print(f"[AUTO-RETRAIN] Error: {e}")
            print(traceback.format_exc())

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(periodic_retraining())


import random

# ---------------------------
# 0️⃣ ROOT ENDPOINT
# ---------------------------
@app.get("/")
def root():
    return {
        "message": "CivicAI Backend Running",
        "timestamp": str(datetime.now())
    }


# -----------------------------------------
# 1️⃣ ALWAYS PREDICT AQI FOR AHMEDABAD
# -----------------------------------------
@app.get("/predict-latest-aqi")
def predict_latest_aqi():
    try:
        df = load_dataset()
        city_name = "Ahmedabad"   # DEFAULT CITY
        
        # 1. Try to fetch latest IoT data first
        features_dict = {}
        features = None
        used_source = "static"
        
        # Check IoT CSV
        iot_csv_path = os.path.join("data", "iot_data.csv")
        if os.path.exists(iot_csv_path):
            try:
                iot_df = pd.read_csv(iot_csv_path)
                if not iot_df.empty:
                    # Get latest row
                    latest_iot = iot_df.iloc[-1]
                    
                    # Ensure all features exist
                    valid_iot = True
                    temp_features = {}
                    for col in feature_cols:
                        if col in latest_iot and pd.notna(latest_iot[col]):
                            temp_features[col] = float(latest_iot[col])
                        else:
                            # If key pollutant missing in IoT, fall back to static
                            valid_iot = False
                            break
                    
                    if valid_iot:
                        features_dict = temp_features
                        features = np.array([features_dict[col] for col in feature_cols]).reshape(1, -1)
                        used_source = "iot"
                        print("[INFO] Using IoT data for prediction input.")
            except Exception as e:
                print(f"[WARN] Failed to read IoT data: {e}")

        # 2. Fallback to static/WAQI if IoT failed
        if features is None:
            # Try finding city in static dataset
            city_row = df[df['City'] == city_name]
            
            if not city_row.empty:
                # Use mean of city data as fallback baseline
                features_dict = {col: city_row[col].mean() for col in feature_cols}
                features = np.array([features_dict[col] for col in feature_cols]).reshape(1, -1)
                used_source = "static_city_mean"
            else:
                # Use global means
                features_dict = feature_means
                features = np.array([feature_means[col] for col in feature_cols]).reshape(1, -1)
                used_source = "global_mean"

        # ----------------------------
        # PREDICTION LOGIC
        # ----------------------------
        rf_pred = float(rf_model.predict(features)[0])
        
        # BiLSTM Prediction (Hybrid)
        lstm_pred = None
        if bilstm_model:
            try:
                # Reshape for LSTM: (1, 10, 6)
                # We replicate the single time step 10 times to simulate a constant sequence
                lstm_input = np.repeat(features, 10, axis=0).reshape(1, 10, len(feature_cols))
                lstm_pred = float(bilstm_model.predict(lstm_input, verbose=0)[0][0])
            except Exception as e:
                print(f"[WARN] BiLSTM prediction failed: {e}")

        final_pred = ensemble_prediction(rf_pred, lstm_pred)
        
        # SHAP Explanation
        shap_values = shap_explainer.shap_values(features)[0]
        shap_dict = {col: float(val) for col, val in zip(feature_cols, shap_values)}
        
        forecast = {"min": None, "max": None}
        if aqi_min_model and aqi_max_model:
            try:
                min_val = float(aqi_min_model.predict(features)[0])
                max_val = float(aqi_max_model.predict(features)[0])
                if min_val > max_val:
                    min_val, max_val = max_val, min_val
                forecast = {"min": round(min_val, 1), "max": round(max_val, 1)}
            except Exception as e:
                print(f"[WARN] Forecast failed: {e}")

        waqi_range = get_waqi_10d_aqi_range()
        if waqi_range:
            waqi_min, waqi_max = waqi_range
            out_of_limits = (
                forecast["min"] is None
                or forecast["max"] is None
                or forecast["min"] > 300
                or forecast["max"] > 300
            )
            if out_of_limits:
                forecast = {"min": round(waqi_min, 1), "max": round(waqi_max, 1)}
            else:
                forecast = {
                    "min": round(0.7 * forecast["min"] + 0.3 * waqi_min, 1),
                    "max": round(0.7 * forecast["max"] + 0.3 * waqi_max, 1),
                }
        
        # PRINT REAL PREDICTION (No Cap)
        print(f"\n[DEBUG] Real 10-day AI Prediction (No Cap): {forecast}\n")

        # forecast = apply_forecast_cap(forecast) # Skipped as per user request to prioritize relative gap
        
        actual_aqi = features_dict.get("AQI") if used_source == "iot" else None
        current_aqi = actual_aqi if actual_aqi is not None else final_pred
        
        # User requested gap ~50-60 relative to present AQI
        # We'll use +/- 28 to get a gap of ~56
        lower_bound = max(0, current_aqi - 28)
        upper_bound = current_aqi + 28
        forecast = {"min": round(lower_bound, 1), "max": round(upper_bound, 1)}

        # forecast = adjust_forecast_relative(forecast, current_aqi) # Overridden by above logic

        response_data = {
            "city": city_name,
            "predicted_aqi": final_pred,
            "actual_aqi": features_dict.get("AQI") if used_source == "iot" else None, # Pass actual if available
            "feature_contributions": shap_dict,
            "severity": aqi_to_severity(final_pred),
            "source": used_source,
            "confidence": calculate_reliability_index(),
            "current_pollutants": features_dict,
            "forecast_next_10d": forecast
        }

        return clean_for_json(response_data)

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


def load_iot_csv(limit: int = 20):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    iot_csv_path = os.path.join(base_dir, "data", "iot_data.csv")
    iot_csv_path = os.path.abspath(iot_csv_path)

    results = []

    if not os.path.exists(iot_csv_path):
        print(f"[WARN] IoT CSV not found at: {iot_csv_path}")
        return []

    with open(iot_csv_path, 'r') as f:
        lines = f.readlines()

    if len(lines) <= 1:
        return []

    header = lines[0].strip().split(',')

    def parse_float(value):
        if value is None:
            return None
        value = str(value).strip()
        if value == "":
            return None
        try:
            return float(value)
        except ValueError:
            return None

    for line in reversed(lines[1:]):
        if not line.strip():
            continue

        parts = line.strip().split(',')
        if not header:
            continue
        row = dict(zip(header, parts[:len(header)]))

        aqi_val = parse_float(row.get('AQI'))
        pm25 = parse_float(row.get('PM2.5'))
        pm10 = parse_float(row.get('PM10'))
        no2 = parse_float(row.get('NO2'))
        o3 = parse_float(row.get('O3'))
        co = parse_float(row.get('CO'))
        so2 = parse_float(row.get('SO2'))
        nh3 = parse_float(row.get('NH3'))
        temp = parse_float(row.get('Temperature'))
        humidity = parse_float(row.get('Humidity'))
        gas_raw = parse_float(row.get('GasRaw'))
        city_val = row.get('Location') or row.get('City') or 'Ahmedabad'
        time_str = row.get('Timestamp') or row.get('Time') or ''
        device_id = row.get('DeviceId') or 'Unknown'

        features = {}
        if pm25 is not None:
            features["PM2.5"] = pm25
        if pm10 is not None:
            features["PM10"] = pm10
        if no2 is not None:
            features["NO2"] = no2
        if o3 is not None:
            features["O3"] = o3
        if co is not None:
            features["CO"] = co
        if so2 is not None:
            features["SO2"] = so2

        raw_values = {}
        if pm25 is not None:
            raw_values["pm25"] = pm25
        if pm10 is not None:
            raw_values["pm10"] = pm10
        if no2 is not None:
            raw_values["no2"] = no2
        if so2 is not None:
            raw_values["so2"] = so2
        if o3 is not None:
            raw_values["o3"] = o3
        if co is not None:
            raw_values["co"] = co
        if nh3 is not None:
            raw_values["nh3"] = nh3
        if temp is not None:
            raw_values["temp"] = temp
        if humidity is not None:
            raw_values["humidity"] = humidity
        if gas_raw is not None:
            raw_values["gasRaw"] = gas_raw

        doc = {
            "_id": str(random.randint(100000, 999999)),
            "device_id": device_id,
            "city": city_val,
            "AQI": aqi_val if aqi_val is not None else 0,
            "features": features,
            "raw_values": raw_values,
            "timestamp": time_str
        }
        results.append(doc)

        if len(results) >= limit:
            break

    return clean_for_json(results)

@app.get("/iot-data")
def get_iot_data():
    try:
        return load_iot_csv()
    except Exception as e:
        print(f"[ERROR] GET /iot-data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/iot")
async def iot_websocket(websocket: WebSocket):
    await iot_ws_manager.connect(websocket)
    try:
        await websocket.send_json({"type": "init", "data": load_iot_csv()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        iot_ws_manager.disconnect(websocket)



# -----------------------------------------
# 2️⃣ CITY-BASED AQI PREDICTION
# -----------------------------------------
@app.get("/city-data")
def city_data(city: str):
    try:
        # Optimization: Only predict for Ahmedabad
        if city.lower() != "ahmedabad":
            return clean_for_json({
                "city": city,
                "predicted_aqi": None, # Will be displayed as "?"
                "feature_contributions": {},
                "severity": "Unknown",
                "source": "none",
                "confidence": 0
            })

        # Check IoT/MongoDB first for recent live data
        use_live_data = False
        features_dict = {}
        actual_aqi = None
        
        if iot_collection is not None:
            # Find latest entry for this city
            latest_iot = iot_collection.find_one(
                {"city": {"$regex": f"^{city}$", "$options": "i"}},
                sort=[("timestamp", -1)]
            )
            
            # Use if found and fresh (e.g., last 1 hour) - ignoring time check for demo
            if latest_iot:
                print(f"[CITY-DATA] Found live IoT data for {city}")
                use_live_data = True
                features_dict = latest_iot.get("features", {})
                actual_aqi = latest_iot.get("AQI") # This is actually predicted from IoT but serves as 'current'
                
                # Ensure all feature cols are present
                for col in feature_cols:
                    if col not in features_dict:
                         features_dict[col] = feature_means.get(col, 0.0)
                def clamp(v, lo, hi):
                    try:
                        return max(lo, min(hi, float(v)))
                    except:
                        return lo
                if "PM2.5" in features_dict:
                    features_dict["PM2.5"] = clamp(features_dict["PM2.5"], 0.0, 250.4)
                if "PM10" in features_dict:
                    features_dict["PM10"] = clamp(features_dict["PM10"], 0.0, 424.0)
                if "NO2" in features_dict:
                    features_dict["NO2"] = clamp(features_dict["NO2"], 0.0, 1249.0)
                if "O3" in features_dict:
                    features_dict["O3"] = clamp(features_dict["O3"], 0.0, 200.0)
                if "CO" in features_dict:
                    features_dict["CO"] = clamp(features_dict["CO"], 0.0, 50.0)
                if "SO2" in features_dict:
                    features_dict["SO2"] = clamp(features_dict["SO2"], 0.0, 1000.0)

        if use_live_data:
            features = np.array([[features_dict[c] for c in feature_cols]], dtype=float)
        else:
            # Fallback to CSV
            df = load_dataset()
            df_city = df[df["City"].str.lower() == city.lower()]

            if df_city.empty:
                raise HTTPException(status_code=404, detail="City not found")

            row = df_city.iloc[-1]
            features = row[feature_cols].values.reshape(1, -1)
            features_dict = row[feature_cols].to_dict()
            
            # Get actual AQI
            actual_aqi = row.get("AQI")
            if pd.isna(actual_aqi):
                actual_aqi = None
            else:
                actual_aqi = float(actual_aqi)

        rf_pred = float(rf_model.predict(features)[0])

        if bilstm_model:
            lstm_input = np.repeat(features, 10, axis=0).reshape(1, 10, len(feature_cols))
            lstm_pred = float(bilstm_model.predict(lstm_input)[0][0])
        else:
            lstm_pred = None

        final_pred = ensemble_prediction(rf_pred, lstm_pred)

        shap_values = shap_explainer.shap_values(features)[0]
        shap_dict = {col: float(val) for col, val in zip(feature_cols, shap_values)}

        forecast = {"min": None, "max": None}
        if city.lower() == "ahmedabad" and aqi_min_model and aqi_max_model:
            try:
                min_val = float(aqi_min_model.predict(features)[0])
                max_val = float(aqi_max_model.predict(features)[0])
                if min_val > max_val:
                    min_val, max_val = max_val, min_val
                forecast = {"min": round(min_val, 1), "max": round(max_val, 1)}
            except Exception as e:
                print(f"[WARN] Forecast failed: {e}")

        waqi_range = get_waqi_10d_aqi_range()
        if waqi_range:
            waqi_min, waqi_max = waqi_range
            out_of_limits = (
                forecast["min"] is None
                or forecast["max"] is None
                or forecast["min"] > 300
                or forecast["max"] > 300
            )
            if out_of_limits:
                forecast = {"min": round(waqi_min, 1), "max": round(waqi_max, 1)}
            else:
                forecast = {
                    "min": round(0.7 * forecast["min"] + 0.3 * waqi_min, 1),
                    "max": round(0.7 * forecast["max"] + 0.3 * waqi_max, 1),
                }
        forecast = apply_forecast_cap(forecast)
        current_aqi = actual_aqi if actual_aqi is not None else final_pred
        forecast = adjust_forecast_relative(forecast, current_aqi)

        response_data = {
            "city": city,
            "predicted_aqi": final_pred,
            "feature_contributions": shap_dict,
            "severity": aqi_to_severity(final_pred),
            "source": "live_iot" if use_live_data else "historical_csv",
            "confidence": calculate_reliability_index(),
            "forecast_next_10d": forecast
        }

        return clean_for_json(response_data)

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cities")
def get_cities():
    try:
        df = load_dataset()
        cities = []
        # Get unique cities
        unique_cities = df['City'].unique()
        
        for city in unique_cities:
            # Get latest data for each city
            city_df = df[df['City'] == city]
            if not city_df.empty:
                latest = city_df.iloc[-1]
                aqi = latest.get('AQI')
                
                # Simulated weather data
                temp = random.uniform(25, 35) # Celsius
                humidity = random.uniform(40, 70) # Percent
                wind = random.uniform(5, 15) # km/h
                
                cities.append({
                    "id": city.lower(),
                    "name": city,
                    "state": "India", 
                    "aqi": float(aqi) if pd.notna(aqi) else 0,
                    "lat": 20.5937 + random.uniform(-5, 5), # Jiggle lat/lng slightly for visual spread if map uses it
                    "lng": 78.9629 + random.uniform(-5, 5),
                    "temp": round(temp, 1),
                    "humidity": round(humidity, 1),
                    "wind": round(wind, 1)
                })
        
        return clean_for_json(cities)
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/iot-data")
async def receive_iot_data(request: Request):
    try:
        body = await request.body()
        csv_line = body.decode("utf-8").strip()
        print(f"[IOT] Received: {csv_line}")
        
        parts = csv_line.split(',')
        if len(parts) < 6:
             raise HTTPException(status_code=400, detail="Invalid CSV format.")

        def parse_optional(value):
            value = str(value).strip()
            if value == "":
                return None
            try:
                return float(value)
            except ValueError:
                return None

        try:
            if len(parts) >= 12:
                location = parts[0].strip()
                temp = float(parts[1])
                humidity = float(parts[2])
                pm25 = parse_optional(parts[3])
                pm10 = parse_optional(parts[4])
                no2 = parse_optional(parts[5])
                so2 = parse_optional(parts[6])
                o3 = parse_optional(parts[7])
                co = parse_optional(parts[8])
                nh3 = parse_optional(parts[9])
                gas_raw = float(parts[10])
                time_str = parts[11].strip()
            else:
                location = parts[0].strip()
                temp = float(parts[1])
                humidity = float(parts[2])
                gas_raw = float(parts[3])
                time_str = parts[4].strip()
                nh3 = float(parts[5])
                pm25 = None
                pm10 = None
                no2 = None
                so2 = None
                o3 = None
                co = None
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid number format in CSV.")

        def normalize_location(value: str) -> str:
            if not value:
                return "Ahmedabad"
            try:
                float(value)
                return "Ahmedabad"
            except ValueError:
                return value

        def normalize_timestamp(value: str) -> str:
            if not value:
                return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            try:
                num = float(value)
                if num > 1_000_000_000_000:
                    dt = datetime.fromtimestamp(num / 1000.0)
                    return dt.strftime("%Y-%m-%d %H:%M:%S")
                if num > 1_000_000_000:
                    dt = datetime.fromtimestamp(num)
                    return dt.strftime("%Y-%m-%d %H:%M:%S")
                return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                return value

        location = normalize_location(location)
        timestamp_value = normalize_timestamp(time_str)
        device_id = request.headers.get("X-Device-Id")
        if not device_id:
            device_id_source = f"{location}-{timestamp_value}-{gas_raw}"
            device_id = f"ESP8266-{hashlib.md5(device_id_source.encode('utf-8')).hexdigest()[:8]}"

        waqi_city = "ahmedabad"
        city_query = urllib.parse.quote(waqi_city)
        waqi_url = f"https://api.waqi.info/feed/{city_query}/?token=4cee6bbd2f43daab8272a3d76ac253978ea7dcce"
        waqi_values = {}
        try:
            with urllib.request.urlopen(waqi_url, timeout=10) as resp:
                raw = resp.read().decode("utf-8")
                payload = json.loads(raw)
            if payload.get("status") == "ok":
                data = payload.get("data") or {}
                iaqi = data.get("iaqi") or {}

                def get_iaqi_value(key):
                    v = iaqi.get(key, {}).get("v")
                    if v is None:
                        return None
                    try:
                        return float(v)
                    except ValueError:
                        return None

                aqi_value = data.get("aqi")
                try:
                    aqi_value = float(aqi_value)
                except Exception:
                    aqi_value = None

                waqi_values = {
                    "CO": get_iaqi_value("co"),
                    "NO2": aqi_to_concentration(get_iaqi_value("no2"), "no2"),
                    "PM2.5": aqi_to_concentration(get_iaqi_value("pm25"), "pm25"),
                    "PM10": aqi_to_concentration(get_iaqi_value("pm10"), "pm10"),
                    "SO2": get_iaqi_value("so2"),
                    "O3": aqi_to_concentration(get_iaqi_value("o3"), "o3"),
                    "AQI": aqi_value
                }
        except Exception as e:
            print(f"[IOT] WAQI fetch failed: {e}")

        features = {}
        if pm25 is not None or waqi_values.get("PM2.5") is not None:
            features["PM2.5"] = pm25 if pm25 is not None else waqi_values.get("PM2.5")
        if pm10 is not None or waqi_values.get("PM10") is not None:
            features["PM10"] = pm10 if pm10 is not None else waqi_values.get("PM10")
        if no2 is not None or waqi_values.get("NO2") is not None:
            features["NO2"] = no2 if no2 is not None else waqi_values.get("NO2")
        if o3 is not None or waqi_values.get("O3") is not None:
            features["O3"] = o3 if o3 is not None else waqi_values.get("O3")
        if co is not None or waqi_values.get("CO") is not None:
            features["CO"] = co if co is not None else waqi_values.get("CO")
        if so2 is not None or waqi_values.get("SO2") is not None:
            features["SO2"] = so2 if so2 is not None else waqi_values.get("SO2")

        raw_values = {}
        if temp is not None:
            raw_values["temp"] = temp
        if humidity is not None:
            raw_values["humidity"] = humidity
        if pm25 is not None:
            raw_values["pm25"] = pm25
        if pm10 is not None:
            raw_values["pm10"] = pm10
        if no2 is not None:
            raw_values["no2"] = no2
        if so2 is not None:
            raw_values["so2"] = so2
        if o3 is not None:
            raw_values["o3"] = o3
        if co is not None:
            raw_values["co"] = co
        if nh3 is not None:
            raw_values["nh3"] = nh3
        if gas_raw is not None:
            raw_values["gasRaw"] = gas_raw

        doc = {
            "timestamp": datetime.now(),
            "raw_values": raw_values,
            "features": features,
            "city": location
        }
        
        if iot_collection is not None:
            iot_collection.insert_one(doc)
            print("[IOT] Data saved to MongoDB.")
        
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            iot_csv_path = os.path.join(base_dir, "data", "iot_data.csv")
            iot_csv_path = os.path.abspath(iot_csv_path)
            
            expected_header = [
                "Location",
                "Temperature",
                "Humidity",
                "PM2.5",
                "PM10",
                "NO2",
                "SO2",
                "O3",
                "CO",
                "NH3",
                "GasRaw",
                "Timestamp",
                "AQI",
                "DeviceId"
            ]

            row_values = {
                "Location": location,
                "Temperature": temp,
                "Humidity": humidity,
                "PM2.5": pm25 if pm25 is not None else waqi_values.get("PM2.5"),
                "PM10": pm10 if pm10 is not None else waqi_values.get("PM10"),
                "NO2": no2 if no2 is not None else waqi_values.get("NO2"),
                "SO2": so2 if so2 is not None else waqi_values.get("SO2"),
                "O3": o3 if o3 is not None else waqi_values.get("O3"),
                "CO": co if co is not None else waqi_values.get("CO"),
                "NH3": nh3,
                "GasRaw": gas_raw,
                "Timestamp": timestamp_value,
                "AQI": waqi_values.get("AQI") if waqi_values.get("AQI") is not None else "",
                "DeviceId": device_id
            }

            file_exists = os.path.exists(iot_csv_path)
            needs_header_write = not file_exists
            if file_exists:
                with open(iot_csv_path, "r") as f:
                    first_line = f.readline().strip()
                if first_line:
                    existing_header = first_line.split(",")
                    if existing_header != expected_header:
                        with open(iot_csv_path, "w") as f:
                            f.write(",".join(expected_header) + "\n")
                        needs_header_write = False
                else:
                    needs_header_write = True

            with open(iot_csv_path, "a") as f:
                if needs_header_write:
                    f.write(",".join(expected_header) + "\n")
                line = ",".join([str(row_values.get(col, "")) for col in expected_header]) + "\n"
                f.write(line)
                
            print(f"[IOT] Data saved to CSV at {iot_csv_path}")
        except Exception as e:
            print(f"[IOT] Error saving to CSV: {e}")

        broadcast_payload = {
            "_id": str(random.randint(100000, 999999)),
            "device_id": device_id,
            "city": location,
            "AQI": waqi_values.get("AQI") if waqi_values.get("AQI") is not None else 0,
            "features": features,
            "raw_values": raw_values,
            "timestamp": timestamp_value
        }
        await iot_ws_manager.broadcast({"type": "iot_update", "data": clean_for_json(broadcast_payload)})

        return {"received": csv_line, "aqi": waqi_values.get("AQI"), "waqi": waqi_values}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------
# 4️⃣ PERSONAL RISK
# -----------------------------------------
@app.post("/personal-risk")
def personal_risk(data: dict):
    aqi = data.get("predicted_aqi")
    profile = data.get("profile")

    if aqi is None:
        raise HTTPException(status_code=400, detail="AQI missing")

    risk = "low"
    if profile == "asthma":
        risk = "high" if aqi > 150 else "medium"
    elif profile == "elderly":
        risk = "high" if aqi > 180 else "medium"
    else:
        risk = "medium" if aqi > 150 else "low"

    return {"risk": risk, "severity": aqi_to_severity(aqi)}


# -----------------------------------------
# 5️⃣ GOVERNMENT ACTION RECOMMENDER
# -----------------------------------------
@app.post("/recommend-actions")
def recommend_actions(data: dict):
    aqi = data.get("predicted_aqi")
    source = data.get("main_source")

    if aqi is None:
        raise HTTPException(status_code=400, detail="AQI missing")

    actions = []

    if aqi > 200:
        actions.append("Issue public health advisory")
    if source == "traffic":
        actions.append("Limit vehicle movement in peak hours")
    if source == "industry":
        actions.append("Enforce pollution control checks")

    return {"recommended_actions": actions}

@app.post("/simulate-actions")
def simulate_actions(data: dict):
    """
    Simulates effect of government actions on AQI.
    Input:
        current_aqi: float
        traffic_reduction: 0–100 %
        industry_reduction: 0–100 %
        green_cover_increase: 0–100 %
    """

    current_aqi = data.get("current_aqi", None)
    if current_aqi is None:
        raise HTTPException(400, "current_aqi is required")

    t_red = data.get("traffic_reduction", 0)
    i_red = data.get("industry_reduction", 0)
    g_inc = data.get("green_cover_increase", 0)

    # Weighted impact factors (simple & tunable)
    effect = (
        -0.25 * t_red +        # traffic measures
        -0.20 * i_red +        # industrial control
        -0.15 * g_inc          # greenery / tree plantation
    )

    new_aqi = max(5, current_aqi + effect)

    return {
        "current_aqi": current_aqi,
        "new_aqi": new_aqi,
        "severity": aqi_to_severity(new_aqi),
        "impact_breakdown": {
            "traffic_effect": -0.25 * t_red,
            "industry_effect": -0.20 * i_red,
            "greenery_effect": -0.15 * g_inc
        }
    }

@app.get("/health-alerts")
def health_alerts(aqi: float, profile: str = "general"):
    """
    Returns personalized health alerts based on AQI and user profile.
    Example:
        /health-alerts?aqi=180&profile=asthma
    """

    alerts = []

    # Base AQI warnings
    if aqi >= 300:
        alerts.append("⚠ Dangerous AQI! Avoid all outdoor activity.")
    elif aqi >= 200:
        alerts.append("⚠ Very Poor AQI. Wear N95 mask outdoors.")
    elif aqi >= 150:
        alerts.append("Poor AQI. Sensitive groups should avoid going outside.")
    else:
        alerts.append("Air quality is acceptable but keep monitoring.")

    # Profile-based alerts
    profile = profile.lower()

    if profile == "asthma":
        if aqi >= 120:
            alerts.append("Asthma patients: High risk! Carry inhaler and avoid dust.")
    elif profile == "elderly":
        if aqi >= 120:
            alerts.append("Elderly: Avoid long outdoor exposure.")
    elif profile == "children":
        if aqi >= 100:
            alerts.append("Children: Limit outdoor play.")
    elif profile == "athlete":
        if aqi >= 120:
            alerts.append("Athletes: Avoid outdoor training today.")

    return {
        "aqi": aqi,
        "profile": profile,
        "severity": aqi_to_severity(aqi),
        "alerts": alerts
    }

# -----------------------------------------
# RUN SERVER
# -----------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001)
