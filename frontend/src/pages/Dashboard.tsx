import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import AQICard from '@/components/dashboard/AQICard';
import HealthRiskCard from '@/components/dashboard/HealthRiskCard';
import PredictionCard from '@/components/dashboard/PredictionCard';
import SHAPChart from '@/components/dashboard/SHAPChart';
import PollutionSourceCard from '@/components/dashboard/PollutionSourceCard';
import RecommendationsCard from '@/components/dashboard/RecommendationsCard';
import MiniMap from '@/components/dashboard/MiniMap';
import PollutantChart from '@/components/dashboard/PollutantChart';
import PredictedPollutants from '@/components/dashboard/PredictedPollutants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  fetchLatestAQI, 
  fetchPrediction, 
  fetchSHAPData, 
  fetchRecommendations,
  getHealthRisk,
  fetchCities,
  getAQIStatus,
  fetchStationFeed
} from '@/services/api';

type City = {
  id: string;
  name: string;
  aqi?: number;
};

type AQIPollutants = {
  pm25?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  co?: number;
};

type AQIData = {
  aqi: number;
  status?: string;
  pollutants?: AQIPollutants;
  raw?: {
    iaqi?: Record<string, { v?: number }>;
  };
};

type PredictionData = {
  predictedAQI?: number;
  trend?: string;
  confidence?: number;
  forecast?: { min: number; max: number } | null;
};

type SHAPData = {
  features?: Array<{ name: string; value: number }>;
};

type Recommendation = {
  id: number;
  icon: string;
  title: string;
  priority: string;
};

const Dashboard = () => {
  const location = useLocation();
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('ahmedabad');
  const [selectedCountry, setSelectedCountry] = useState('india');
  const [loading, setLoading] = useState(true);
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [shapData, setShapData] = useState<SHAPData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [externalAqi, setExternalAqi] = useState<number | null>(null);
  const [externalAqiStatus, setExternalAqiStatus] = useState('Loading');
  const [externalAqiError, setExternalAqiError] = useState<string | null>(null);

  useEffect(() => {
    const initCities = async () => {
      const cityList = await fetchCities();
      setCities(cityList);
      if (cityList.length > 0) {
        setSelectedCity((current) => current || cityList[0].id);
      }
    };
    initCities();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setExternalAqiStatus('Loading');
    setExternalAqiError(null);
    try {
      const externalAqiResponse = await Promise.allSettled([
        fetchLatestAQI(selectedCity),
        fetchStationFeed(8192)
      ]);

      const aqiResult = externalAqiResponse[0];
      const externalResult = externalAqiResponse[1];

      if (aqiResult.status === 'fulfilled') {
        setAqiData(aqiResult.value);
      } else {
        setAqiData(null);
      }

      if (externalResult.status === 'fulfilled') {
        const value = Number(externalResult.value?.aqi);
        if (Number.isFinite(value)) {
          setExternalAqi(value);
          setExternalAqiStatus(getAQIStatus(value).label);
          setExternalAqiError(null);
        } else {
          setExternalAqi(null);
          setExternalAqiStatus('Error');
          setExternalAqiError('Invalid AQI payload');
        }
      } else {
        setExternalAqi(null);
        setExternalAqiStatus('Error');
        setExternalAqiError('Failed to load external AQI');
      }

      const [pred, shap, recs] = await Promise.all([
        fetchPrediction(selectedCity),
        fetchSHAPData(),
        fetchRecommendations(aqiResult.status === 'fulfilled' ? aqiResult.value : undefined),
      ]);

      setPrediction(pred);
      setShapData(shap);
      setRecommendations(recs as Recommendation[]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      loadData();
    }
  }, [location.pathname, loadData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadData]);

  const healthRisk = aqiData ? getHealthRisk(aqiData.aqi) : { level: 'Loading', description: '' };
  const aqiCardValue = externalAqi ?? aqiData?.aqi ?? 56;
  const aqiCardStatus = externalAqi !== null
    ? externalAqiStatus
    : externalAqiError
      ? 'Error'
      : loading
        ? 'Loading'
        : aqiData?.status || 'Moderate';

  const adjustForecastRange = (forecast?: { min: number; max: number } | null) => {
    if (!forecast || typeof aqiCardValue !== 'number') return forecast;
    const current = Number(aqiCardValue);
    if (!Number.isFinite(current) || current <= 0) return forecast;
    const isFar = forecast.min < current * 0.7 || forecast.max > current * 1.6 || (forecast.max - forecast.min) > current * 0.9;
    if (!isFar) return forecast;
    const min = Math.round(current * 8) / 10;
    const max = Math.round(current * 14) / 10;
    return { min, max };
  };

  const calculatePollutionSources = () => {
    if (!aqiData?.pollutants) return [];
    
    const { pm25, pm10, no2, o3 } = aqiData.pollutants;
    const total = (pm25 || 0) + (pm10 || 0) + (no2 || 0) + (o3 || 0);
    
    if (total === 0) return [];

    return [
      { name: 'PM2.5', percentage: Math.round(((pm25 || 0) / total) * 100), color: 'red' },
      { name: 'NO2', percentage: Math.round(((no2 || 0) / total) * 100), color: 'blue' },
      { name: 'PM10', percentage: Math.round(((pm10 || 0) / total) * 100), color: 'orange' },
      { name: 'O3', percentage: Math.round(((o3 || 0) / total) * 100), color: 'green' },
    ].sort((a, b) => b.percentage - a.percentage);
  };

  const pollutionSources = calculatePollutionSources();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="india">India</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Row 1 */}
          <AQICard
            aqi={aqiCardValue}
            status={aqiCardStatus}
            pollutants={{
              pm25: aqiData?.pollutants?.pm25 || 12.4,
              pm10: aqiData?.pollutants?.pm10 || 25,
              no2: aqiData?.pollutants?.no2 || 18,
            }}
          />
          
          <HealthRiskCard
            level={healthRisk.level}
            description={healthRisk.description}
          />
          
          <PredictionCard
            predictedAQI={prediction?.predictedAQI || 62}
            trend={prediction?.trend || 'up'}
            confidence={prediction?.confidence || 0.87}
            forecast={adjustForecastRange(prediction?.forecast)}
          />
          
          <MiniMap city={cities.find(c => c.id === selectedCity)?.name || "Ahmedabad"} state="India" />

          {/* Row 2 - Forecast */}
          <PredictedPollutants />

          {/* Row 3 - SHAP & Sources */}
          <div className="lg:col-span-2">
            <SHAPChart features={shapData?.features || []} />
          </div>
          
          <div className="lg:col-span-2">
            <PollutionSourceCard sources={pollutionSources} />
          </div>

          {/* Row 4 - Details */}
          <div className="lg:col-span-2">
            <PollutantChart pollutants={aqiData?.pollutants || {
              pm25: 12.4,
              pm10: 25,
              no2: 18,
              o3: 32,
              so2: 5,
              co: 0.8
            }} />
          </div>
          
          <div className="lg:col-span-2">
            <RecommendationsCard recommendations={recommendations} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
