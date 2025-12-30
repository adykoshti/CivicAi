import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PollutionSource {
  name: string;
  percentage: number;
  color: string;
}

interface PollutionSourceCardProps {
  sources: PollutionSource[];
}

const PollutionSourceCard = ({ sources }: PollutionSourceCardProps) => {
  const getBarColor = (color: string) => {
    switch (color) {
      case 'red': return 'bg-destructive';
      case 'blue': return 'bg-primary';
      case 'orange': return 'bg-warning';
      case 'green': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">Pollution Source Attribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sources.map((source) => (
            <div key={source.name} className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground w-16">{source.name}</span>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBarColor(source.color)}`}
                  style={{ width: `${source.percentage}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground w-12 text-right">{source.percentage}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PollutionSourceCard;
