import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { API_BASE_URL, fetchIoTData, fetchLatestAQI, searchStations, fetchStationFeed, getAQIStatus, aqiToConcentration } from '@/services/api';
import { Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SensorValue = string | number;

type SensorRow = {
  id: string | number;
  sensorId: string;
  location: string;
  temperature: SensorValue;
  humidity: SensorValue;
  nh3: SensorValue;
  gasRaw: SensorValue;
  aqi: SensorValue;
  pm25: SensorValue;
  pm10: SensorValue;
  no2: SensorValue;
  so2: SensorValue;
  o3: SensorValue;
  co: SensorValue;
  status: string;
  timestamp: string;
};

type ChartPoint = {
  time: string;
  aqi: number;
  status: string;
  no2: number;
  so2: number;
  o3: number;
  co: number;
  temperature: number;
  humidity: number;
  nh3: number;
  gasRaw: number;
  pm25?: number;
  pm10?: number;
};

type IoTRawValues = {
  temp?: number;
  humidity?: number;
  nh3?: number;
  gasRaw?: number;
  pm25?: number;
  pm10?: number;
  no2?: number;
  so2?: number;
  o3?: number;
  co?: number;
};

type IoTEntry = {
  _id?: { $oid?: string } | string;
  device_id?: string;
  city?: string;
  AQI?: number;
  aqi?: number;
  raw_values?: IoTRawValues;
  timestamp?: string;
};

type StationDetail = {
  aqi?: number | string;
  iaqi?: Record<string, { v?: number }>;
};

type Station = {
  uid: number;
  aqi?: number | string;
  station: { name: string };
  details?: StationDetail;
};

const IoTLive = () => {
  const [sensorData, setSensorData] = useState<SensorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('ahmedabad');
  const [dataSource, setDataSource] = useState<'iot' | 'api'>('iot');
  const wsRef = useRef<WebSocket | null>(null);

  const toNumberOrDash = useCallback((value: unknown, digits = 1) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(digits) : '-';
  }, []);

  const toAqiValue = useCallback((value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : '-';
  }, []);

  const mapIoTEntry = useCallback((entry: IoTEntry): SensorRow => {
    const aqiValue = toAqiValue(entry?.AQI ?? entry?.aqi);
    return {
      id: entry._id?.$oid || entry._id || Math.random(),
      sensorId: entry.device_id || 'ESP8266-Node',
      location: entry.city || 'Unknown',
      temperature: toNumberOrDash(entry.raw_values?.temp),
      humidity: toNumberOrDash(entry.raw_values?.humidity),
      nh3: toNumberOrDash(entry.raw_values?.nh3),
      gasRaw: toNumberOrDash(entry.raw_values?.gasRaw),
      aqi: aqiValue,
      pm25: toNumberOrDash(entry.raw_values?.pm25),
      pm10: toNumberOrDash(entry.raw_values?.pm10),
      no2: toNumberOrDash(entry.raw_values?.no2),
      so2: toNumberOrDash(entry.raw_values?.so2),
      o3: toNumberOrDash(entry.raw_values?.o3),
      co: toNumberOrDash(entry.raw_values?.co, 2),
      status: aqiValue === '-' ? 'Unknown' : getAQIStatus(Number(aqiValue)).label,
      timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Just now'
    };
  }, [toAqiValue, toNumberOrDash]);

  const loadData = useCallback(async (cityOverride?: string, sourceOverride?: 'iot' | 'api') => {
    const city = cityOverride || selectedCity;
    const source = sourceOverride || dataSource;
    setLoading(true);
    try {
      if (source === 'iot') {
        const iotReadings = await fetchIoTData();
        const sensors = iotReadings.map(mapIoTEntry);

        // Table: Latest 10 entries
        setSensorData(sensors.slice(0, 10));

        // 3. Chart Data (using merged data)
        const chartPoints: ChartPoint[] = [...sensors].reverse().map((s) => ({
            time: s.timestamp.includes(',') ? s.timestamp.split(',')[1].trim().slice(0, 5) : s.timestamp,
            aqi: s.aqi !== '-' ? Number(s.aqi) : 0,
            status: s.status,
            no2: s.no2 !== '-' ? Number(s.no2) : 0,
            so2: s.so2 !== '-' ? Number(s.so2) : 0,
            o3: s.o3 !== '-' ? Number(s.o3) : 0,
            co: s.co !== '-' ? Number(s.co) : 0,
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
        const detailedStationsPromises = (searchResults as Station[]).map(async (st) => {
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
 
         const sensors: SensorRow[] = stations.map((st) => {
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
         const chandkhedaStation = sensors.find((s) => s.location.toLowerCase().includes('chandkheda'));
         const targetStation = chandkhedaStation || (sensors.length > 0 ? sensors[0] : null);
         
         if (targetStation) {
             const now = new Date();
             const points: ChartPoint[] = [];
             
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
  }, [dataSource, mapIoTEntry, selectedCity]);

  useEffect(() => {
    if (dataSource !== 'iot') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/iot`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    const updateChart = (entry: SensorRow) => {
      const time = entry.timestamp.includes(',')
        ? entry.timestamp.split(',')[1].trim().slice(0, 5)
        : entry.timestamp;
      const nextPoint: ChartPoint = {
        time,
        aqi: entry.aqi !== '-' ? Number(entry.aqi) : 0,
        status: entry.status,
        no2: entry.no2 !== '-' ? Number(entry.no2) : 0,
        so2: entry.so2 !== '-' ? Number(entry.so2) : 0,
        o3: entry.o3 !== '-' ? Number(entry.o3) : 0,
        co: entry.co !== '-' ? Number(entry.co) : 0,
        temperature: entry.temperature !== '-' ? Number(entry.temperature) : 0,
        humidity: entry.humidity !== '-' ? Number(entry.humidity) : 0,
        nh3: entry.nh3 !== '-' ? Number(entry.nh3) : 0,
        gasRaw: entry.gasRaw !== '-' ? Number(entry.gasRaw) : 0,
      };
      setChartData((prev) => {
        const merged = [...prev, nextPoint];
        return merged.slice(-60);
      });
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type?: string; data?: IoTEntry[] | IoTEntry };
        if (message?.type === 'init' && Array.isArray(message.data)) {
          const mapped = message.data.map(mapIoTEntry);
          setSensorData(mapped.slice(0, 10));
          setChartData([]);
          mapped.slice().reverse().forEach(updateChart);
          setLastUpdate(new Date());
        }
        if (message?.type === 'iot_update' && message.data) {
          const mapped = mapIoTEntry(message.data);
          setSensorData((prev) => {
            const filtered = prev.filter((item) => item.id !== mapped.id);
            return [mapped, ...filtered].slice(0, 10);
          });
          updateChart(mapped);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('Failed to parse IoT websocket message:', error);
      }
    };

    socket.onerror = () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };

    return () => {
      socket.close();
    };
  }, [dataSource, mapIoTEntry]);

  useEffect(() => {
    setChartData([]); // Clear chart data to prevent mixing
    loadData();
    if (dataSource === 'api') {
      const interval = setInterval(() => loadData(), 30000); // Refresh every 30s as requested
      return () => clearInterval(interval);
    }
  }, [loadData, dataSource]); // Re-run when selectedCity or dataSource changes

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
                      formatter={(value: SensorValue, name: string, props: { payload?: { status?: string } }) => {
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
                      {dataSource === 'iot' && <TableHead>PM2.5</TableHead>}
                      {dataSource === 'iot' && <TableHead>PM10</TableHead>}
                      {dataSource === 'iot' && <TableHead>NO2</TableHead>}
                      {dataSource === 'iot' && <TableHead>SO2</TableHead>}
                      {dataSource === 'iot' && <TableHead>O3</TableHead>}
                      {dataSource === 'iot' && <TableHead>CO</TableHead>}
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
                        {dataSource === 'iot' && <TableCell>{sensor.pm25}</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.pm10}</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.no2}</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.so2}</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.o3}</TableCell>}
                        {dataSource === 'iot' && <TableCell>{sensor.co}</TableCell>}
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
