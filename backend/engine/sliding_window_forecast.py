import os
import joblib
import pandas as pd
import numpy as np
from datetime import timedelta

# Configuration
WINDOW_SIZE = 7
FEATURE_COLS = ["PM10", "PM2.5", "NO2", "SO2", "NH3", "O3", "CO"]
ARTIFACT_DIR = "artifacts"
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IOT_DATA_PATH = os.path.join(BASE_DIR, "data", "iot_data.csv")

class PollutantForecaster:
    _models = {}
    
    @classmethod
    def load_models(cls):
        if cls._models:
            return

        print("[INFO] Loading Pollutant Forecast Models...")
        for col in FEATURE_COLS:
            model_path = os.path.join(BASE_DIR, ARTIFACT_DIR, f"pollutant_{col}_model.pkl")
            if os.path.exists(model_path):
                cls._models[col] = joblib.load(model_path)
            else:
                print(f"[WARN] Model for {col} not found at {model_path}")

    @classmethod
    def get_recent_data(cls):
        """Loads the most recent data from iot_data.csv"""
        if not os.path.exists(IOT_DATA_PATH):
            return pd.DataFrame()
            
        try:
            df = pd.read_csv(IOT_DATA_PATH)
            
            # Standardize columns
            for col in FEATURE_COLS:
                if col not in df.columns:
                    df[col] = 0.0
                else:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Handle Date/Timestamp
            if "Timestamp" in df.columns:
                df["Date"] = pd.to_datetime(df["Timestamp"])
            elif "Date" in df.columns:
                df["Date"] = pd.to_datetime(df["Date"])
            else:
                # If no date, create dummy dates ending now
                end_date = pd.Timestamp.now()
                dates = [end_date - timedelta(days=i) for i in range(len(df))]
                df["Date"] = dates[::-1]

            df = df.sort_values("Date")
            return df
        except Exception as e:
            print(f"[ERROR] Failed to load recent data: {e}")
            return pd.DataFrame()

    @classmethod
    def predict_next_10_days(cls):
        """
        Performs sliding window forecasting for the next 10 days.
        Returns a list of dictionaries with date and predicted values.
        """
        cls.load_models()
        if not cls._models:
            return {"error": "Models not loaded"}

        df = cls.get_recent_data()
        if len(df) < WINDOW_SIZE:
            return {"error": f"Not enough data. Need {WINDOW_SIZE} rows, got {len(df)}"}

        # Prepare initial window
        # Take the last N rows of feature columns
        last_window_df = df.iloc[-WINDOW_SIZE:][FEATURE_COLS].copy()
        
        # Fill missing values if any
        last_window_df = last_window_df.ffill().fillna(0.0)
        
        current_window = last_window_df.values # Shape: (WINDOW_SIZE, n_features)
        
        last_date = df["Date"].iloc[-1]
        if pd.isna(last_date):
            last_date = pd.Timestamp.now()
            
        predictions = []
        
        for i in range(1, 11): # 10 days
            # Flatten window for model input
            # Shape: (1, WINDOW_SIZE * n_features)
            input_vector = current_window.flatten().reshape(1, -1)
            
            next_day_pred = {}
            next_date = last_date + timedelta(days=i)
            next_day_pred["Date"] = next_date.strftime("%Y-%m-%d")
            
            row_values = []
            
            for col in FEATURE_COLS:
                if col in cls._models:
                    model = cls._models[col]
                    val = model.predict(input_vector)[0]
                    # Clamp negative values
                    val = max(0.0, val)
                    next_day_pred[f"Predicted {col}"] = round(val, 2)
                    row_values.append(val)
                else:
                    next_day_pred[f"Predicted {col}"] = 0.0
                    row_values.append(0.0)
            
            predictions.append(next_day_pred)
            
            # Update Window
            # Remove first row (oldest), append new predicted row
            new_row = np.array(row_values).reshape(1, -1)
            current_window = np.vstack([current_window[1:], new_row])
            
        return predictions

if __name__ == "__main__":
    # Test
    preds = PollutantForecaster.predict_next_10_days()
    import json
    print(json.dumps(preds, indent=2))
