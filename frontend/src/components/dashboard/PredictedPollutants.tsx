import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchActualPollutantHistory, fetchPollutantForecast } from '@/services/api';

interface PollutantData {
  Date: string;
  'Predicted PM2.5': number;
  'Predicted PM10': number;
  'Predicted NO2': number;
  'Predicted O3': number;
  'Predicted SO2': number;
  'Predicted CO': number;
  'Actual PM2.5'?: number;
  'Actual PM10'?: number;
  'Actual NO2'?: number;
  'Actual O3'?: number;
  'Actual SO2'?: number;
  'Actual CO'?: number;
}

const PredictedPollutants = () => {
  const [data, setData] = useState<PollutantData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      try {
        const [forecast, actual] = await Promise.all([
          fetchPollutantForecast(),
          fetchActualPollutantHistory(),
        ]);
        
        // Create a set of all unique dates
        const allDates = new Set([
          ...forecast.map((d: PollutantData) => d.Date),
          ...actual.map((d: { Date: string }) => d.Date)
        ]);
        
        const forecastMap = new Map(forecast.map((row: PollutantData) => [row.Date, row]));
        const actualMap = new Map(actual.map((row: { Date: string }) => [row.Date, row]));
        
        const merged = Array.from(allDates).map(date => ({
          Date: date,
          ...(forecastMap.get(date) || {}),
          ...(actualMap.get(date) || {}),
        }));

        const sorted = merged.sort((a: any, b: any) => {
          return new Date(a.Date).getTime() - new Date(b.Date).getTime();
        });
        setData(sorted as PollutantData[]);
      } catch (error) {
        console.error("Failed to load pollutant forecast", error);
      } finally {
        setLoading(false);
      }
    };
    getData();
  }, []);

  if (loading) {
    return (
      <Card className="col-span-1 md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle>10-Day Pollutant Forecast</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="animate-pulse">Loading forecast...</div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-4">
      <CardHeader>
        <CardTitle>10-Day Pollutant Forecast (Sliding Window Prediction)</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-[200px] grid-cols-2 mb-4">
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="Date" 
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
                />
                <Legend />
                <Line type="monotone" dataKey="Predicted PM2.5" stroke="#8b5cf6" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="Predicted PM10" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="Predicted NO2" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="Predicted O3" stroke="hsl(var(--success))" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="Predicted SO2" stroke="hsl(var(--warning))" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="Predicted CO" stroke="#14b8a6" strokeWidth={1.5} dot={false} connectNulls />
                
                {/* Actual Lines - Dotted/Dashed */}
                <Line type="monotone" dataKey="Actual PM2.5" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2, strokeWidth: 1, fill: '#8b5cf6' }} connectNulls activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Actual PM10" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2, strokeWidth: 1, fill: '#f97316' }} connectNulls activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Actual NO2" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2, strokeWidth: 1, fill: 'hsl(var(--primary))' }} connectNulls activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Actual O3" stroke="hsl(var(--success))" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2, strokeWidth: 1, fill: 'hsl(var(--success))' }} connectNulls activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Actual SO2" stroke="hsl(var(--warning))" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2, strokeWidth: 1, fill: 'hsl(var(--warning))' }} connectNulls activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Actual CO" stroke="#14b8a6" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2, strokeWidth: 1, fill: '#14b8a6' }} connectNulls activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          
          <TabsContent value="table">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>PM2.5</TableHead>
                    <TableHead>PM10</TableHead>
                    <TableHead>NO2</TableHead>
                    <TableHead>O3</TableHead>
                    <TableHead>SO2</TableHead>
                    <TableHead>CO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data
                    .filter(row => row.Date >= new Date().toISOString().split('T')[0])
                    .map((row) => (
                    <TableRow key={row.Date}>
                      <TableCell className="font-medium">{row.Date}</TableCell>
                      <TableCell>{row['Predicted PM2.5']}</TableCell>
                      <TableCell>{row['Predicted PM10']}</TableCell>
                      <TableCell>{row['Predicted NO2']}</TableCell>
                      <TableCell>{row['Predicted O3']}</TableCell>
                      <TableCell>{row['Predicted SO2']}</TableCell>
                      <TableCell>{row['Predicted CO']}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PredictedPollutants;
