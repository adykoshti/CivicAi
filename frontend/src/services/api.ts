
const API_BASE_URL = 'http://localhost:8001';
const WAQI_API_TOKEN = import.meta.env.VITE_WAQI_API_TOKEN || 'demo';
const WAQI_BASE_URL = 'https://api.waqi.info/feed';

// Mock IoT data (keep as is for now)
const mockIoTData = [
  { id: 1, sensorId: 'S001', location: 'Downtown', pm25: 15.2, pm10: 28, no2: 22, o3: 35, timestamp: '2024-12-13 10:00' },
  { id: 2, sensorId: 'S002', location: 'Industrial Zone', pm25: 45.8, pm10: 68, no2: 55, o3: 28, timestamp: '2024-12-13 10:00' },
  { id: 3, sensorId: 'S003', location: 'Residential', pm25: 8.5, pm10: 15, no2: 12, o3: 42, timestamp: '2024-12-13 10:00' },
  { id: 4, sensorId: 'S004', location: 'Highway', pm25: 32.1, pm10: 52, no2: 48, o3: 25, timestamp: '2024-12-13 10:00' },
  { id: 5, sensorId: 'S005', location: 'Park', pm25: 5.2, pm10: 10, no2: 8, o3: 45, timestamp: '2024-12-13 10:00' },
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

export const fetchLatestAQI = async (city?: string) => {
  const targetCity = city || 'ahmedabad';
  
  try {
    // Attempt to fetch from WAQI API first
    const waqiResponse = await fetch(`${WAQI_BASE_URL}/${targetCity}/?token=${WAQI_API_TOKEN}`);
    const waqiData = await waqiResponse.json();

    if (waqiData.status === 'ok') {
      const data = waqiData.data;
      const aqiValue = data.aqi;
      
      // Extract pollutants if available
      const pollutants = {
        pm25: data.iaqi?.pm25?.v || 0,
        pm10: data.iaqi?.pm10?.v || 0,
        no2: data.iaqi?.no2?.v || 0,
        o3: data.iaqi?.o3?.v || 0,
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

export const fetchPrediction = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/predict-latest-aqi`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    return {
      predictedAQI: Math.round(data.predicted_aqi),
      trend: 'stable', 
      confidence: data.confidence ? data.confidence / 100 : 0.85, // Use backend confidence if available
      timeframe: '24h'
    };
  } catch (error) {
    console.error("Failed to fetch prediction:", error);
    return { predictedAQI: 0, trend: 'unknown', confidence: 0, timeframe: '24h' };
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
            { name: 'PM2.5', value: 12.5, color: 'destructive' },
            { name: 'Traffic', value: 8.2, color: 'destructive' },
            { name: 'Wind Speed', value: -5.4, color: 'success' },
            { name: 'Temperature', value: 3.1, color: 'destructive' },
            { name: 'Humidity', value: -2.1, color: 'success' }
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

export const fetchRecommendations = async () => {
  return new Promise(resolve => setTimeout(() => resolve(mockRecommendations), 500));
};
