# save as backend/sanity_check.py
import os, sys, importlib, traceback
from pathlib import Path

ROOT = Path(__file__).parent
print("Backend root:", ROOT)

# 1) Python packages to test
packages = ["fastapi","pandas","numpy","sklearn","joblib","shap","pymongo"]
optional = ["tensorflow"]

print("\n== Package import tests ==")
for pkg in packages:
    try:
        importlib.import_module(pkg)
        print(f" OK: {pkg}")
    except Exception as e:
        print(f" MISSING / ERROR: {pkg} -> {e.__class__.__name__}: {e}")

print("\n== Optional imports (may be heavy) ==")
for pkg in optional:
    try:
        importlib.import_module(pkg)
        print(f" OK: {pkg}")
    except Exception as e:
        print(f" Optional failed: {pkg} -> {type(e).__name__}: {e}")

# 2) Files & folders check
print("\n== Files & folders ==")
paths = [
    ROOT / "data" / "air_quality_india.csv",
    ROOT / "artifacts",
    ROOT / "ml" / "train_model.py",
    ROOT / "ml" / "train_bilstm.py",
    ROOT / "ml" / "ml_service.py",
    ROOT / "main.py",
]
for p in paths:
    print(f"{p}: {'FOUND' if p.exists() else 'MISSING'}")

# 3) CSV quick check
csv_path = ROOT / "data" / "air_quality_india.csv"
if csv_path.exists():
    import pandas as pd
    try:
        df = pd.read_csv(csv_path, nrows=5)
        print("\n== CSV columns (first 10) ==")
        print(df.columns.tolist()[:10])
        print("rows read:", len(df))
    except Exception as e:
        print("Failed to read CSV:", type(e).__name__, e)
else:
    print("\nCSV not found; skipping CSV checks")

# 4) Try loading artifacts (if exist)
print("\n== Artifacts load check ==")
import joblib
art = ROOT / "artifacts"
rf = art / "aqi_model.pkl"
feat = art / "feature_cols.pkl"
shp = art / "shap_explainer.pkl"
for f in [rf, feat, shp]:
    if f.exists():
        try:
            obj = joblib.load(f)
            print(f"Loaded {f.name} -> type: {type(obj).__name__}")
        except Exception as e:
            print(f"Error loading {f.name}: {type(e).__name__}: {e}")
    else:
        print(f"{f.name} MISSING")

print("\nSanity check complete. If you see any MISSING or ERROR lines, copy them here.")
