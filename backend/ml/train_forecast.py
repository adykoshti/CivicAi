import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from ml.dataset_utils import calculate_aqi

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HIST_DATA_PATH = os.path.join(BASE_DIR, "data", "ahmedabad_air_quality_model_ready.csv")
IOT_DATA_PATH = os.path.join(BASE_DIR, "data", "iot_data.csv")
ARTIFACT_DIR = os.path.join(BASE_DIR, "artifacts")
MODEL_MIN_PATH = os.path.join(ARTIFACT_DIR, "aqi_min_model.pkl")
MODEL_MAX_PATH = os.path.join(ARTIFACT_DIR, "aqi_max_model.pkl")

# Feature columns (Same as main model)
FEATURE_COLS = ["PM10", "PM2.5", "NO2", "SO2", "NH3", "O3"]
TARGET_COL = "AQI"

def load_data():
    dfs = []
    
    # ---------------------------------------------------------
    # 1. IoT Data (High Importance - Oversampled)
    # ---------------------------------------------------------
    if os.path.exists(IOT_DATA_PATH):
        try:
            iot_df = pd.read_csv(IOT_DATA_PATH)
            print(f"[INFO] Loaded {len(iot_df)} rows from iot_data.csv")
            
            # Standardize columns (ensure all features exist)
            for col in FEATURE_COLS:
                if col not in iot_df.columns:
                    iot_df[col] = 0.0 
            
            # Filter needed cols
            iot_df = iot_df[FEATURE_COLS + [TARGET_COL, "Timestamp"]]
            iot_df["Timestamp"] = pd.to_datetime(iot_df["Timestamp"])
            iot_df = iot_df.sort_values("Timestamp")
            
            # OVERSAMPLING STRATEGY for Forecast
            # We want the patterns in IoT data to be dominant.
            if not iot_df.empty:
                replication = max(1, 2000 // len(iot_df))
                print(f"[INFO] Oversampling IoT data by factor {replication}...")
                iot_df_oversampled = pd.concat([iot_df] * replication, ignore_index=True)
                dfs.append(iot_df_oversampled)
        except Exception as e:
            print(f"[WARN] Failed to load IoT data: {e}")

    # ---------------------------------------------------------
    # 2. Historical Data (2023 Emphasis)
    # ---------------------------------------------------------
    if os.path.exists(HIST_DATA_PATH):
        try:
            df = pd.read_csv(HIST_DATA_PATH)
            
            # Map columns
            mapping = {
                "PM2.5 (ug/m3)": "PM2.5",
                "PM10 (ug/m3)": "PM10",
                "NO2 (ug/m3)": "NO2",
                "SO2 (ug/m3)": "SO2",
                "CO (mg/m3)": "CO",
                "Ozone (ug/m3)": "O3",
                "From Date": "Timestamp"
            }
            df = df.rename(columns=mapping)
            df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors='coerce')
            
            # Filter for 2023
            df_2023 = df[df["Timestamp"].dt.year == 2023].copy()
            print(f"[INFO] Loaded {len(df_2023)} rows from 2023 historical data")
            
            # Ensure NH3 (fill with 45.0 as default baseline for Ahmedabad based on IoT)
            if "NH3" not in df_2023.columns:
                df_2023["NH3"] = 45.0
                
            # Calculate AQI if needed
            print("[INFO] Calculating AQI for historical data...")
            df_2023[TARGET_COL] = df_2023.apply(
                lambda row: calculate_aqi(
                    row.get("PM2.5"), row.get("PM10"), row.get("NO2"), 
                    row.get("SO2"), row.get("CO"), row.get("O3"), row.get("NH3")
                ), axis=1
            )
            
            # Keep only needed columns
            df_2023 = df_2023[FEATURE_COLS + [TARGET_COL, "Timestamp"]]
            df_2023 = df_2023.sort_values("Timestamp")
            
            dfs.append(df_2023)
        except Exception as e:
            print(f"[WARN] Failed to load historical data: {e}")

    if not dfs:
        raise ValueError("No data loaded!")

    # Combine
    final_df = pd.concat(dfs, ignore_index=True)
    
    # Drop rows where AQI could not be calculated
    final_df = final_df.dropna(subset=[TARGET_COL] + FEATURE_COLS)
    
    return final_df

def create_forecast_targets(df):
    """
    Creates Next24hMin and Next24hMax targets.
    Assumes df is sorted by time.
    """
    # Assuming the file is hourly data.
    # We want to predict the range for the NEXT 24 hours based on CURRENT features.
    # Target at index i:
    # Min(AQI[i+1 : i+25])
    # Max(AQI[i+1 : i+25])
    
    # Rolling window forward
    indexer = pd.api.indexers.FixedForwardWindowIndexer(window_size=24)
    
    # We shift by -1 so the window starts at i+1
    # Actually, FixedForwardWindow includes the current row if we are not careful.
    # df['AQI'].rolling(window=24).min() looks BACK.
    # df['AQI'].rolling(window=indexer).min() looks FORWARD including current.
    
    # Let's shift the AQI column back by 1 first to exclude current time t from the target window [t+1, t+24]
    future_aqi = df[TARGET_COL].shift(-1)
    
    df["Next24_Min"] = future_aqi.rolling(window=24, min_periods=24).min()
    df["Next24_Max"] = future_aqi.rolling(window=24, min_periods=24).max()
    
    return df.dropna(subset=["Next24_Min", "Next24_Max"])

def train():
    print("[INFO] Loading data...")
    df = load_data()
    
    print(f"[INFO] Loaded {len(df)} rows. Creating forecast targets...")
    df = create_forecast_targets(df)
    print(f"[INFO] {len(df)} rows after creating targets (dropped last 24h).")
    
    X = df[FEATURE_COLS]
    y_min = df["Next24_Min"]
    y_max = df["Next24_Max"]
    
    # Train/Test Split
    X_train, X_test, y_min_train, y_min_test, y_max_train, y_max_test = train_test_split(
        X, y_min, y_max, test_size=0.2, random_state=42
    )
    
    print("[INFO] Training Min-AQI Forecast Model...")
    min_model = RandomForestRegressor(n_estimators=100, n_jobs=-1, random_state=42)
    min_model.fit(X_train, y_min_train)
    min_mae = mean_absolute_error(y_min_test, min_model.predict(X_test))
    print(f"[RESULT] Min-AQI Model MAE: {min_mae:.2f}")
    
    print("[INFO] Training Max-AQI Forecast Model...")
    max_model = RandomForestRegressor(n_estimators=100, n_jobs=-1, random_state=42)
    max_model.fit(X_train, y_max_train)
    max_mae = mean_absolute_error(y_max_test, max_model.predict(X_test))
    print(f"[RESULT] Max-AQI Model MAE: {max_mae:.2f}")
    
    # Save artifacts
    if not os.path.exists(ARTIFACT_DIR):
        os.makedirs(ARTIFACT_DIR)
        
    joblib.dump(min_model, MODEL_MIN_PATH)
    joblib.dump(max_model, MODEL_MAX_PATH)
    print(f"[SUCCESS] Models saved to {ARTIFACT_DIR}")

if __name__ == "__main__":
    train()
