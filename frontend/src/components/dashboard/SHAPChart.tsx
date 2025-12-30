import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SHAPFeature {
  name: string;
  value: number;
  color: string;
}

interface SHAPChartProps {
  features: SHAPFeature[];
}

const SHAPChart = ({ features }: SHAPChartProps) => {
  const maxAbsValue = Math.max(...features.map(f => Math.abs(f.value)), 1);

  const getBarColor = (color: string) => {
    switch (color) {
      case 'destructive': return 'bg-destructive';
      case 'primary': return 'bg-primary';
      case 'warning': return 'bg-warning';
      case 'success': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">SHAP Explainability (AQI Impact)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.name} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">{feature.name}</span>
                <span className={`text-sm font-bold ${feature.value > 0 ? 'text-destructive' : 'text-success'}`}>
                  {feature.value > 0 ? '+' : ''}{feature.value.toFixed(1)}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                 {/* Center line for 0 reference if we wanted bidirectional, but for now just magnitude */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBarColor(feature.color)}`}
                  style={{ width: `${Math.min((Math.abs(feature.value) / maxAbsValue) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground justify-center">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive"></div>Increases AQI (Bad)</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success"></div>Decreases AQI (Good)</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SHAPChart;
