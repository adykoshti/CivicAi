import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchIoTData, fetchLatestAQI, searchStations, fetchStationFeed } from '@/services/api';
import { Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const IoTLive = () => {
  const [sensorData, setSensorData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('ahmedabad');

  const loadData = async (cityOverride?: string) => {
    const city = cityOverride || selectedCity;
    setLoading(true);
    try {
      // 1. Fetch Stations via Search API
      const stations = await searchStations(city);
      
      // 2. Fetch Details for each station (limit to first 10 to avoid excessive calls if many)
      const stationDetailsPromises = stations.slice(0, 10).map((station: any) => fetchStationFeed(station.uid));
      const stationDetails = await Promise.all(stationDetailsPromises);
      
      const validStationDetails = stationDetails.filter(d => d !== null);

      const sensors = validStationDetails.map((data: any) => ({
          id: data.idx,
          sensorId: data.idx, // uid
          location: data.city.name,
          aqi: data.aqi,
          pm25: data.iaqi?.pm25?.v || '-',
          pm10: data.iaqi?.pm10?.v || '-',
          no2: data.iaqi?.no2?.v || '-',
          so2: data.iaqi?.so2?.v || '-',
          o3: data.iaqi?.o3?.v || '-',
          co: data.iaqi?.co?.v || '-',
          timestamp: new Date().toLocaleTimeString() // Current time as requested
      }));

      setSensorData(sensors);

      // 3. Chart Data (using latest AQI for overall trend simulation)
      const latest = await fetchLatestAQI(city);
      const now = new Date();
      const points: any[] = [];
      for (let i = 12; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 5 * 60 * 1000);
        const v = 0.96 + Math.random() * 0.08;
        points.push({
          time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          aqi: Math.round((latest.aqi || 0) * v),
          status: latest.status || 'Unknown',
          no2: Math.round((latest.pollutants?.no2 || 0) * v), // Int
          so2: Math.round((latest.pollutants?.so2 || 0) * v), // Int
          o3: Math.round((latest.pollutants?.o3 || 0) * v),   // Int
          co: Math.round((latest.pollutants?.co || 0) * v),   // Int
        });
      }
      setChartData(points);
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading IoT data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 60000); // Auto-refresh every 1 minute (60000 ms)
    return () => clearInterval(interval);
  }, [selectedCity]); // Re-run when selectedCity changes

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
                    <Line 
                      type="monotone" 
                      dataKey="aqi" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--destructive))' }}
                      name="AQI Status"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="no2" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="NO₂"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="so2" 
                      stroke="hsl(var(--warning))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--warning))' }}
                      name="SO₂"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="o3" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--success))' }}
                      name="O₃"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="co" 
                      stroke="hsl(var(--secondary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--secondary))' }}
                      name="CO"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-sm text-muted-foreground">AQI Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">NO₂</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-muted-foreground">SO₂</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">O₃</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                  <span className="text-sm text-muted-foreground">CO</span>
                </div>
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
                      <TableHead>AQI</TableHead>
                      <TableHead>PM2.5</TableHead>
                      <TableHead>PM10</TableHead>
                      <TableHead>NO₂</TableHead>
                      <TableHead>O₃</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sensorData.map((sensor) => (
                      <TableRow key={sensor.id}>
                        <TableCell className="font-mono text-sm">{sensor.sensorId}</TableCell>
                        <TableCell>{sensor.location}</TableCell>
                        <TableCell className="font-bold">{sensor.aqi || '-'}</TableCell>
                        <TableCell>{sensor.pm25}</TableCell>
                        <TableCell>{sensor.pm10}</TableCell>
                        <TableCell>{sensor.no2}</TableCell>
                        <TableCell>{sensor.o3}</TableCell>
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
