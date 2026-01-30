import pandas as pd
import numpy as np
import os

# Feature columns (MUST match train_model.py)
FEATURE_COLS = ["PM10", "PM2.5", "NO2", "SO2", "NH3", "O3"]
TARGET_COL = "AQI"

def calculate_aqi(pm25, pm10, no2, so2, co, o3, nh3=None):
    """
    Simplified AQI calculation based on Indian CPCB standards (approximate).
    Uses max sub-index approach.
    """
    def get_sub_index(conc, breakpoints):
        for (low, high, i_low, i_high) in breakpoints:
            if low <= conc <= high:
                return i_low + (i_high - i_low) * (conc - low) / (high - low)
        return 0

    # Breakpoints (conc_low, conc_high, index_low, index_high)
    # PM2.5 (24h)
    pm25_bp = [(0, 30, 0, 50), (31, 60, 51, 100), (61, 90, 101, 200), (91, 120, 201, 300), (121, 250, 301, 400), (251, 1000, 401, 500)]
    # PM10 (24h)
    pm10_bp = [(0, 50, 0, 50), (51, 100, 51, 100), (101, 250, 101, 200), (251, 350, 201, 300), (351, 430, 301, 400), (431, 1000, 401, 500)]
    # NO2 (24h)
    no2_bp = [(0, 40, 0, 50), (41, 80, 51, 100), (81, 180, 101, 200), (181, 280, 201, 300), (281, 400, 301, 400), (401, 1000, 401, 500)]
    # SO2 (24h)
    so2_bp = [(0, 40, 0, 50), (41, 80, 51, 100), (81, 380, 101, 200), (381, 800, 201, 300), (801, 1600, 301, 400), (1601, 3000, 401, 500)]
    # CO (8h) - input usually mg/m3
    co_bp = [(0, 1, 0, 50), (1.1, 2, 51, 100), (2.1, 10, 101, 200), (10.1, 17, 201, 300), (17.1, 34, 301, 400), (34.1, 50, 401, 500)]
    # O3 (8h)
    o3_bp = [(0, 50, 0, 50), (51, 100, 51, 100), (101, 168, 101, 200), (169, 208, 201, 300), (209, 748, 301, 400), (749, 1000, 401, 500)]
    # NH3 (24h)
    nh3_bp = [(0, 200, 0, 50), (201, 400, 51, 100), (401, 800, 101, 200), (801, 1200, 201, 300), (1201, 1800, 301, 400), (1801, 3000, 401, 500)]

    indices = []
    if pd.notna(pm25): indices.append(get_sub_index(pm25, pm25_bp))
    if pd.notna(pm10): indices.append(get_sub_index(pm10, pm10_bp))
    if pd.notna(no2): indices.append(get_sub_index(no2, no2_bp))
    if pd.notna(so2): indices.append(get_sub_index(so2, so2_bp))
    if pd.notna(co): indices.append(get_sub_index(co, co_bp))
    if pd.notna(o3): indices.append(get_sub_index(o3, o3_bp))
    if nh3 is not None and pd.notna(nh3): indices.append(get_sub_index(nh3, nh3_bp))

    return max(indices) if indices else np.nan

def load_and_merge_datasets(data_dir):
    """
    Loads and merges the 3 specified CSV files for training.
    """
    dfs = []

    # 1. air_quality_india.csv
    path1 = os.path.join(data_dir, "air_quality_india.csv")
    if os.path.exists(path1):
        try:
            df1 = pd.read_csv(path1)
            # Ensure NH3 exists
            if "NH3" not in df1.columns:
                df1["NH3"] = 0.0
            
            # Select only needed columns
            cols = [c for c in FEATURE_COLS + [TARGET_COL] if c in df1.columns]
            df1 = df1[cols]
            dfs.append(df1)
            print(f"[DATA] Loaded {len(df1)} rows from air_quality_india.csv")
        except Exception as e:
            print(f"[ERROR] Failed to load air_quality_india.csv: {e}")

    # 2. ahmedabad_air_quality_model_ready.csv
    path2 = os.path.join(data_dir, "ahmedabad_air_quality_model_ready.csv")
    if os.path.exists(path2):
        try:
            df2 = pd.read_csv(path2)
            # Map columns
            mapping = {
                "PM2.5 (ug/m3)": "PM2.5",
                "PM10 (ug/m3)": "PM10",
                "NO2 (ug/m3)": "NO2",
                "SO2 (ug/m3)": "SO2",
                "CO (mg/m3)": "CO",
                "Ozone (ug/m3)": "O3"
            }
            df2 = df2.rename(columns=mapping)
            
            # Fill NH3 if missing
            if "NH3" not in df2.columns:
                df2["NH3"] = 0.0 # Will be refined in training script if needed

            # Calculate AQI
            if TARGET_COL not in df2.columns:
                print("[DATA] Calculating AQI for Ahmedabad dataset...")
                df2[TARGET_COL] = df2.apply(
                    lambda row: calculate_aqi(
                        row.get("PM2.5"), row.get("PM10"), row.get("NO2"), 
                        row.get("SO2"), row.get("CO"), row.get("O3"), row.get("NH3")
                    ), axis=1
                )
            
            # Select needed columns
            cols = [c for c in FEATURE_COLS + [TARGET_COL] if c in df2.columns]
            df2 = df2[cols]
            dfs.append(df2)
            print(f"[DATA] Loaded {len(df2)} rows from ahmedabad_air_quality_model_ready.csv")
        except Exception as e:
            print(f"[ERROR] Failed to load ahmedabad_air_quality_model_ready.csv: {e}")

    # 3. iot_data.csv
    path3 = os.path.join(data_dir, "iot_data.csv")
    if os.path.exists(path3):
        try:
            df3 = pd.read_csv(path3)
            # Cols match except SO2 is missing
            if "SO2" not in df3.columns:
                df3["SO2"] = 0.0 # Default or mean
            
            cols = [c for c in FEATURE_COLS + [TARGET_COL] if c in df3.columns]
            df3 = df3[cols]
            dfs.append(df3)
            print(f"[DATA] Loaded {len(df3)} rows from iot_data.csv")
        except Exception as e:
            print(f"[ERROR] Failed to load iot_data.csv: {e}")

    if not dfs:
        return pd.DataFrame(columns=FEATURE_COLS + [TARGET_COL])

    merged_df = pd.concat(dfs, ignore_index=True)
    
    # Final cleanup
    merged_df = merged_df.dropna(subset=[TARGET_COL]) # Drop if no AQI
    for col in FEATURE_COLS:
        merged_df[col] = pd.to_numeric(merged_df[col], errors='coerce').fillna(0)
    
    print(f"[DATA] Final merged dataset size: {len(merged_df)} rows")
    return merged_df
