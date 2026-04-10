import shap
import numpy as np

class GrapExplainer:
    _explainer = None
    _model_ref = None

    @classmethod
    def _get_explainer(cls, model):
        if cls._explainer is None or cls._model_ref != model:
            # TreeExplainer is suitable for Random Forest
            # check_additivity=False prevents errors on some data distributions
            cls._explainer = shap.TreeExplainer(model)
            cls._model_ref = model
        return cls._explainer

    @staticmethod
    def get_explanation(model, input_df, predicted_class):
        """
        Computes SHAP values and returns a dominant factor, explanation text, and actionable insight.
        """
        try:
            explainer = GrapExplainer._get_explainer(model)
            
            # shap_values returns a list of arrays (one per class) for classifiers
            shap_values = explainer.shap_values(input_df, check_additivity=False)
            
            # Identify class index
            class_idx = -1
            if hasattr(model, "classes_"):
                for i, c in enumerate(model.classes_):
                    if str(c) == str(predicted_class):
                        class_idx = i
                        break
            
            if class_idx == -1:
                # Fallback: try casting
                try:
                    class_idx = int(predicted_class)
                except:
                    return None, None, None

            # Get values for the specific class
            if isinstance(shap_values, list):
                # Ensure index is within bounds
                if class_idx < len(shap_values):
                    vals = shap_values[class_idx]
                else:
                    # Fallback to last class if index out of bounds (unlikely)
                    vals = shap_values[-1]
            else:
                # Check dimensions
                if len(shap_values.shape) == 3:
                    # (samples, features, classes)
                    # We want (samples, features) for the specific class
                    if class_idx < shap_values.shape[2]:
                         vals = shap_values[:, :, class_idx]
                    else:
                         vals = shap_values[:, :, -1]
                else:
                    # (samples, features) - Binary or Regressor
                    vals = shap_values

            # Handle batch dimension (input_df is 1 row, vals might be (1, n_features))
            if len(vals.shape) > 1:
                vals = vals[0]

            # Find dominant feature (max absolute SHAP value)
            max_idx = np.argmax(np.abs(vals))
            feature_names = input_df.columns.tolist()
            if max_idx < len(feature_names):
                dominant_feature = feature_names[max_idx]
            else:
                dominant_feature = feature_names[0] # Fallback
            
            # Generate text
            explanation = GrapExplainer._generate_text(dominant_feature, predicted_class)
            insight = GrapExplainer.get_actionable_insight(dominant_feature, predicted_class)
            
            return dominant_feature, explanation, insight

        except Exception as e:
            # Log error but do not fail the request
            print(f"[SHAP Error] {e}")
            return None, None, None

    @staticmethod
    def get_actionable_insight(feature, stage):
        """
        Returns specific, feasible government actions (10-day window) 
        based on the dominant feature and severity stage.
        Returns a list of action strings.
        """
        try:
            s_int = int(stage)
        except:
            s_int = 0

        # Base actions for low severity
        if s_int <= 1:
            return ["Monitor sensors; no immediate restrictive action required."]

        actions = []
        
        if feature == "PM10":
            actions.append("Deploy Mechanized Sweepers: Immediate deployment on identified arterial roads.")
            if s_int >= 3:
                actions.append("Pause Excavation: Temporary 48-72h ban on digging activities.")
        
        elif feature == "PM2.5":
            actions.append("Anti-Smog Guns: Target hotspots with water mist.")
            actions.append("Waste Inspection: Drone/patrol teams to stop open biomass burning.")
            if s_int >= 3:
                actions.append("Ban use of diesel generators except for essential services.")
        
        elif feature == "NO2":
            actions.append("Signal Optimization: Adjust traffic light timing to reduce idling at key junctions.")
            if s_int >= 2:
                actions.append("Heavy Vehicle Ban: Restrict trucks during peak hours (8-11 AM, 5-8 PM).")
        
        elif feature == "SO2":
            actions.append("Fuel Mandate: Enforce temporary switch to cleaner fuels (e.g., gas instead of coal) for 10 days.")
            actions.append("Scrubber Audit: Immediate inspection of industrial emission control devices.")
        
        elif feature == "CO":
            actions.append("Check for biomass burning events in peri-urban areas.")
            actions.append("Regulate traffic flow in high-density corridors.")

        elif feature == "Wind Speed":
            actions.append("Water Sprinkling: Increase frequency to settle suspended particles that cannot disperse naturally.")
        
        elif feature == "Temperature":
            actions.append("Issue heat/cold wave specific health advisories alongside pollution warnings.")
        
        else:
            actions.append("Increase monitoring frequency.")

        return actions if actions else ["Review local pollution control plan."]

    @staticmethod
    def _generate_text(feature, stage):
        # Feature descriptions
        f_map = {
            "PM2.5": "fine particulate matter (PM2.5)",
            "PM10": "coarse particulate matter (PM10)",
            "NO2": "nitrogen dioxide levels",
            "SO2": "sulfur dioxide emissions",
            "CO": "carbon monoxide levels",
            "Temperature": "temperature conditions",
            "Wind Speed": "wind dispersion patterns"
        }
        
        f_desc = f_map.get(feature, feature)
        
        # Stage interpretation
        try:
            s_int = int(stage)
        except:
            s_int = 0
            
        if s_int == 0:
            return f"Conditions remain normal largely due to favorable {f_desc}."
        
        # High severity explanations
        if feature in ["PM2.5", "PM10"]:
            if s_int >= 3:
                return f"Strict dust control measures expected due to critical {f_desc}."
            return f"Health advisory likely due to rising {f_desc}."
            
        if feature in ["NO2", "CO"]:
            if s_int >= 2:
                return f"Traffic restrictions expected mainly due to high {f_desc}."
            return f"Pollution alerts driven by elevated {f_desc}."
            
        if feature == "SO2":
            return f"Industrial restrictions likely due to {f_desc}."
            
        if feature == "Wind Speed":
            return f"Poor air quality persistence likely due to low {f_desc}."
            
        if feature == "Temperature":
            return f"Pollution accumulation likely exacerbated by {f_desc}."

        return f"Action triggered primarily by {f_desc}."
