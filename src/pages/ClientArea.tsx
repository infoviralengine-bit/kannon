import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientArea() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Area Cliente</h1>
          <Button variant="ghost" onClick={signOut}>Esci</Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Benvenuto, {profile?.full_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">La tua area personale sarà disponibile prossimamente.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
