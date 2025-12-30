import os
import pandas as pd
import joblib
import shap
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error

# ==========================================
# Paths
# ==========================================
DATA_PATH = os.path.join("data", "air_quality_india.csv")
ARTIFACT_DIR = "artifacts"

# Feature columns (MUST match city_day.csv exactly)
FEATURE_COLS = ["PM2.5", "PM10", "NO2", "CO", "SO2", "O3"]

TARGET_COL = "AQI"


def main():
    print("\n========== CivicAI Model Trainer ==========\n")

    # 1. Make sure artifacts folder exists
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    # 2. Check dataset exists
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(
            f"[ERROR] Dataset not found at {DATA_PATH}. "
            f"Place 'city_day.csv' renamed as 'air_quality_india.csv' inside backend/data/"
        )

    # 3. Load dataset
    print("[INFO] Loading dataset...")
    df = pd.read_csv(DATA_PATH)

    # Ensure required columns exist
    missing = [c for c in FEATURE_COLS + [TARGET_COL] if c not in df.columns]
    if missing:
        raise ValueError(f"[ERROR] Missing required columns in dataset: {missing}")

    # 4. Clean dataset
    print("[INFO] Cleaning dataset...")
    df = df[FEATURE_COLS + [TARGET_COL]].dropna()

    if df.empty:
        raise ValueError(
            "[ERROR] Dataset became empty after dropping missing rows. "
            "Please use a cleaner version of city_day.csv"
        )

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    # 5. Train-test split
    print("[INFO] Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
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

    # 9. SHAP explainer
    print("[INFO] Generating SHAP explainer (first time takes 10–25 sec)...")
    explainer = shap.TreeExplainer(model)
    joblib.dump(explainer, os.path.join(ARTIFACT_DIR, "shap_explainer.pkl"))

    print("\n========== TRAINING COMPLETE ==========\n")
    print("Artifacts saved in backend/artifacts/:")
    print(" - aqi_model.pkl")
    print(" - feature_cols.pkl")
    print(" - shap_explainer.pkl\n")


if __name__ == "__main__":
    main()
