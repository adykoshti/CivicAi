# Optional: requires tensorflow installed
import os
import pandas as pd
import numpy as np
import tensorflow as tf

DATA_PATH = os.path.join("data", "air_quality_india.csv")
ARTIFACT_DIR = "artifacts"
SEQ_LEN = 7
FEATURE_COLS = ["PM2.5", "PM10", "NO2", "CO", "SO2", "O3"]
TARGET_COL = "AQI"

def build_sequences(df):
    sequences, targets = [], []
    if "City" in df.columns:
        df = df.sort_values(["City","Date"])
        groups = df.groupby("City")
    else:
        df = df.sort_values("Date") if "Date" in df.columns else df
        groups = [(None, df)]
    for _, g in groups:
        g = g.dropna(subset=FEATURE_COLS + [TARGET_COL])
        vals = g[FEATURE_COLS + [TARGET_COL]].values
        if len(vals) < SEQ_LEN: continue
        for i in range(len(vals) - SEQ_LEN + 1):
            w = vals[i:i+SEQ_LEN]
            sequences.append(w[:, :-1])
            targets.append(w[-1, -1])
    return np.array(sequences), np.array(targets)

def main():
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError("Dataset not found: " + DATA_PATH)
    df = pd.read_csv(DATA_PATH)
    missing = [c for c in FEATURE_COLS + [TARGET_COL] if c not in df.columns]
    if missing:
        raise ValueError("Missing columns: " + str(missing))
    X, y = build_sequences(df)
    if X.size == 0:
        raise ValueError("Not enough sequence data for BiLSTM.")
    num_features = X.shape[2]
    model = tf.keras.Sequential([
        tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64), input_shape=(SEQ_LEN,num_features)),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(1)
    ])
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    model.fit(X, y, epochs=10, batch_size=32, validation_split=0.2, verbose=1)
    model.save(os.path.join(ARTIFACT_DIR, "bilstm_model.h5"))
    print("[INFO] BiLSTM saved to artifacts/bilstm_model.h5")

if __name__ == "__main__":
    main()
