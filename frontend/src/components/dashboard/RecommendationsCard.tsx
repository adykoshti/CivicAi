import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory, Bus, TreePine, AlertCircle } from 'lucide-react';

interface Recommendation {
  id: number;
  icon: string;
  title: string;
  priority: string;
}

interface RecommendationsCardProps {
  recommendations: Recommendation[];
}

const RecommendationsCard = ({ recommendations }: RecommendationsCardProps) => {
  const getIcon = (icon: string) => {
    switch (icon) {
      case 'factory': return Factory;
      case 'bus': return Bus;
      case 'tree': return TreePine;
      default: return AlertCircle;
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/10';
      case 'medium': return 'bg-warning/10';
      default: return 'bg-success/10';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      default: return 'text-success';
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">Action Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const Icon = getIcon(rec.icon);
            return (
              <div
                key={rec.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${getPriorityBg(rec.priority)}`}
              >
                <Icon className={`h-5 w-5 ${getPriorityIcon(rec.priority)}`} />
                <span className="text-sm font-medium text-foreground">{rec.title}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecommendationsCard;
