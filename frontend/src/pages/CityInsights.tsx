import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { fetchCities, getAQIStatus } from '@/services/api';
import { MapPin, Thermometer, Wind, Droplets } from 'lucide-react';

const CityInsights = () => {
  const [cities, setCities] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [timeRange, setTimeRange] = useState([24]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCities = async () => {
      try {
        const data = await fetchCities();
        setCities(data as any[]);
        if ((data as any[]).length > 0 && !selectedCity) {
          setSelectedCity((data as any[])[0].id.toString());
        }
      } catch (error) {
        console.error('Error loading cities:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCities();

    // Auto-refresh every 30 seconds (User requested)
    const interval = setInterval(loadCities, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentCity = cities.find(c => c.id.toString() === selectedCity);
  const aqiStatus = currentCity ? getAQIStatus(currentCity.aqi) : null;

  const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return 'bg-success';
    if (aqi <= 100) return 'bg-warning';
    if (aqi <= 150) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">City Insights</h1>
          <p className="text-muted-foreground">
            Explore air quality data and trends across different cities
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-6 mb-8">
          <div className="w-64">
            <label className="text-sm text-muted-foreground mb-2 block">Select City</label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger>
                <SelectValue placeholder="Select a city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id.toString()}>
                    {city.name}, {city.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-64 hidden">
            <label className="text-sm text-muted-foreground mb-2 block">
              Time Range: {timeRange[0]} hours
            </label>
            <Slider
              value={timeRange}
              onValueChange={setTimeRange}
              max={48}
              min={1}
              step={1}
              className="py-2"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">Loading city data...</div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Heatmap Section */}
            <div className="lg:col-span-2">
              <Card className="bg-card border-border h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    AQI Heatmap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-[650px] bg-gradient-to-br from-primary/5 to-accent/10 rounded-lg overflow-hidden">
                    {/* Stylized map background */}
                    <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 400 300">
                      <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
                        </pattern>
                      </defs>
                      <rect width="400" height="300" fill="url(#grid)" />
                    </svg>

                    {/* City markers with AQI intensity - Scrollable Grid */}
                    <div className="absolute inset-0 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-muted">
                      <div className="grid grid-cols-3 gap-y-12 gap-x-4 pb-20">
                        {cities.map((city) => (
                          <div
                            key={city.id}
                            className={`flex flex-col items-center justify-center transition-all duration-300 cursor-pointer group ${
                              city.id.toString() === selectedCity ? 'scale-110' : 'scale-100 hover:scale-105'
                            }`}
                            onClick={() => setSelectedCity(city.id.toString())}
                          >
                            <div className="relative flex flex-col items-center">
                              {/* Glow effect */}
                              <div
                                className={`absolute rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity ${getAQIColor(city.aqi)}`}
                                style={{ width: '50px', height: '50px', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                              />
                              {/* Marker */}
                              <div
                                className={`relative w-12 h-12 rounded-full ${getAQIColor(city.aqi)} flex items-center justify-center shadow-lg border-2 ${
                                  city.id.toString() === selectedCity ? 'border-primary' : 'border-transparent'
                                }`}
                              >
                                <span className="text-sm font-bold text-foreground">{city.aqi}</span>
                              </div>
                              {/* Label */}
                              <div className="mt-2 text-center">
                                <span className={`text-xs font-medium px-2 py-1 rounded bg-background/80 ${
                                  city.id.toString() === selectedCity ? 'text-primary' : 'text-foreground'
                                }`}>
                                  {city.name}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border shadow-sm z-20 pointer-events-none">
                      <p className="text-xs font-medium text-foreground mb-2">AQI Legend</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-success" />
                          <span className="text-xs text-muted-foreground">Good (0-50)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-warning" />
                          <span className="text-xs text-muted-foreground">Moderate (51-100)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-destructive" />
                          <span className="text-xs text-muted-foreground">Unhealthy (101+)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* City Details */}
            <div className="space-y-6">
              {currentCity && (
                <>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">{currentCity.name}, {currentCity.state}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center mb-6">
                        <span className="text-6xl font-bold text-foreground">{currentCity.aqi}</span>
                        <div className="mt-2">
                          {aqiStatus && (
                            <Badge className={`${getAQIColor(currentCity.aqi)} text-foreground`}>
                              {aqiStatus.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-secondary rounded-lg">
                          <Thermometer className="h-5 w-5 mx-auto text-primary mb-1" />
                          <p className="text-xs text-muted-foreground">Temperature</p>
                          <p className="font-semibold text-foreground">{currentCity.temp || '--'}°C</p>
                        </div>
                        <div className="text-center p-3 bg-secondary rounded-lg">
                          <Droplets className="h-5 w-5 mx-auto text-primary mb-1" />
                          <p className="text-xs text-muted-foreground">Humidity</p>
                          <p className="font-semibold text-foreground">{currentCity.humidity || '--'}%</p>
                        </div>
                        <div className="text-center p-3 bg-secondary rounded-lg hidden">
                          <Wind className="h-5 w-5 mx-auto text-primary mb-1" />
                          <p className="text-xs text-muted-foreground">Wind Speed</p>
                          <p className="font-semibold text-foreground">{currentCity.wind || '--'} km/h</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="p-3 bg-secondary rounded-lg">
                          <p className="text-sm font-medium text-foreground">Odor complaint</p>
                          <p className="text-xs text-muted-foreground">04/16/2024 · Ahmedabad, GJ</p>
                        </div>
                        <div className="p-3 bg-secondary rounded-lg">
                          <p className="text-sm font-medium text-foreground">Vehicle idling</p>
                          <p className="text-xs text-muted-foreground">04/15/2024 · Ahmedabad, GJ</p>
                        </div>
                        <div className="p-3 bg-secondary rounded-lg">
                          <p className="text-sm font-medium text-foreground">Industrial emissions</p>
                          <p className="text-xs text-muted-foreground">04/14/2024 · Ahmedabad, GJ</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CityInsights;