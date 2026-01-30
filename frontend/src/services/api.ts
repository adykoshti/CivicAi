
const API_BASE_URL = 'http://localhost:8001';
const WAQI_API_TOKEN = import.meta.env.VITE_WAQI_API_TOKEN || 'demo';
const WAQI_BASE_URL = 'https://api.waqi.info/feed';

// Mock IoT data (keep as is for now)
const mockIoTData = [
  { 
    _id: '1', 
    city: 'Downtown', 
    AQI: 65, 
    features: { 'PM2.5': 15.2, 'PM10': 28, 'NO2': 22, 'O3': 35, 'SO2': 10, 'CO': 0.5 },
    raw_values: { no2: 22, co: 0.5 },
    timestamp: '2024-12-13 10:00' 
  },
  { 
    _id: '2', 
    city: 'Industrial Zone', 
    AQI: 120, 
    features: { 'PM2.5': 45.8, 'PM10': 68, 'NO2': 55, 'O3': 28, 'SO2': 25, 'CO': 1.5 },
    raw_values: { no2: 55, co: 1.5 },
    timestamp: '2024-12-13 10:00' 
  },
  { 
    _id: '3', 
    city: 'Residential', 
    AQI: 45, 
    features: { 'PM2.5': 8.5, 'PM10': 15, 'NO2': 12, 'O3': 42, 'SO2': 5, 'CO': 0.3 },
    raw_values: { no2: 12, co: 0.3 },
    timestamp: '2024-12-13 10:00' 
  },
];

export const CITY_LIST = [
  "Ahmedabad", "Aizawl", "Amaravati", "Amritsar", "Bengaluru", "Bhopal", "Brajrajnagar", "Chandigarh", "Chennai", "Coimbatore", "Delhi", "Ernakulam", "Gurugram", "Guwahati", "Hyderabad", "Jaipur", "Jorapokhar", "Kochi", "Kolkata", "Lucknow", "Mumbai", "Patna", "Shillong", "Talcher", "Thiruvananthapuram", "Visakhapatnam"
];

const mockCities = [
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', aqi: 72, lat: 23.0225, lng: 72.5714 },
  { id: 'vijaynagar', name: 'Vijaynagar', state: 'Gujarat', aqi: 45, lat: 23.6, lng: 73.1 },
  { id: 'gandhinagar', name: 'Gandhinagar', state: 'Gujarat', aqi: 95, lat: 23.2156, lng: 72.6369 },
];

const mockRecommendations = [
  { id: 1, icon: 'factory', title: 'Implement stricter emission controls', priority: 'high' },
  { id: 2, icon: 'bus', title: 'Increase public transportation options', priority: 'medium' },
  { id: 3, icon: 'tree', title: 'Expand urban green spaces', priority: 'medium' },
  { id: 4, icon: 'alert', title: 'Issue health advisory for sensitive groups', priority: 'low' },
];

export const getAQIStatus = (aqi: number) => {
  if (aqi <= 50) return { label: 'Good', color: 'success' };
  if (aqi <= 100) return { label: 'Moderate', color: 'warning' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive', color: 'warning' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'destructive' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: 'destructive' };
  return { label: 'Hazardous', color: 'destructive' };
};

export const getHealthRisk = (aqi: number) => {
  if (aqi <= 50) return { level: 'Low', description: 'Air quality poses little or no risk' };
  if (aqi <= 100) return { level: 'Moderate', description: 'Acceptable for most individuals' };
  if (aqi <= 150) return { level: 'High', description: 'Sensitive groups may experience effects' };
  return { level: 'Very High', description: 'Health effects may be experienced by all' };
};

// Helper to convert AQI back to concentration (approximate)
export const aqiToConcentration = (aqi: number, pollutant: 'pm25' | 'pm10' | 'no2' | 'o3'): number => {
  if (!aqi) return 0;
  
  // Breakpoints based on US EPA
  const breakpoints = {
    pm25: [
      { aqi: [0, 50], conc: [0, 12.0] },
      { aqi: [51, 100], conc: [12.1, 35.4] },
      { aqi: [101, 150], conc: [35.5, 55.4] },
      { aqi: [151, 200], conc: [55.5, 150.4] },
      { aqi: [201, 300], conc: [150.5, 250.4] },
      { aqi: [301, 500], conc: [250.5, 500.4] }
    ],
    pm10: [
      { aqi: [0, 50], conc: [0, 54] },
      { aqi: [51, 100], conc: [55, 154] },
      { aqi: [101, 150], conc: [155, 254] },
      { aqi: [151, 200], conc: [255, 354] },
      { aqi: [201, 300], conc: [355, 424] },
      { aqi: [301, 500], conc: [425, 604] }
    ],
    no2: [ // ppb
      { aqi: [0, 50], conc: [0, 53] },
      { aqi: [51, 100], conc: [54, 100] },
      { aqi: [101, 150], conc: [101, 360] },
      { aqi: [151, 200], conc: [361, 649] },
      { aqi: [201, 300], conc: [650, 1249] },
      { aqi: [301, 500], conc: [1250, 2049] }
    ],
    o3: [ // ppb
      { aqi: [0, 50], conc: [0, 54] },
      { aqi: [51, 100], conc: [55, 70] },
      { aqi: [101, 150], conc: [71, 85] },
      { aqi: [151, 200], conc: [86, 105] },
      { aqi: [201, 300], conc: [106, 200] }
    ]
  };

  const range = breakpoints[pollutant].find(r => aqi >= r.aqi[0] && aqi <= r.aqi[1]);
  
  if (range) {
    const [iLow, iHigh] = range.aqi;
    const [cLow, cHigh] = range.conc;
    const concentration = ((aqi - iLow) / (iHigh - iLow)) * (cHigh - cLow) + cLow;
    return Number(concentration.toFixed(1));
  }

  return aqi; // Fallback if out of range
};

export const fetchLatestAQI = async (city?: string) => {
  const targetCity = city || 'ahmedabad';
  
  try {
    // Attempt to fetch from WAQI API first
    const waqiResponse = await fetch(`${WAQI_BASE_URL}/${targetCity}/?token=${WAQI_API_TOKEN}`);
    const waqiData = await waqiResponse.json();

    if (waqiData.status === 'ok') {
      const data = waqiData.data;
      const aqiValue = data.aqi;
      
      // Extract pollutants if available and convert IAQI to approximate concentration
      const pollutants = {
        pm25: aqiToConcentration(data.iaqi?.pm25?.v || 0, 'pm25'),
        pm10: aqiToConcentration(data.iaqi?.pm10?.v || 0, 'pm10'),
        no2: aqiToConcentration(data.iaqi?.no2?.v || 0, 'no2'),
        o3: aqiToConcentration(data.iaqi?.o3?.v || 0, 'o3'),
        so2: data.iaqi?.so2?.v || 0,
        co: data.iaqi?.co?.v || 0,
      };

      return {
        aqi: aqiValue,
        status: getAQIStatus(aqiValue).label, // Helper function usage
        healthRisk: getHealthRisk(aqiValue).level,
        pollutants: pollutants,
        timestamp: data.time?.iso || new Date().toISOString(),
        city: data.city?.name,
        raw: data // Keep raw data for advanced usage
      };
    } else {
      throw new Error(waqiData.data || 'WAQI API Error');
    }
  } catch (error) {
    console.warn(`WAQI API failed for ${targetCity}, falling back to backend/mock.`, error);
    
    // Fallback to existing backend logic
    try {
        if (targetCity.toLowerCase() !== 'ahmedabad') {
            const response = await fetch(`${API_BASE_URL}/city-data?city=${encodeURIComponent(targetCity)}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            const aqiValue = data.predicted_aqi;
            return {
                aqi: Math.round(aqiValue),
                status: data.severity,
                healthRisk: getHealthRisk(aqiValue).level,
                pollutants: {
                pm25: 0,
                pm10: 0,
                no2: 0,
                o3: 0,
                so2: 0,
                co: 0,
                },
                timestamp: new Date().toISOString(),
            };
        } else {
            const response = await fetch(`${API_BASE_URL}/predict-latest-aqi`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            const pollutants = data.current_pollutants || {};
            const aqiValue = data.actual_aqi !== null ? data.actual_aqi : data.predicted_aqi;
            return {
                aqi: Math.round(aqiValue),
                status: data.severity,
                healthRisk: getHealthRisk(aqiValue).level,
                pollutants: {
                pm25: pollutants['PM2.5'] || 0,
                pm10: pollutants['PM10'] || 0,
                no2: pollutants['NO2'] || 0,
                o3: pollutants['O3'] || 0,
                so2: pollutants['SO2'] || 0,
                co: pollutants['CO'] || 0,
                },
                timestamp: new Date().toISOString(),
            };
        }
    } catch (backendError) {
        console.error("Failed to fetch latest AQI from backend:", backendError);
        return { 
            aqi: 0, 
            status: 'Error', 
            healthRisk: 'Unknown', 
            pollutants: { pm25:0, pm10:0, no2:0, o3:0, so2:0, co:0 }, 
            timestamp: new Date().toISOString() 
        };
    }
  }
};

export const fetchPrediction = async (city?: string) => {
  try {
    // If no city provided, default to Ahmedabad for backward compatibility
    const targetCity = city || 'ahmedabad';
    
    // Use city-data endpoint which now handles the "only Ahmedabad" logic
    const response = await fetch(`${API_BASE_URL}/city-data?city=${encodeURIComponent(targetCity)}`);
    
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    // Validate forecast structure
    const forecastData = data.forecast_next_24h;
    const isValidForecast = forecastData && 
                            typeof forecastData.min === 'number' && 
                            typeof forecastData.max === 'number';

    return {
      predictedAQI: data.predicted_aqi !== null ? Math.round(data.predicted_aqi) : "?",
      trend: 'stable', 
      confidence: data.confidence !== undefined ? data.confidence : 0.85, 
      timeframe: '24h',
      forecast: isValidForecast ? forecastData : null
    };
  } catch (error) {
    console.error("Failed to fetch prediction:", error);
    return { predictedAQI: 0, trend: 'unknown', confidence: 0, timeframe: '24h', forecast: null };
  }
};

export const fetchSHAPData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/predict-latest-aqi`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    const features = Object.entries(data.feature_contributions || {}).map(([name, value]) => ({
        name,
        value: Number(value),
        color: Number(value) > 0 ? 'destructive' : 'success' 
    }));
    
    // Sort by absolute value to show most important features
    features.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    // Fallback if no features returned (e.g. model issue)
    if (features.length === 0) throw new Error("No features from backend");

    return {
      features: features.slice(0, 5)
    };
  } catch (error) {
    console.warn("Failed to fetch SHAP data, using mock:", error);
    // Return mock data so the chart always shows something
    return { 
        features: [
            { name: 'PM10', value: 25.4, color: 'destructive' },
            { name: 'PM2.5', value: 12.5, color: 'destructive' },
            { name: 'NO2', value: 18.2, color: 'destructive' },
            { name: 'SO2', value: -5.4, color: 'success' },
            { name: 'NH3', value: 3.1, color: 'destructive' },
            { name: 'O3', value: -2.1, color: 'success' }
        ] 
    };
  }
};

export const searchStations = async (keyword: string) => {
    try {
        const response = await fetch(`https://api.waqi.info/search/?keyword=${keyword}&token=${WAQI_API_TOKEN}`);
        const data = await response.json();
        if (data.status === 'ok') {
            return data.data;
        }
        return [];
    } catch (error) {
        console.error("Error searching stations:", error);
        return [];
    }
};

export const fetchStationFeed = async (uid: number) => {
    try {
        const response = await fetch(`https://api.waqi.info/feed/@${uid}/?token=${WAQI_API_TOKEN}`);
        const data = await response.json();
        if (data.status === 'ok') {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching feed for uid ${uid}:`, error);
        return null;
    }
};

export const fetchIoTData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/iot-data`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch IoT data:", error);
    // Return empty or mock if failed
    return mockIoTData; 
  }
};

export const fetchCities = async () => {
  try {
    // We want to return data for all cities in CITY_LIST using WAQI API
    // To avoid hitting rate limits or making too many requests at once, we'll map them
    // but in a real app, you might want to cache this or do it differently.
    // For now, let's fetch them in parallel but handle errors gracefully.

    const cityPromises = CITY_LIST.map(async (cityName) => {
        try {
            const waqiResponse = await fetch(`${WAQI_BASE_URL}/${cityName}/?token=${WAQI_API_TOKEN}`);
            const waqiData = await waqiResponse.json();
            
            if (waqiData.status === 'ok') {
                const d = waqiData.data;
                return {
                    id: cityName.toLowerCase(),
                    name: cityName,
                    state: 'India', // Assuming all are in India for now based on list
                    aqi: d.aqi,
                    lat: d.city.geo[0],
                    lng: d.city.geo[1],
                    temp: d.iaqi?.t?.v ? Math.round(d.iaqi.t.v) : '--',
                    humidity: d.iaqi?.h?.v ? Math.round(d.iaqi.h.v) : Math.round(Math.random() * (70 - 50) + 50),
                    wind: d.iaqi?.w?.v ? Math.round(d.iaqi.w.v) : Math.round(Math.random() * (10 - 5) + 5), 
                };
            }
        } catch (e) {
            console.warn(`Failed to fetch city data for ${cityName}`, e);
        }
        return null;
    });

    const results = await Promise.all(cityPromises);
    const validResults = results.filter(c => c !== null);

    if (validResults.length > 0) {
        return validResults;
    }

    // Fallback if API fails completely
    const response = await fetch(`${API_BASE_URL}/cities`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch cities:", error);
    return mockCities;
  }
};

export const fetchRecommendations = async (aqiData?: any) => {
  try {
    // If no AQI data provided or it's missing essential components, fallback to mock
    if (!aqiData || !aqiData.pollutants) {
      console.warn("No AQI data provided for recommendations, using mock.");
      return mockRecommendations;
    }

    // Extract features required by the GRAP model
    // Note: GRAP model expects: PM2.5, PM10, NO2, SO2, CO, Temperature, Wind Speed
    const pollutants = aqiData.pollutants || {};
    const iaqi = aqiData.raw?.iaqi || {};

    // Use raw AQI values from WAQI API if available, as they often map better to GRAP stages 
    // when concentration conversion is ambiguous or yields low values.
    // Fallback to 'pollutants' (calculated conc) or defaults.
    const payload = {
      "PM2.5": iaqi.pm25?.v || pollutants.pm25 || 95.0, // Fallback to Poor range if missing
      "PM10": iaqi.pm10?.v || pollutants.pm10 || 150.0, // Fallback to Poor range
      "NO2": iaqi.no2?.v || pollutants.no2 || 45.0,
      "SO2": iaqi.so2?.v || pollutants.so2 || 12.0,
      "CO": iaqi.co?.v || pollutants.co || 1.5,
      "Temperature": iaqi.t?.v || 30.0,
      "Wind Speed": iaqi.w?.v || 5.5
    };

    console.log("Sending GRAP Payload (Raw/Hybrid):", payload);

    const response = await fetch(`${API_BASE_URL}/api/pollution/ml-ahmedabad-grap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    
    // Map backend response to Recommendation interface
    // Backend returns: { predicted_stage, severity_level, recommended_actions: string[] }
    const actions = data.recommended_actions || [];
    const severity = data.severity_level || 'Moderate';
    
    // Helper to determine priority based on severity
    const getPriority = () => {
      const s = severity.toLowerCase();
      if (s.includes('severe') || s.includes('emergency') || s.includes('very poor')) return 'high';
      if (s.includes('poor')) return 'medium';
      return 'low';
    };

    // Helper to guess icon based on action text
    const getIcon = (text: string) => {
      const t = text.toLowerCase();
      if (t.includes('vehicle') || t.includes('transport') || t.includes('car') || t.includes('traffic')) return 'bus';
      if (t.includes('industry') || t.includes('factory') || t.includes('emission') || t.includes('power')) return 'factory';
      if (t.includes('plant') || t.includes('tree') || t.includes('green')) return 'tree';
      return 'alert';
    };

    const mappedRecommendations = actions.map((action: string, index: number) => ({
      id: index + 1,
      icon: getIcon(action),
      title: action,
      priority: getPriority()
    }));

    // If no actions returned, fallback to mock
    if (mappedRecommendations.length === 0) {
      return mockRecommendations;
    }

    return mappedRecommendations;

  } catch (error) {
    console.error("Failed to fetch GRAP recommendations:", error);
    return mockRecommendations;
  }
};
