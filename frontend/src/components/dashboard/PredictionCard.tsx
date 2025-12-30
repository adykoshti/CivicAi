import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PredictionCardProps {
  predictedAQI: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

const PredictionCard = ({ predictedAQI, trend, confidence }: PredictionCardProps) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-6 w-6 text-warning" />;
      case 'down': return <TrendingDown className="h-6 w-6 text-success" />;
      default: return <Minus className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatus = (aqi: number) => {
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
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-foreground">{predictedAQI}</span>
              {getTrendIcon()}
            </div>
            <p className={cn('text-lg font-medium mt-1', status.color)}>{status.label}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-lg font-semibold text-foreground">{Math.round(confidence * 100)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictionCard;
