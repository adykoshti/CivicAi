import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AQICardProps {
  aqi: number;
  status: string;
  pollutants: {
    pm25: number;
    pm10: number;
    no2: number;
  };
}

const AQICard = ({ aqi, status, pollutants }: AQICardProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'good': return 'bg-success text-success-foreground';
      case 'moderate': return 'bg-warning text-warning-foreground';
      case 'unhealthy': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-warning text-warning-foreground';
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">AQI Card</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl font-bold text-foreground">{aqi}</span>
          <Badge className={cn('text-sm px-3 py-1', getStatusColor(status))}>
            {status}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">PM2.5</p>
            <p className="text-lg font-semibold text-foreground">{pollutants.pm25} <span className="text-xs text-muted-foreground">µg/m³</span></p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">PM10</p>
            <p className="text-lg font-semibold text-foreground">{pollutants.pm10}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">NO₂</p>
            <p className="text-lg font-semibold text-foreground">{pollutants.no2} <span className="text-xs text-muted-foreground">ppb</span></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AQICard;
