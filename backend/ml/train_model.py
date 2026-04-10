import os
import pandas as pd
import numpy as np
import joblib
import shap
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from ml.dataset_utils import calculate_aqi

# ==========================================
# Paths
# ==========================================
IOT_DATA_PATH = os.path.join("data", "iot_data.csv")
HIST_DATA_PATH = os.path.join("data", "ahmedabad_air_quality_model_ready.csv")
ARTIFACT_DIR = "artifacts"

# Feature columns (MUST match dataset_utils.py exactly)
FEATURE_COLS = ["PM10", "PM2.5", "NO2", "SO2", "NH3", "O3"]
TARGET_COL = "AQI"


def train(extra_data=None, override_df=None):
    print("\n========== CivicAI Model Trainer (Custom Emphasis: IoT + 2023) ==========\n")

    # 1. Make sure artifacts folder exists
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(BASE_DIR, "data")

    if override_df is not None:
        print("[INFO] Using provided DataFrame for training...")
        df = override_df
    else:
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
                iot_df = iot_df[FEATURE_COLS + [TARGET_COL]]
                
                # OVERSAMPLING STRATEGY
                # We want IoT data to dictate the "fine-tuning" of the model.
                # Replicate it to be statistically significant (e.g., ~2000 rows).
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
                        
                    df = df[FEATURE_COLS + [TARGET_COL]]
                    
                    if not df.empty:
                        dfs.append(df)
                        print(f"[INFO] Added {len(df)} rows from {filename}")
                        
                except Exception as e:
                    print(f"[WARN] Failed to process {filename}: {e}")

        if not dfs:
            raise ValueError("No valid data available for training! Check file paths.")

        # Combine datasets
        df = pd.concat(dfs, ignore_index=True)

    # 4. Clean dataset
    print("[INFO] Cleaning dataset...")
    df = df.dropna()
    
    # Ensure numeric
    for col in FEATURE_COLS:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors='coerce')
    
    df = df.dropna()

    if df.empty:
        raise ValueError("[ERROR] Dataset empty after cleaning.")

    print(f"[INFO] Final training set size: {len(df)} rows")

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    # 5. Train-test split
    # Use smaller test set (10%) to maximize training data for this specific requirement
    print("[INFO] Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.1, random_state=42
    )

    # 6. Train Random Forest model
    print("[INFO] Training RandomForest model (300 trees)...")
    model = RandomForestRegressor(
        n_estimators=300,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # 7. Evaluate model
    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    
    # Calculate RMSE
    from sklearn.metrics import mean_squared_error
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    
    # Determine Max Error (Range of target)
    max_error = y.max() - y.min()

    print(f"[RESULT] R² Score: {r2:.4f}")
    print(f"[RESULT] MAE: {mae:.4f}")
    print(f"[RESULT] RMSE: {rmse:.4f}")
    
    # Save Metrics for Reliability Index
    import json
    metrics = {
        "AQI_Model": {
            "R2": r2,
            "MAE": mae,
            "RMSE": rmse,
            "MAX_ERROR": max_error
        }
    }
    metrics_path = os.path.join(ARTIFACT_DIR, "aqi_model_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=4)
    print(f"[INFO] AQI Model metrics saved to {metrics_path}")

    # 8. Save model
    print("[INFO] Saving model artifacts...")
    joblib.dump(model, os.path.join(ARTIFACT_DIR, "aqi_model.pkl"))
    joblib.dump(FEATURE_COLS, os.path.join(ARTIFACT_DIR, "feature_cols.pkl"))

    # 9. Train SHAP explainer
    print("[INFO] Training SHAP explainer...")
    try:
        # Use a background sample for SHAP to speed it up and handle large data
        background_summary = shap.kmeans(X_train, 50) 
        explainer = shap.KernelExplainer(model.predict, background_summary)
        # Note: KernelExplainer is slower but generic. TreeExplainer is faster for RF.
        # Let's stick to TreeExplainer as it's standard for RF
        explainer = shap.TreeExplainer(model)
        
        joblib.dump(explainer, os.path.join(ARTIFACT_DIR, "shap_explainer.pkl"))
        print("[INFO] SHAP explainer saved.")
    except Exception as e:
        print(f"[WARN] SHAP explanation failed: {e}")

    print("\n[SUCCESS] Training complete.")

if __name__ == "__main__":
    train()
