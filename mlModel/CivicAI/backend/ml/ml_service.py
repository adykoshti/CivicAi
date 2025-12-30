import os
from typing import Dict, Tuple
import joblib
import numpy as np

ARTIFACT_DIR = "artifacts"
rf_model_path = os.path.join(ARTIFACT_DIR, "aqi_model.pkl")
feature_cols_path = os.path.join(ARTIFACT_DIR, "feature_cols.pkl")
explainer_path = os.path.join(ARTIFACT_DIR, "shap_explainer.pkl")
bilstm_path_h5 = os.path.join(ARTIFACT_DIR, "bilstm_model.h5")
# if you used .keras format change path accordingly

if not (os.path.exists(rf_model_path) and os.path.exists(feature_cols_path) and os.path.exists(explainer_path)):
    raise FileNotFoundError("Missing RandomForest artifacts. Run train_model.py first.")

rf_model = joblib.load(rf_model_path)
feature_cols = joblib.load(feature_cols_path)
explainer = joblib.load(explainer_path)

# lazy bilstm: do not import tensorflow at module import time
_bilstm_model = None
_bilstm_loaded = False

def _lazy_load_bilstm():
    global _bilstm_model, _bilstm_loaded
    if _bilstm_loaded:
        return
    _bilstm_loaded = True
    if not os.path.exists(bilstm_path_h5):
        # no bilstm available
        _bilstm_model = None
        return
    try:
        import tensorflow as tf  # local import
        _bilstm_model = tf.keras.models.load_model(bilstm_path_h5)
        print("[INFO] BiLSTM loaded for hybrid predictions.")
    except Exception as e:
        print("[WARN] Could not load BiLSTM (tensorflow missing or load error):", e)
        _bilstm_model = None

def _rf_predict(features: Dict[str,float]) -> float:
    x = np.array([[features[c] for c in feature_cols]], dtype=float)
    return float(rf_model.predict(x)[0])

def _bilstm_predict(features: Dict[str,float]) -> float:
    _lazy_load_bilstm()
    if _bilstm_model is None:
        return _rf_predict(features)
    vec = np.array([features[c] for c in feature_cols], dtype=float)
    seq = np.tile(vec, (7,1))  # SEQ_LEN=7
    seq = np.expand_dims(seq, axis=0)
    pred = _bilstm_model.predict(seq, verbose=0)[0][0]
    return float(pred)

def hybrid_predict_aqi(features: Dict[str,float]) -> float:
    rf_pred = _rf_predict(features)
    lstm_pred = _bilstm_predict(features)
    return float(0.5*rf_pred + 0.5*lstm_pred)

def explain_prediction(features: Dict[str,float]) -> Tuple[float, Dict[str,float]]:
    x = np.array([[features[c] for c in feature_cols]], dtype=float)
    shap_vals = explainer.shap_values(x)[0]
    contributions = {c: float(v) for c,v in zip(feature_cols, shap_vals)}
    pred = hybrid_predict_aqi(features)
    return pred, contributions
