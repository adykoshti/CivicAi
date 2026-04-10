from fastapi import APIRouter, HTTPException
import os
import csv
from datetime import datetime
from engine.sliding_window_forecast import PollutantForecaster

router = APIRouter()

@router.get("/api/pollution/forecast-10-days", tags=["Forecasting"])
async def get_pollutant_forecast():
    """
    Returns a 10-day sliding window forecast for individual pollutants.
    Uses models trained on recent data (Random Forest).
    """
    try:
        forecast = PollutantForecaster.predict_next_10_days()
        if isinstance(forecast, dict) and "error" in forecast:
            raise HTTPException(status_code=400, detail=forecast["error"])
        return forecast
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/pollution/actual-10-days", tags=["Forecasting"])
async def get_actual_pollutant_history():
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        file_path = os.path.join(base_dir, "data", "last_10days_maninagar_aqi.csv")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Actual data file not found")

        rows = []
        with open(file_path, "r", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                date_str = row.get("Date")
                if not date_str:
                    continue
                rows.append({
                    "Date": date_str,
                    "Actual PM2.5": float(row.get("PM2.5") or 0),
                    "Actual PM10": float(row.get("PM10") or 0),
                    "Actual NO2": float(row.get("NO2") or 0),
                    "Actual O3": float(row.get("O3") or 0),
                    "Actual SO2": float(row.get("SO2") or 0),
                    "Actual CO": float(row.get("CO") or 0),
                })

        rows.sort(key=lambda r: datetime.strptime(r["Date"], "%Y-%m-%d"))
        return rows
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
