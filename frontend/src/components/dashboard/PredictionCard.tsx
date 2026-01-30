import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PredictionCardProps {
  predictedAQI: number | string;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  forecast?: { min: number; max: number } | null;
}

const PredictionCard = ({ predictedAQI, trend, confidence, forecast }: PredictionCardProps) => {
  const getTrendIcon = () => {
    if (typeof predictedAQI === 'string') return null;
    
    switch (trend) {
      case 'up': return <TrendingUp className="h-6 w-6 text-warning" />;
      case 'down': return <TrendingDown className="h-6 w-6 text-success" />;
      default: return null;
    }
  };

  const getStatus = (aqi: number | string) => {
    if (typeof aqi === 'string') return { label: 'Unknown', color: 'text-muted-foreground' };
    
    if (aqi <= 50) return { label: 'Good', color: 'text-success' };
    if (aqi <= 100) return { label: 'Moderate', color: 'text-warning' };
    return { label: 'Unhealthy', color: 'text-destructive' };
  };

  const status = getStatus(predictedAQI);

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">AQI Prediction</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <span className={cn("font-bold text-foreground", forecast ? "text-3xl" : "text-5xl")}>
              {forecast ? `${forecast.min} - ${forecast.max}` : predictedAQI}
            </span>
            {getTrendIcon()}
          </div>

          <div className="flex flex-col gap-1">
            <p className={cn('text-lg font-medium', status.color)}>{status.label}</p>
            <div className="flex items-center gap-2">
              <p className="text-base text-muted-foreground">Confidence:</p>
              <p className="text-lg font-semibold text-foreground">{Math.round(confidence * 100)}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictionCard;
