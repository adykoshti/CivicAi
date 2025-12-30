import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthRiskCardProps {
  level: string;
  description: string;
}

const HealthRiskCard = ({ level, description }: HealthRiskCardProps) => {
  const getIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return ShieldCheck;
      case 'moderate': return ShieldAlert;
      default: return AlertTriangle;
    }
  };

  const getColors = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return { bg: 'bg-success/10', icon: 'text-success', text: 'text-success' };
      case 'moderate': return { bg: 'bg-warning/10', icon: 'text-warning', text: 'text-warning' };
      default: return { bg: 'bg-destructive/10', icon: 'text-destructive', text: 'text-destructive' };
    }
  };

  const Icon = getIcon(level);
  const colors = getColors(level);

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">Health Risk</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className={cn('p-4 rounded-lg', colors.bg)}>
            <Icon className={cn('h-10 w-10', colors.icon)} />
          </div>
          <div>
            <h3 className={cn('text-2xl font-bold', colors.text)}>{level}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HealthRiskCard;
