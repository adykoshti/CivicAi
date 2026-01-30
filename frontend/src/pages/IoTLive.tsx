import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchIoTData, fetchLatestAQI, searchStations, fetchStationFeed, getAQIStatus, aqiToConcentration } from '@/services/api';
import { Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const IoTLive = () => {
  const [sensorData, setSensorData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('ahmedabad');
  const [dataSource, setDataSource] = useState<'iot' | 'api'>('iot');

  const loadData = async (cityOverride?: string, sourceOverride?: 'iot' | 'api') => {
    const city = cityOverride || selectedCity;
    const source = sourceOverride || dataSource;
    setLoading(true);
    try {
      if (source === 'iot') {
        // 1. Fetch IoT Data from Backend (MongoDB/CSV)
        const iotReadings = await fetchIoTData();
        
        // 2. Fetch API Data for the cities present in IoT data (for merged view)
        const cities = [...new Set(iotReadings.map((r: any) => r.city || selectedCity))];
        const apiDataMap: Record<string, any> = {};

        // Parallel fetch for cities
        await Promise.all(cities.map(async (city) => {
            if (!city || city === 'Unknown') return;
            try {
                const stations = await searchStations(city);
                if (stations && stations.length > 0) {
                    // Use the first station found to represent the city's ambient air
                    const feed = await fetchStationFeed(stations[0].uid);
                    apiDataMap[city] = feed;
                }
            } catch (err) {
                console.error(`API fetch failed for ${city}`, err);
            }
        }));
        
        const sensors = iotReadings.map((data: any) => {
            const city = data.city || 'Unknown';
            const apiData = apiDataMap[city] || {};
            const iaqi = apiData.iaqi || {};
            
            // Effective AQI from API
            const effectiveAQI = apiData.aqi !== '-' ? Number(apiData.aqi) : 0;

            return {
                id: data._id?.$oid || data._id || Math.random(),
                sensorId: data.device_id || 'ESP8266-Node', 
                location: city,
                // IoT Data (Temp, Humidity, NH3)
                temperature: data.raw_values?.temp ? Number(data.raw_values.temp).toFixed(1) : '-',
                humidity: data.raw_values?.humidity ? Number(data.raw_values.humidity).toFixed(1) : '-',
                nh3: data.raw_values?.nh3 ? Number(data.raw_values.nh3).toFixed(1) : '-',
                gasRaw: data.raw_values?.gasRaw ? Number(data.raw_values.gasRaw).toFixed(1) : '-',
                
                // API Data (Rest)
                aqi: effectiveAQI || '-',
                pm25: iaqi.pm25?.v ? aqiToConcentration(Number(iaqi.pm25.v), 'pm25').toFixed(1) : '-',
                pm10: iaqi.pm10?.v ? aqiToConcentration(Number(iaqi.pm10.v), 'pm10').toFixed(1) : '-',
                no2: iaqi.no2?.v ? aqiToConcentration(Number(iaqi.no2.v), 'no2').toFixed(1) : '-',
                so2: iaqi.so2?.v ? Number(iaqi.so2.v).toFixed(1) : '-',
                o3: iaqi.o3?.v ? aqiToConcentration(Number(iaqi.o3.v), 'o3').toFixed(1) : '-',
                
                status: getAQIStatus(effectiveAQI || 0).label,
                timestamp: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Just now'
            };
        });

        // Table: Latest 10 entries
        setSensorData(sensors.slice(0, 10));

        // 3. Chart Data (using merged data)
        const chartPoints = [...sensors].reverse().map((s: any) => ({
            time: s.timestamp.includes(',') ? s.timestamp.split(',')[1].trim().slice(0, 5) : s.timestamp,
            aqi: s.aqi !== '-' ? Number(s.aqi) : 0,
            status: s.status,
            no2: s.no2 !== '-' ? Number(s.no2) : 0,
            so2: s.so2 !== '-' ? Number(s.so2) : 0,
            o3: s.o3 !== '-' ? Number(s.o3) : 0,
            co: 0,
            temperature: s.temperature !== '-' ? Number(s.temperature) : 0,
            humidity: s.humidity !== '-' ? Number(s.humidity) : 0,
            nh3: s.nh3 !== '-' ? Number(s.nh3) : 0,
            gasRaw: s.gasRaw !== '-' ? Number(s.gasRaw) : 0,
        }));
        
        setChartData(chartPoints);
      } else {
        // 2. Fetch API Data (WAQI Search)
        // Also fetch latest IoT data to enrich the API stations with local sensor data (Temp/Hum/NH3)
        const [searchResults, iotReadings] = await Promise.all([
            searchStations(city),
            fetchIoTData()
        ]);
        
        // Extract latest IoT values (if available)
        let latestIoT = { temp: '-', humidity: '-', nh3: '-', gasRaw: '-' };
        if (iotReadings && iotReadings.length > 0) {
            const latest = iotReadings[0]; // Assuming sorted by latest first
            latestIoT = {
                temp: latest.raw_values?.temp ? Number(latest.raw_values.temp).toFixed(1) : '-',
                humidity: latest.raw_values?.humidity ? Number(latest.raw_values.humidity).toFixed(1) : '-',
                nh3: latest.raw_values?.nh3 ? Number(latest.raw_values.nh3).toFixed(1) : '-',
                gasRaw: latest.raw_values?.gasRaw ? Number(latest.raw_values.gasRaw).toFixed(1) : '-'
            };
        }
        
        // Fetch detailed feed for each station to get pollutant values
        const detailedStationsPromises = searchResults.map(async (st: any) => {
            const feed = await fetchStationFeed(st.uid);
            if (feed) {
                return {
                    ...st,
                    details: feed
                };
            }
            return st;
        });

        const stations = await Promise.all(detailedStationsPromises);
        
        const fetchTime = new Date().toLocaleString();
 
         const sensors = stations.map((st: any) => {
             const d = st.details || {};
             const iaqi = d.iaqi || {};
             
             // Calculate effective AQI if missing (Max of available sub-indices)
             let effectiveAQI = d.aqi !== '-' ? Number(d.aqi) : (st.aqi !== '-' ? Number(st.aqi) : 0);
             if (!effectiveAQI || isNaN(effectiveAQI)) {
                 const vals = [iaqi.pm25?.v, iaqi.pm10?.v, iaqi.no2?.v, iaqi.so2?.v, iaqi.o3?.v, iaqi.co?.v].map(v => Number(v) || 0);
                 effectiveAQI = Math.max(...vals);
             }

             return {
                 id: st.uid,
                 sensorId: `WAQI-${st.uid}`,
                 location: st.station.name,
                 
                 // Injected from latest IoT reading
                temperature: latestIoT.temp,
                humidity: latestIoT.humidity,
                nh3: latestIoT.nh3,
                gasRaw: latestIoT.gasRaw,

                aqi: effectiveAQI > 0 ? effectiveAQI : '-',
                 // Convert AQI values to Concentration for Pollutants to avoid duplication
                 pm25: iaqi.pm25?.v ? aqiToConcentration(Number(iaqi.pm25.v), 'pm25').toFixed(1) : '-',
                 pm10: iaqi.pm10?.v ? aqiToConcentration(Number(iaqi.pm10.v), 'pm10').toFixed(1) : '-',
                 no2: iaqi.no2?.v ? aqiToConcentration(Number(iaqi.no2.v), 'no2').toFixed(1) : '-',
                 so2: iaqi.so2?.v ? Number(iaqi.so2.v).toFixed(1) : '-', // No conversion helper for SO2 yet, use raw AQI
                 o3: iaqi.o3?.v ? aqiToConcentration(Number(iaqi.o3.v), 'o3').toFixed(1) : '-',
                 co: iaqi.co?.v ? Number(iaqi.co.v).toFixed(2) : '-', // CO usually low, use raw
                 status: getAQIStatus(effectiveAQI).label,
                 timestamp: fetchTime
             };
         });
 
         setSensorData(sensors);
 
         // Chart Data (Focus on Chandkheda, Simulated Last 2 Mins like previous code)
         // Find Chandkheda station
         const chandkhedaStation = sensors.find((s: any) => s.location.toLowerCase().includes('chandkheda'));
         const targetStation = chandkhedaStation || (sensors.length > 0 ? sensors[0] : null);
         
         if (targetStation) {
             const now = new Date();
             const points: any[] = [];
             
             // Generate 13 points (0 to 12) for the last 2 minutes (120 seconds)
             // Step = 10 seconds
             for (let i = 12; i >= 0; i--) {
                const t = new Date(now.getTime() - i * 10 * 1000);
                // Random variation +/- 4%
                const v = 0.96 + Math.random() * 0.08;
                
                points.push({
                    time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    aqi: Math.round((Number(targetStation.aqi) || 0) * v),
                    status: targetStation.status,
                    pm25: Number(((Number(targetStation.pm25) || 0) * v).toFixed(1)),
                    pm10: Number(((Number(targetStation.pm10) || 0) * v).toFixed(1)),
                    no2: Number(((Number(targetStation.no2) || 0) * v).toFixed(1)),
                    so2: Number(((Number(targetStation.so2) || 0) * v).toFixed(1)),
                    o3: Number(((Number(targetStation.o3) || 0) * v).toFixed(1)),
                    co: Number(((Number(targetStation.co) || 0) * v).toFixed(2)),
                   nh3: Number(((Number(targetStation.nh3) || 0) * v).toFixed(1)),
                   gasRaw: Number(((Number(targetStation.gasRaw) || 0) * v).toFixed(1)),
                   temperature: Number(((Number(targetStation.temperature) || 0) * v).toFixed(1)),
                   humidity: Number(((Number(targetStation.humidity) || 0) * v).toFixed(1)),
                });
             }
             
             setChartData(points);
         }
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setChartData([]); // Clear chart data to prevent mixing
    loadData();
    const interval = setInterval(() => loadData(), 30000); // Refresh every 30s as requested
    return () => clearInterval(interval);
  }, [selectedCity, dataSource]); // Re-run when selectedCity or dataSource changes

  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    // loadData(value) will be triggered by useEffect, but we can also trigger immediately if needed
    // However, useEffect dependency is cleaner.
  };


  

  const getStatusBadge = (aqi: number | string) => {
    const val = Number(aqi);
    if (isNaN(val)) return <Badge variant="outline">Unknown</Badge>;

    if (val <= 50) return <Badge className="bg-success text-success-foreground">Good</Badge>;
    if (val <= 100) return <Badge className="bg-warning text-warning-foreground">Satisfactory</Badge>;
    if (val <= 200) return <Badge className="bg-warning text-warning-foreground">Moderate</Badge>;
    if (val <= 300) return <Badge className="bg-destructive text-destructive-foreground">Poor</Badge>;
    if (val <= 400) return <Badge className="bg-destructive text-destructive-foreground">Very Poor</Badge>;
    return <Badge className="bg-destructive text-destructive-foreground">Severe</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Wifi className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">IoT Live Monitoring</h1>
              <p className="text-sm text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-muted rounded-lg p-1">
                <Button 
                    variant={dataSource === 'iot' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setDataSource('iot')}
                    className="text-xs"
                >
                    ioT
                </Button>
                <Button 
                    variant={dataSource === 'api' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setDataSource('api')}
                    className="text-xs"
                >
                    API
                </Button>
            </div>
            <Select value={selectedCity} onValueChange={handleCityChange}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ahmedabad">Ahmedabad</SelectItem>
                <SelectItem value="delhi">Delhi</SelectItem>
                <SelectItem value="mumbai">Mumbai</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => loadData()} disabled={loading} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Pollutant Trends (Last Hour)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: any, name: any, props: any) => {
                        if (name === 'AQI Status') {
                          return [value, `AQI (${props.payload.status})`];
                        }
                        return [value, name];
                      }}
                    />
                    
                    {dataSource === 'iot' ? (
                      <>
                        <Line type="monotone" dataKey="temperature" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} name="Temperature" />
                        <Line type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Humidity" />
                        <Line type="monotone" dataKey="nh3" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6' }} name="NH3" />
                        <Line type="monotone" dataKey="gasRaw" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name="Gas Index" />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="aqi" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: 'hsl(var(--destructive))' }} name="AQI" />
                        <Line type="monotone" dataKey="pm25" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name="PM2.5" />
                        <Line type="monotone" dataKey="pm10" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} name="PM10" />
                        <Line type="monotone" dataKey="nh3" stroke="#14b8a6" strokeWidth={2} dot={{ fill: '#14b8a6' }} name="NH3" />
                        <Line type="monotone" dataKey="so2" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ fill: 'hsl(var(--warning))' }} name="SO₂" />
                        <Line type="monotone" dataKey="no2" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} name="NO₂" />
                        <Line type="monotone" dataKey="o3" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))' }} name="O₃" />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-6 mt-4">
                {dataSource === 'iot' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm text-muted-foreground">Temperature</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm text-muted-foreground">Humidity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-teal-500" />
                      <span className="text-sm text-muted-foreground">NH3</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      <span className="text-sm text-muted-foreground">Gas Index</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                      <span className="text-sm text-muted-foreground">AQI</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      <span className="text-sm text-muted-foreground">PM2.5</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm text-muted-foreground">PM10</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-teal-500" />
                      <span className="text-sm text-muted-foreground">NH3</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm text-muted-foreground">SO₂</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm text-muted-foreground">NO₂</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm text-muted-foreground">O₃</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sensor Table */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Sensor Readings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sensor ID</TableHead>
                      <TableHead>Location</TableHead>
                      {dataSource === 'iot' && <TableHead>Temperature</TableHead>}
                      {dataSource === 'iot' && <TableHead>Humidity</TableHead>}
                      {dataSource === 'iot' && <TableHead>NH3</TableHead>}
                      {dataSource === 'api' && <TableHead>AQI</TableHead>}
                      {dataSource === 'api' && <TableHead>PM2.5</TableHead>}
                      {dataSource === 'api' && <TableHead>PM10</TableHead>}
                      {dataSource === 'api' && <TableHead>SO2</TableHead>}
                      {dataSource === 'api' && <TableHead>NO₂</TableHead>}
                      {dataSource === 'api' && <TableHead>O₃</TableHead>}
                      {dataSource === 'iot' && <TableHead>Raw Gas Index</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sensorData.map((sensor) => (
                      <TableRow key={sensor.id}>
                        <TableCell className="font-mono text-sm">{sensor.sensorId}</TableCell>
                        <TableCell>{sensor.location}</TableCell>
                        {dataSource === 'iot' && <TableCell>{sensor.temperature}°C</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.humidity}%</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.nh3}</TableCell>}
                        {dataSource === 'api' && <TableCell className="font-bold">{sensor.aqi || '-'}</TableCell>}
                        {dataSource === 'api' && <TableCell>{sensor.pm25}</TableCell>}
                        {dataSource === 'api' && <TableCell>{sensor.pm10}</TableCell>}
                        {dataSource === 'api' && <TableCell>{sensor.so2}</TableCell>}
                        {dataSource === 'api' && <TableCell>{sensor.no2}</TableCell>}
                        {dataSource === 'api' && <TableCell>{sensor.o3}</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.gasRaw}</TableCell>}
                        <TableCell>{getStatusBadge(sensor.aqi || 0)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {sensor.timestamp}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default IoTLive;
