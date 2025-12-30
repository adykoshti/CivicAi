import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

interface MiniMapProps {
  city: string;
  state: string;
}

const MiniMap = ({ city, state }: MiniMapProps) => {
  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-card-foreground">Sensor Location</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative h-48 bg-gradient-to-br from-primary/5 to-primary/20">
          {/* Stylized map background */}
          <div className="absolute inset-0 opacity-30">
            <svg className="w-full h-full" viewBox="0 0 200 150">
              <path d="M20,80 Q50,20 100,60 T180,80" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary/50" />
              <path d="M10,100 Q60,60 120,90 T190,100" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary/50" />
              <path d="M30,120 Q80,80 140,110 T200,120" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary/50" />
            </svg>
          </div>
          
          {/* Map pin */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 animate-ping bg-primary/30 rounded-full w-8 h-8" />
              <div className="relative bg-primary rounded-full p-2">
                <MapPin className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          
          {/* Location label */}
          <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2">
            <p className="text-sm font-medium text-foreground">{city}, {state}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MiniMap;
