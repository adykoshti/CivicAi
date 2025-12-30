from pydantic import BaseModel

class PersonalRiskRequest(BaseModel):
    predicted_aqi: float
    profile: str

class ActionRecommendRequest(BaseModel):
    predicted_aqi: float
    main_source: str
    area_type: str
    region_name: str
