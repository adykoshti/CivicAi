import os
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from ml.dataset_utils import calculate_aqi

# ==========================================
# Configuration
# ==========================================
WINDOW_SIZE = 7  # N days
PREDICTION_HORIZON = 1  # Predict next step (then slide)
FEATURE_COLS = ["PM10", "PM2.5", "NO2", "SO2", "NH3", "O3", "CO"]
ARTIFACT_DIR = "artifacts"

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IOT_DATA_PATH = os.path.join(BASE_DIR, "data", "iot_data.csv")
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_and_preprocess_data():
    """
    Loads all available CSV data and preprocesses it for training.
    Returns a single concatenated DataFrame with standardized columns.
    """
    dfs = []
    
    # 1. IoT Data (High Importance)
    if os.path.exists(IOT_DATA_PATH):
        try:
            iot_df = pd.read_csv(IOT_DATA_PATH)
            print(f"[INFO] Loaded {len(iot_df)} rows from iot_data.csv")
            
            # Standardize
            for col in FEATURE_COLS:
                if col not in iot_df.columns:
                    iot_df[col] = 0.0
                else:
                    iot_df[col] = pd.to_numeric(iot_df[col], errors="coerce")
            
            # Fill missing
            iot_df = iot_df.ffill().fillna(0.0)
            
            # Ensure Timestamp/Date for sorting (optional but good for order)
            if "Timestamp" in iot_df.columns:
                 iot_df["Date"] = pd.to_datetime(iot_df["Timestamp"])
            elif "Date" in iot_df.columns:
                 iot_df["Date"] = pd.to_datetime(iot_df["Date"])
            
            # Select columns
            cols = [c for c in FEATURE_COLS if c in iot_df.columns]
            iot_df = iot_df[cols]
            
            # Oversample IoT data
            if not iot_df.empty:
                replication = max(1, 2000 // len(iot_df))
                iot_df = pd.concat([iot_df] * replication, ignore_index=True)
                dfs.append(iot_df)
                
        except Exception as e:
            print(f"[WARN] Failed to load IoT data: {e}")

    # 2. Historical Data
    if os.path.exists(DATA_DIR):
        for filename in os.listdir(DATA_DIR):
            if not filename.endswith(".csv") or filename == "iot_data.csv":
                continue
            
            try:
                file_path = os.path.join(DATA_DIR, filename)
                df = pd.read_csv(file_path)
                
                # Mapping
                mapping = {
                    "PM2.5 (ug/m3)": "PM2.5", "PM10 (ug/m3)": "PM10",
                    "NO2 (ug/m3)": "NO2", "SO2 (ug/m3)": "SO2",
                    "CO (mg/m3)": "CO", "Ozone (ug/m3)": "O3",
                    "From Date": "Date", "Timestamp": "Date"
                }
                df = df.rename(columns=mapping)
                
                # Filter cols
                valid_cols = [c for c in FEATURE_COLS if c in df.columns]
                if not valid_cols:
                    continue
                    
                df = df[valid_cols]
                
                # Clean
                df = df.apply(pd.to_numeric, errors='coerce')
                df = df.dropna()
                
                dfs.append(df)
            except Exception as e:
                print(f"[WARN] Error reading {filename}: {e}")

    if not dfs:
        return pd.DataFrame()
        
    full_df = pd.concat(dfs, ignore_index=True)
    
    # Ensure all features exist and fill missing values from concat
    for col in FEATURE_COLS:
        if col not in full_df.columns:
            full_df[col] = 0.0
            
    full_df = full_df.fillna(0.0) # Fill any NaNs introduced by concat alignment

    # CLIP VALUES TO PREVENT EXTREME OUTLIERS (User Request: Max ~600)
    # This prevents the model from learning/predicting unrealistically high values
    print("[INFO] Clipping values to max 600.0 to prevent exploding predictions...")
    full_df[FEATURE_COLS] = full_df[FEATURE_COLS].clip(upper=600.0)
            
    return full_df[FEATURE_COLS]

def create_sliding_windows(data, window_size):
    """
    Creates X (flattened windows) and y (next step targets) for all features.
    X shape: (n_samples, window_size * n_features)
    y shape: (n_samples, n_features)
    """
    X, y = [], []
    data_values = data.values
    
    if len(data_values) <= window_size:
        return np.array([]), np.array([])
        
    for i in range(len(data_values) - window_size):
        window = data_values[i : i + window_size]
        target = data_values[i + window_size]
        
        # Flatten window
        X.append(window.flatten())
        y.append(target)
        
    return np.array(X), np.array(y)

import json
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def train_models():
    print("\n========== Training Pollutant Forecast Models ==========\n")
    os.makedirs(os.path.join(BASE_DIR, ARTIFACT_DIR), exist_ok=True)
    
    # 1. Load Data
    df = load_and_preprocess_data()
    if df.empty:
        print("[ERROR] No data found.")
        return

    print(f"[INFO] Total training samples: {len(df)}")

    # 2. Create Windows
    print(f"[INFO] Creating sliding windows (Size={WINDOW_SIZE})...")
    X, y = create_sliding_windows(df, WINDOW_SIZE)
    
    if len(X) == 0:
        print("[ERROR] Not enough data to create windows.")
        return
        
    print(f"[INFO] X shape: {X.shape}, y shape: {y.shape}")

    # Split for metric calculation (Last 20% as test)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train_full, y_test_full = y[:split_idx], y[split_idx:]

    model_metrics = {}

    # 3. Train a model for EACH pollutant
    # We use the SAME input X (all history) to predict EACH target y_col
    
    for i, col in enumerate(FEATURE_COLS):
        print(f"\n[Training] Model for {col}...")
        y_train = y_train_full[:, i]
        y_test = y_test_full[:, i]
        
        model = RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1)
        model.fit(X_train, y_train)
        
        # Calculate Metrics on Test Set
        if len(X_test) > 0:
            preds = model.predict(X_test)
            mae = mean_absolute_error(y_test, preds)
            rmse = np.sqrt(mean_squared_error(y_test, preds))
            r2 = r2_score(y_test, preds)
            max_val = np.max(y_test)
            min_val = np.min(y_test)
            max_error = max_val - min_val if max_val != min_val else 1.0 # Avoid div/0
            
            # Save metrics
            model_metrics[col] = {
                "R2": r2,
                "MAE": mae,
                "RMSE": rmse,
                "MAX_ERROR": max_error
            }
            print(f"  Metrics -> R2: {r2:.3f}, MAE: {mae:.3f}, RMSE: {rmse:.3f}")

        # Retrain on FULL data for final model (optional, but better for deployment)
        # model.fit(X, y[:, i]) # Uncomment if we want to use all data for final model
        
        # Save
        save_path = os.path.join(BASE_DIR, ARTIFACT_DIR, f"pollutant_{col}_model.pkl")
        joblib.dump(model, save_path)
        print(f"[OK] Saved model to {save_path}")

    # Save metrics to JSON
    metrics_path = os.path.join(BASE_DIR, ARTIFACT_DIR, "model_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(model_metrics, f, indent=4)
    print(f"[OK] Saved model metrics to {metrics_path}")

if __name__ == "__main__":
    train_models()
