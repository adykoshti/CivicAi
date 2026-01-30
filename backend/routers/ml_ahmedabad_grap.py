from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from engine.ml_grap_engine import predict_grap

# This file combines the logic of the requested 'pollutionMLController.js' and 'pollutionMLRoutes.js'
# adapted for the Python FastAPI backend.

router = APIRouter()

class GrapInput(BaseModel):
    PM2_5: float = Field(..., alias="PM2.5")
    PM10: float
    NO2: float
    SO2: float
    CO: float
    Temperature: float
    Wind_Speed: float = Field(..., alias="Wind Speed")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "PM2.5": 120.5,
                "PM10": 210.0,
                "NO2": 45.0,
                "SO2": 12.0,
                "CO": 1.5,
                "Temperature": 30.0,
                "Wind Speed": 5.5
            }
        }

@router.post("/api/pollution/ml-ahmedabad-grap")
async def predict_grap_route(data: GrapInput):
    # Convert Pydantic model to dict with correct keys
    input_dict = {
        "PM2.5": data.PM2_5,
        "PM10": data.PM10,
        "NO2": data.NO2,
        "SO2": data.SO2,
        "CO": data.CO,
        "Temperature": data.Temperature,
        "Wind Speed": data.Wind_Speed
    }
    
    result = predict_grap(input_dict)
    
    if "error" in result:
        # Check if it's a "missing feature" or "not loaded" error
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result
