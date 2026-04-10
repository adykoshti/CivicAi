import joblib
import json
import sys
import os
import pandas as pd
import numpy as np
try:
    from engine.grap_explanation import GrapExplainer
except ImportError:
    # Fallback for local execution
    from grap_explanation import GrapExplainer

# Load model and maps
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "grap_model.pkl")
MAPS_PATH = os.path.join(BASE_DIR, "utils", "label_maps.json")

model = None
label_maps = None

def load_resources():
    global model, label_maps
    if model is None:
        try:
            if os.path.exists(MODEL_PATH):
                model = joblib.load(MODEL_PATH)
            else:
                print(f"Model file not found at {MODEL_PATH}", file=sys.stderr)
        except Exception as e:
            print(f"Error loading model: {e}", file=sys.stderr)
    
    if label_maps is None:
        try:
            if os.path.exists(MAPS_PATH):
                with open(MAPS_PATH, "r") as f:
                    label_maps = json.load(f)
            else:
                print(f"Maps file not found at {MAPS_PATH}", file=sys.stderr)
        except Exception as e:
            print(f"Error loading maps: {e}", file=sys.stderr)

def predict_grap(input_data):
    """
    Predict GRAP stage, severity, and actions.
    input_data: dict with keys "PM2.5", "PM10", "NO2", "SO2", "CO", "Temperature", "Wind Speed"
    """
    load_resources()
    
    if model is None:
        return {"error": "Model not loaded"}
    if label_maps is None:
        return {"error": "Label maps not loaded"}

    # Ensure order matches training
    features = ["PM2.5", "PM10", "NO2", "SO2", "CO", "Temperature", "Wind Speed"]
    
    try:
        # Validate input keys
        missing = [f for f in features if f not in input_data]
        if missing:
            return {"error": f"Missing features: {missing}"}

        # Create DataFrame to match feature names (handles ordering automatically if dict provided)
        # However, list construction ensures specific order
        feature_values = [input_data[f] for f in features]
        input_df = pd.DataFrame([feature_values], columns=features)
        
        # Predict
        predicted_stage = model.predict(input_df)[0]
        predicted_stage_str = str(predicted_stage)
        
        # SHAP Explanation
        dom_factor, shap_expl, actionable_insight = GrapExplainer.get_explanation(model, input_df, predicted_stage)
        
        # Get standard actions
        standard_actions = label_maps["actions"].get(predicted_stage_str, [])
        
        # Prioritize SHAP-based actionable insight if available
        if actionable_insight:
            # Prepend the specific insights to recommendations
            priority_actions = []
            if isinstance(actionable_insight, list):
                priority_actions = [f"[Priority] {action}" for action in actionable_insight]
            else:
                priority_actions = [f"[Priority] {actionable_insight}"]
            
            final_actions = priority_actions + standard_actions
        else:
            final_actions = standard_actions

        # Map results
        result = {
            "predicted_stage": label_maps["stage"].get(predicted_stage_str, "Unknown"),
            "predicted_action": label_maps["stage"].get(predicted_stage_str, "Unknown"), # Requested field
            "severity_level": label_maps["severity"].get(predicted_stage_str, "Unknown"),
            "recommended_actions": final_actions,
            "dominant_factor": dom_factor,
            "shap_explanation": shap_expl
        }
        return result
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Stdin mode
    try:
        input_str = sys.stdin.read()
        if not input_str:
            # If no input, maybe just exit or print usage
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
            
        input_data = json.loads(input_str)
        output = predict_grap(input_data)
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
