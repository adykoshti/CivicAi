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
HIST_DATA_PATH = os.path.join(BASE_DIR, "data", "air_quality_india.csv")
IOT_DATA_PATH = os.path.join(BASE_DIR, "data", "iot_data.csv")
ARTIFACT_DIR = os.path.join(BASE_DIR, "artifacts")
MODEL_MIN_PATH = os.path.join(ARTIFACT_DIR, "aqi_min_10d_model.pkl")
MODEL_MAX_PATH = os.path.join(ARTIFACT_DIR, "aqi_max_10d_model.pkl")

# Feature columns (Same as main model)
FEATURE_COLS = ["PM10", "PM2.5", "NO2", "SO2", "NH3", "O3"]
TARGET_COL = "AQI"

def load_data():
    dfs = []
    data_dir = os.path.join(BASE_DIR, "data")
    
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
            
            for col in FEATURE_COLS:
                if col not in iot_df.columns:
                    iot_df[col] = 0.0
                else:
                    iot_df[col] = pd.to_numeric(iot_df[col], errors="coerce")

            if TARGET_COL not in iot_df.columns:
                iot_df[TARGET_COL] = np.nan
            else:
                iot_df[TARGET_COL] = pd.to_numeric(iot_df[TARGET_COL], errors="coerce")

            for col in FEATURE_COLS:
                if iot_df[col].isna().all():
                    iot_df[col] = 0.0
                else:
                    iot_df[col] = iot_df[col].fillna(iot_df[col].median())

            missing_iot_aqi = iot_df[TARGET_COL].isna()
            if missing_iot_aqi.any():
                iot_df.loc[missing_iot_aqi, TARGET_COL] = iot_df.loc[missing_iot_aqi].apply(
                    lambda row: calculate_aqi(
                        row.get("PM2.5"), row.get("PM10"), row.get("NO2"),
                        row.get("SO2"), row.get("CO"), row.get("O3"), row.get("NH3")
                    ), axis=1
                )

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
    # 2. Load ALL other CSVs in data directory
    # ---------------------------------------------------------
    if os.path.exists(data_dir):
        for filename in os.listdir(data_dir):
            if not filename.endswith(".csv"):
                continue
            
            # Skip IoT data as it's already handled
            if filename == "iot_data.csv":
                continue
                
            file_path = os.path.join(data_dir, filename)
            print(f"[INFO] Processing {filename}...")
            
            try:
                df = pd.read_csv(file_path)
                
                # Column Mapping (Handle verbose names)
                mapping = {
                    "PM2.5 (ug/m3)": "PM2.5",
                    "PM10 (ug/m3)": "PM10",
                    "NO2 (ug/m3)": "NO2",
                    "SO2 (ug/m3)": "SO2",
                    "CO (mg/m3)": "CO",
                    "Ozone (ug/m3)": "O3",
                    "From Date": "Timestamp",
                    "Date": "Timestamp"
                }
                df = df.rename(columns=mapping)
                
                # Ensure Timestamp exists
                if "Timestamp" not in df.columns:
                    print(f"[WARN] Skipping {filename}: No 'Timestamp' or 'Date' column found.")
                    continue
                
                df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce")
                df = df.dropna(subset=["Timestamp"])
                
                # Filter for Ahmedabad if City column exists
                if "City" in df.columns:
                    df = df[df["City"].str.lower() == "ahmedabad"]
                    print(f"[INFO] Filtered {len(df)} rows for Ahmedabad from {filename}")
                
                if df.empty:
                    print(f"[INFO] No valid rows in {filename} after filtering.")
                    continue
                
                # Standardize Features
                for col in FEATURE_COLS:
                    if col not in df.columns:
                        df[col] = 0.0
                    else:
                        df[col] = pd.to_numeric(df[col], errors="coerce")
                
                if "NH3" not in df.columns:
                    df["NH3"] = 45.0
                    
                if TARGET_COL not in df.columns:
                    df[TARGET_COL] = np.nan
                else:
                    df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors="coerce")
                    
                # Fill missing
                for col in FEATURE_COLS:
                    if df[col].isna().all():
                        df[col] = 0.0
                    else:
                        df[col] = df[col].fillna(df[col].median())
                        
                # Calculate AQI if missing
                missing_aqi = df[TARGET_COL].isna()
                if missing_aqi.any():
                    df.loc[missing_aqi, TARGET_COL] = df.loc[missing_aqi].apply(
                        lambda row: calculate_aqi(
                            row.get("PM2.5"), row.get("PM10"), row.get("NO2"),
                            row.get("SO2"), row.get("CO"), row.get("O3"), row.get("NH3")
                        ), axis=1
                    )
                    
                df = df[FEATURE_COLS + [TARGET_COL, "Timestamp"]]
                df = df.sort_values("Timestamp")
                
                if not df.empty:
                    dfs.append(df)
                    print(f"[INFO] Added {len(df)} rows from {filename}")
                    
            except Exception as e:
                print(f"[WARN] Failed to process {filename}: {e}")

    if not dfs:
        raise ValueError("No data loaded!")

    # Combine
    final_df = pd.concat(dfs, ignore_index=True)
    
    # Drop rows where AQI could not be calculated
    final_df = final_df.dropna(subset=[TARGET_COL] + FEATURE_COLS)
    
    return final_df

def create_forecast_targets(df, horizon_days=10):
    df = df.copy()
    df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce")
    df = df.dropna(subset=["Timestamp"])
    df["Date"] = df["Timestamp"].dt.date

    daily_features = df.groupby("Date")[FEATURE_COLS].mean()
    daily_ranges = df.groupby("Date")[TARGET_COL].agg(["min", "max"])
    daily = daily_features.join(daily_ranges)

    daily["Target_Min_10d"] = daily["min"].shift(-horizon_days)
    daily["Target_Max_10d"] = daily["max"].shift(-horizon_days)
    daily = daily.dropna(subset=["Target_Min_10d", "Target_Max_10d"])

    return daily.reset_index(drop=True)

def train():
    print("[INFO] Loading data...")
    df = load_data()
    
    print(f"[INFO] Loaded {len(df)} rows. Creating forecast targets...")
    df = create_forecast_targets(df, horizon_days=10)
    print(f"[INFO] {len(df)} rows after creating targets (dropped last 10 days).")

    X = df[FEATURE_COLS]
    y_min = df["Target_Min_10d"]
    y_max = df["Target_Max_10d"]
    
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
