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
        # 2. Historical Data (2023 Emphasis)
        # ---------------------------------------------------------
        if os.path.exists(HIST_DATA_PATH):
            try:
                hist_df = pd.read_csv(HIST_DATA_PATH)
                print(f"[INFO] Loaded {len(hist_df)} rows from historical data")
                
                # Rename columns to match FEATURE_COLS
                mapping = {
                    "PM2.5 (ug/m3)": "PM2.5",
                    "PM10 (ug/m3)": "PM10",
                    "NO2 (ug/m3)": "NO2",
                    "SO2 (ug/m3)": "SO2",
                    "CO (mg/m3)": "CO",
                    "Ozone (ug/m3)": "O3",
                    "From Date": "Date"
                }
                hist_df = hist_df.rename(columns=mapping)
                
                # Filter for 2023
                hist_df["Date"] = pd.to_datetime(hist_df["Date"], errors='coerce')
                hist_2023 = hist_df[hist_df["Date"].dt.year == 2023].copy()
                print(f"[INFO] Filtered {len(hist_2023)} rows from year 2023")
                
                if not hist_2023.empty:
                    # Impute NH3 
                    # Use a baseline value derived from IoT data (approx 45.0) 
                    # to align the historical domain with the IoT domain.
                    hist_2023["NH3"] = 45.0 
                    
                    # Calculate AQI (Target)
                    # We must generate the target because the file doesn't have it.
                    print("[INFO] Calculating AQI for 2023 data...")
                    hist_2023[TARGET_COL] = hist_2023.apply(
                        lambda row: calculate_aqi(
                            row.get("PM2.5"), row.get("PM10"), row.get("NO2"), 
                            row.get("SO2"), row.get("CO"), row.get("O3"), row.get("NH3")
                        ), axis=1
                    )
                    
                    # Select cols
                    hist_2023 = hist_2023[FEATURE_COLS + [TARGET_COL]]
                    dfs.append(hist_2023)
                    
            except Exception as e:
                print(f"[WARN] Failed to load historical data: {e}")

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

    print(f"[RESULT] R² Score: {r2:.4f}")
    print(f"[RESULT] MAE: {mae:.4f}")

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
