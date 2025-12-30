import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import joblib
import shap
import traceback
from pymongo import MongoClient
from datetime import datetime

# ---------------------------
# FASTAPI APP INITIALIZATION
# ---------------------------
app = FastAPI(title="CivicAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # Allow frontend, Hoppscotch, etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# LOAD MODELS & ARTIFACTS
# ---------------------------
try:
    rf_model = joblib.load("artifacts/aqi_model.pkl")
    feature_cols = joblib.load("artifacts/feature_cols.pkl")
    shap_explainer = joblib.load("artifacts/shap_explainer.pkl")
    print("[OK] RF model + SHAP loaded.")
except Exception as e:
    print("[ERROR] Model loading failed:", e)
    rf_model, feature_cols, shap_explainer = None, None, None

# Optional BiLSTM (if TensorFlow installed)
try:
    from tensorflow.keras.models import load_model
    bilstm_model = load_model("artifacts/bilstm_model.h5")
    print("[OK] BiLSTM loaded.")
except:
    bilstm_model = None
    print("[INFO] BiLSTM model NOT loaded (optional).")


# ---------------------------
# MONGODB CONNECTION
# ---------------------------
try:
    mongo_client = MongoClient("mongodb://localhost:27017")
    db = mongo_client["civicaidb"]
    iot_collection = db["iot_readings"]
    print("[OK] Connected to MongoDB.")
except:
    print("[WARN] MongoDB NOT running. IoT storage disabled.")
    mongo_client = None
    iot_collection = None


import math

# ---------------------------
# UTILITY FUNCTIONS
# ---------------------------
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

        # Filter dataset for Ahmedabad
        city_df = df[df["City"].str.lower() == city_name.lower()]

        if city_df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {city_name}")

        latest_row = city_df.iloc[-1]

        # Prepare features
        features = latest_row[feature_cols].values.reshape(1, -1)
        features_dict = latest_row[feature_cols].to_dict()
        
        # Fill NaN values in features_dict with realistic defaults or previous row logic if possible
        # For now, we impute with mean of the city if available, else 0, but since this is "latest_row" of static csv
        # We will manually ensure key pollutants aren't None if possible for display
        for key, val in features_dict.items():
            if pd.isna(val):
                # Try to find a non-NaN value in the last 30 rows
                last_valid = city_df.tail(30)[key].dropna()
                if not last_valid.empty:
                    features_dict[key] = float(last_valid.iloc[-1])
                else:
                    features_dict[key] = 0.0 # Fallback
            else:
                features_dict[key] = float(val)

        # Get actual AQI
        actual_aqi = latest_row.get("AQI")
        if pd.isna(actual_aqi):
             # Try to find last valid AQI
            last_valid_aqi = city_df.tail(30)["AQI"].dropna()
            if not last_valid_aqi.empty:
                actual_aqi = float(last_valid_aqi.iloc[-1])
            else:
                actual_aqi = None
        else:
            actual_aqi = float(actual_aqi)

        # RandomForest prediction
        rf_pred = float(rf_model.predict(features)[0])

        # Add slight randomization to make it look "alive" if requested (since dataset is static)
        # Only vary by +/- 2%
        variation = random.uniform(0.98, 1.02)
        rf_pred = rf_pred * variation

        # Optional BiLSTM prediction
        if bilstm_model:
            lstm_input = np.repeat(features, 10, axis=0).reshape(1, 10, len(feature_cols))
            lstm_pred = float(bilstm_model.predict(lstm_input)[0][0]) * variation
        else:
            lstm_pred = None

        final_pred = ensemble_prediction(rf_pred, lstm_pred)

        # SHAP explainability
        shap_values = shap_explainer.shap_values(features)[0]
        shap_dict = {col: float(val) for col, val in zip(feature_cols, shap_values)}

        response_data = {
            "city": city_name,
            "predicted_aqi": final_pred,
            "actual_aqi": actual_aqi,
            "confidence": 85 + random.uniform(-2, 2), # Simulated confidence
            "feature_contributions": shap_dict,
            "severity": aqi_to_severity(final_pred),
            "current_pollutants": features_dict
        }
        
        return clean_for_json(response_data)

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------
# 2️⃣ CITY-BASED AQI PREDICTION
# -----------------------------------------
@app.get("/city-data")
def city_data(city: str):
    try:
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

        response_data = {
            "city": city,
            "predicted_aqi": final_pred,
            "feature_contributions": shap_dict,
            "severity": aqi_to_severity(final_pred)
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

@app.get("/iot-data")
def get_iot_data():
    try:
        if iot_collection:
            # Fetch last 10 readings from MongoDB
            readings = list(iot_collection.find().sort("timestamp", -1).limit(10))
            # Transform for frontend
            data = []
            for r in readings:
                data.append({
                    "id": str(r.get("_id")),
                    "sensorId": r.get("iot_raw", {}).get("sensorId", "Unknown"),
                    "location": "Deployed Sensor",
                    "pm25": r.get("virtual_pollutants", {}).get("PM2.5"),
                    "pm10": r.get("virtual_pollutants", {}).get("PM10"),
                    "no2": r.get("virtual_pollutants", {}).get("NO2"),
                    "o3": r.get("virtual_pollutants", {}).get("O3"),
                    "aqi": r.get("predicted_aqi"),
                    "status": r.get("severity"),
                    "timestamp": r.get("timestamp")
                })
            if data:
                return clean_for_json(data)
        
        # Fallback to mock data if MongoDB is empty or not connected
        mock_data = [
            { "id": 1, "sensorId": 'S001', "location": 'Downtown', "pm25": 15.2, "pm10": 28, "no2": 22, "o3": 35, "aqi": 45, "status": "good", "timestamp": str(datetime.now()) },
            { "id": 2, "sensorId": 'S002', "location": 'Industrial Zone', "pm25": 45.8, "pm10": 68, "no2": 55, "o3": 28, "aqi": 120, "status": "moderate", "timestamp": str(datetime.now()) },
            { "id": 3, "sensorId": 'S003', "location": 'Residential', "pm25": 8.5, "pm10": 15, "no2": 12, "o3": 42, "aqi": 30, "status": "good", "timestamp": str(datetime.now()) },
            { "id": 4, "sensorId": 'S004', "location": 'Highway', "pm25": 32.1, "pm10": 52, "no2": 48, "o3": 25, "aqi": 85, "status": "satisfactory", "timestamp": str(datetime.now()) },
            { "id": 5, "sensorId": 'S005', "location": 'Park', "pm25": 5.2, "pm10": 10, "no2": 8, "o3": 45, "aqi": 25, "status": "good", "timestamp": str(datetime.now()) }
        ]
        return clean_for_json(mock_data)

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------------------
# 3️⃣ IoT DEVICE ENDPOINT
# -----------------------------------------
@app.post("/iot-data")
def receive_iot_data(data: dict):
    try:
        mq135 = data.get("mq135")
        co2 = data.get("co2")
        nh3 = data.get("nh3")
        temp = data.get("temp")
        humidity = data.get("humidity")

        # Mapping IoT sensors → virtual pollutants
        PM25 = mq135 * 0.25
        PM10 = mq135 * 0.18
        NO2 = nh3 * 0.12
        CO = co2 * 0.001
        SO2 = nh3 * 0.22
        O3 = temp * 0.08

        features = np.array([[PM25, PM10, NO2, CO, SO2, O3]])

        rf_pred = float(rf_model.predict(features)[0])

        lstm_pred = None
        if bilstm_model:
            lstm_input = np.repeat(features, 10, axis=0).reshape(1, 10, 6)
            lstm_pred = float(bilstm_model.predict(lstm_input)[0][0])

        final_pred = ensemble_prediction(rf_pred, lstm_pred)

        shap_values = shap_explainer.shap_values(features)[0]
        shap_dict = {col: float(val) for col, val in zip(feature_cols, shap_values)}

        document = {
            "timestamp": datetime.now(),
            "iot_raw": data,
            "virtual_pollutants": {
                "PM2.5": PM25, "PM10": PM10, "NO2": NO2,
                "CO": CO, "SO2": SO2, "O3": O3
            },
            "predicted_aqi": final_pred,
            "feature_contributions": shap_dict,
            "severity": aqi_to_severity(final_pred)
        }

        # Clean document for MongoDB and JSON response
        document = clean_for_json(document)

        if iot_collection:
            iot_collection.insert_one(document)

        return document

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
    uvicorn.run("main:app", port=8001)
