import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, BarChart3, Wifi, Shield, Target, Users } from 'lucide-react';

const About = () => {
  const technologies = [
    {
      icon: Brain,
      title: 'Machine Learning',
      description: 'Hybrid models combining Random Forest and BiLSTM for accurate AQI predictions with high confidence levels.',
    },
    {
      icon: BarChart3,
      title: 'SHAP Explainability',
      description: 'Transparent AI decisions with SHAP values showing feature importance and model interpretability.',
    },
    {
      icon: Wifi,
      title: 'IoT Integration',
      description: 'Real-time data from distributed air quality sensors providing continuous monitoring across cities.',
    },
    {
      icon: Shield,
      title: 'Secure Infrastructure',
      description: 'Enterprise-grade security with encrypted data transmission and secure API endpoints.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              About CivicAI
            </h1>
            <p className="text-lg text-muted-foreground">
              Empowering cities with AI-driven environmental intelligence for healthier, 
              more sustainable communities.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Our Mission</h2>
              <p className="text-muted-foreground mb-4">
                CivicAI is dedicated to revolutionizing how cities understand and respond to 
                air quality challenges. By combining cutting-edge machine learning with 
                real-time IoT sensor data, we provide actionable insights that help 
                protect public health and guide environmental policy.
              </p>
              <p className="text-muted-foreground">
                Our platform bridges the gap between complex environmental data and 
                practical decision-making, making air quality intelligence accessible 
                to city officials, health organizations, and citizens alike.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-background border-border text-center p-6">
                <Target className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-foreground">95%</h3>
                <p className="text-sm text-muted-foreground">Prediction Accuracy</p>
              </Card>
              <Card className="bg-background border-border text-center p-6">
                <Wifi className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-foreground">500+</h3>
                <p className="text-sm text-muted-foreground">IoT Sensors</p>
              </Card>
              <Card className="bg-background border-border text-center p-6">
                <Users className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-foreground">50+</h3>
                <p className="text-sm text-muted-foreground">Cities Covered</p>
              </Card>
              <Card className="bg-background border-border text-center p-6">
                <BarChart3 className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-foreground">1M+</h3>
                <p className="text-sm text-muted-foreground">Daily Predictions</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Why CivicAI Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why CivicAI?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Traditional air quality monitoring provides data, but CivicAI provides intelligence. 
              Here's what sets us apart.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Predictive, Not Reactive</h3>
              <p className="text-muted-foreground">
                Our hybrid ML models don't just report current conditions—they predict 
                future air quality with high accuracy, giving cities time to act proactively.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Transparent AI</h3>
              <p className="text-muted-foreground">
                SHAP explainability ensures you understand exactly why our models make 
                their predictions, building trust and enabling informed decisions.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Health-Focused</h3>
              <p className="text-muted-foreground">
                Beyond numbers, we translate AQI data into actionable health recommendations 
                that protect vulnerable populations.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Scalable Infrastructure</h3>
              <p className="text-muted-foreground">
                From single neighborhoods to entire metropolitan areas, CivicAI scales 
                seamlessly to meet your coverage needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Technology Overview</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built on a foundation of advanced machine learning and modern web technologies.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {technologies.map((tech) => (
              <Card key={tech.title} className="bg-background border-border">
                <CardContent className="pt-6 text-center">
                  <div className="mb-4 p-3 rounded-lg bg-primary/10 w-fit mx-auto">
                    <tech.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{tech.title}</h3>
                  <p className="text-sm text-muted-foreground">{tech.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            © 2025 CivicAI. AI-Powered Environmental Intelligence for Smarter Cities.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default About;
