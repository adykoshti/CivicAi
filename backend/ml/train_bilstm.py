# Optional: requires tensorflow installed
import os
import pandas as pd
import numpy as np
import tensorflow as tf
from ml.dataset_utils import calculate_aqi

# Paths
IOT_DATA_PATH = os.path.join("data", "iot_data.csv")
HIST_DATA_PATH = os.path.join("data", "ahmedabad_air_quality_model_ready.csv")
ARTIFACT_DIR = "artifacts"

# Must match train_model.py
SEQ_LEN = 10  # Increased to match main.py expectation (though main.py reshapes to 1x10... wait main.py reshapes to 1x10x6? No, let's check main.py)
# main.py: lstm_input = np.repeat(features, 10, axis=0).reshape(1, 10, len(feature_cols))
# So main.py expects (1, 10, 6) input shape.
# So SEQ_LEN must be 10.

FEATURE_COLS = ["PM10", "PM2.5", "NO2", "SO2", "NH3", "O3"]
TARGET_COL = "AQI"

def build_sequences(df):
    sequences, targets = [], []
    # Just treat as one continuous stream for now since we are focusing on oversampled IoT data
    # or simple historical chunks.
    
    # Ensure numeric
    for col in FEATURE_COLS + [TARGET_COL]:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])
    vals = df[FEATURE_COLS + [TARGET_COL]].values
    
    if len(vals) < SEQ_LEN: 
        return np.array([]), np.array([])
        
    for i in range(len(vals) - SEQ_LEN + 1):
        w = vals[i:i+SEQ_LEN]
        sequences.append(w[:, :-1]) # Features
        targets.append(w[-1, -1])   # Target (AQI) of the last step? 
        # Usually LSTM predicts next step, or current step based on sequence.
        # main.py passes `np.repeat(features, 10)` which means it passes [current, current, ..., current]
        # and expects a prediction for 'current'.
        # So we should train it such that a sequence of identical (or near identical) states maps to the target.
        # However, normally BiLSTM is for time series.
        # To align with how main.py calls it (repeating the single frame 10 times),
        # we should probably train it on sequences where the target is indeed the AQI of the sequence.
        
    return np.array(sequences), np.array(targets)

def main():
    print("\n========== CivicAI BiLSTM Trainer (Custom Emphasis: IoT + 2023) ==========\n")
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    
    dfs = []
    
    # ---------------------------------------------------------
    # 1. IoT Data (High Importance - Oversampled)
    # ---------------------------------------------------------
    if os.path.exists(IOT_DATA_PATH):
        try:
            iot_df = pd.read_csv(IOT_DATA_PATH)
            print(f"[INFO] Loaded {len(iot_df)} rows from iot_data.csv")
            
            # Standardize columns
            for col in FEATURE_COLS:
                if col not in iot_df.columns:
                    iot_df[col] = 0.0 
            
            iot_df = iot_df[FEATURE_COLS + [TARGET_COL]]
            
            # OVERSAMPLING
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
            
            # Rename columns
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
            
            # Filter 2023
            hist_df["Date"] = pd.to_datetime(hist_df["Date"], errors='coerce')
            hist_2023 = hist_df[hist_df["Date"].dt.year == 2023].copy()
            print(f"[INFO] Filtered {len(hist_2023)} rows from year 2023")
            
            if not hist_2023.empty:
                hist_2023["NH3"] = 45.0 
                hist_2023[TARGET_COL] = hist_2023.apply(
                    lambda row: calculate_aqi(
                        row.get("PM2.5"), row.get("PM10"), row.get("NO2"), 
                        row.get("SO2"), row.get("CO"), row.get("O3"), row.get("NH3")
                    ), axis=1
                )
                hist_2023 = hist_2023[FEATURE_COLS + [TARGET_COL]]
                dfs.append(hist_2023)
        except Exception as e:
            print(f"[WARN] Failed to load historical data: {e}")

    if not dfs:
        raise ValueError("No data available for BiLSTM training.")

    df = pd.concat(dfs, ignore_index=True)
    df = df.dropna()
    print(f"[INFO] Final BiLSTM training set size: {len(df)} rows")

    X, y = build_sequences(df)
    if X.size == 0:
        raise ValueError("Not enough sequence data for BiLSTM.")

    print(f"[INFO] Built sequences: X={X.shape}, y={y.shape}")

    num_features = X.shape[2]
    
    # Model Architecture
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQ_LEN, num_features)),
        tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64, return_sequences=False)),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(1)
    ])
    
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    
    print("[INFO] Training BiLSTM...")
    model.fit(X, y, epochs=15, batch_size=32, validation_split=0.1, verbose=1)
    
    model.save(os.path.join(ARTIFACT_DIR, "bilstm_model.h5"))
    print("[INFO] BiLSTM saved to artifacts/bilstm_model.h5")

if __name__ == "__main__":
    main()
