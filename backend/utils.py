def calculate_personal_risk(aqi: float, profile: str):
    profile = profile.lower()
    if aqi <= 50:
        level = "low"
    elif aqi <= 100:
        level = "moderate"
    elif aqi <= 200:
        level = "high"
    else:
        level = "very_high"

    sensitive = ["asthma","copd","heart","child","elderly","pregnant"]
    if profile in sensitive and aqi > 100:
        if level == "moderate":
            level = "high"
        elif level == "high":
            level = "very_high"

    advice_map = {
        "low": "Safe for outdoor activity.",
        "moderate": "Sensitive groups should limit long exposure.",
        "high": "Avoid long outdoor activity, consider a mask.",
        "very_high": "Stay indoors if possible, use N95 mask.",
    }
    return level, advice_map[level]

def recommend_actions(aqi: float, main_source: str, area_type: str, region_name: str):
    main_source = main_source.lower()
    actions = []
    if aqi > 200:
        if main_source == "traffic":
            actions += [f"Restrict heavy vehicles in {region_name}.", "Increase public transport."]
        elif main_source == "industry":
            actions += [f"Conduct emission checks near {region_name}.", "Increase inspections."]
        elif main_source == "construction":
            actions += [f"Mandate water sprinkling in {region_name}.", "Cover loose materials."]
        else:
            actions += [f"Combine traffic & dust control in {region_name}.", "Issue public advisory."]
    else:
        actions.append("AQI under control. Continue monitoring.")
    severity = "severe" if aqi>200 else "moderate" if aqi>100 else "normal"
    return severity, actions
