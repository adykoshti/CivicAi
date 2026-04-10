import os
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor
from ml.train_pollutant_models import load_and_preprocess_data, create_sliding_windows, FEATURE_COLS, WINDOW_SIZE

def evaluate_models():
    print("Loading data...")
    df = load_and_preprocess_data()
    if df.empty:
        print("No data available.")
        return

    print(f"Data shape: {df.shape}")
    X, y = create_sliding_windows(df, WINDOW_SIZE)
    
    if len(X) == 0:
        print("Not enough data for windows.")
        return

    # Time-based split: Train on first 80%, Test on last 20%
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    print(f"Train set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    metrics = {}
    
    for i, col in enumerate(FEATURE_COLS):
        print(f"\nEvaluating {col}...")
        y_train_col = y_train[:, i]
        y_test_col = y_test[:, i]
        
        model = RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1)
        model.fit(X_train, y_train_col)
        
        preds = model.predict(X_test)
        
        mae = mean_absolute_error(y_test_col, preds)
        mse = mean_squared_error(y_test_col, preds)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_test_col, preds)
        
        metrics[col] = {
            "MAE": mae,
            "RMSE": rmse,
            "R2": r2
        }
        
        print(f"  MAE: {mae:.4f}")
        print(f"  RMSE: {rmse:.4f}")
        print(f"  R2: {r2:.4f}")
        
    return metrics

if __name__ == "__main__":
    evaluate_models()
