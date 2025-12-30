import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AQICard from '@/components/dashboard/AQICard';
import HealthRiskCard from '@/components/dashboard/HealthRiskCard';
import PredictionCard from '@/components/dashboard/PredictionCard';
import SHAPChart from '@/components/dashboard/SHAPChart';
import PollutionSourceCard from '@/components/dashboard/PollutionSourceCard';
import RecommendationsCard from '@/components/dashboard/RecommendationsCard';
import MiniMap from '@/components/dashboard/MiniMap';
import PollutantChart from '@/components/dashboard/PollutantChart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  fetchLatestAQI, 
  fetchPrediction, 
  fetchSHAPData, 
  fetchRecommendations,
  getHealthRisk,
  fetchCities
} from '@/services/api';

const Dashboard = () => {
  const [cities, setCities] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState('ahmedabad');
  const [selectedCountry, setSelectedCountry] = useState('india');
  const [loading, setLoading] = useState(true);
  const [aqiData, setAqiData] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [shapData, setShapData] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    const initCities = async () => {
      const cityList = await fetchCities();
      setCities(cityList);
      if (cityList.length > 0 && !selectedCity) {
        setSelectedCity(cityList[0].id);
      }
    };
    initCities();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [aqi, pred, shap, recs] = await Promise.all([
          fetchLatestAQI(selectedCity),
          fetchPrediction(),
          fetchSHAPData(),
          fetchRecommendations(),
        ]);
        setAqiData(aqi);
        setPrediction(pred);
        setShapData(shap);
        setRecommendations(recs as any[]);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Auto-refresh every 5 minutes (300000 ms)
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [selectedCity, selectedCountry]);

  const healthRisk = aqiData ? getHealthRisk(aqiData.aqi) : { level: 'Loading', description: '' };

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
            aqi={aqiData?.aqi || 56}
            status={aqiData?.status || 'Moderate'}
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
          />
          
          <MiniMap city={cities.find(c => c.id === selectedCity)?.name || "Ahmedabad"} state="India" />

          {/* Row 2 */}
          <div className="lg:col-span-2">
            <SHAPChart features={shapData?.features || []} />
          </div>
          
          <div className="lg:col-span-2">
            <PollutionSourceCard sources={pollutionSources} />
          </div>

          {/* Row 3 */}
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
