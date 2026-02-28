import { useAuth } from "@/contexts/AuthContext";
import { useClientAreaData } from "@/hooks/usePortalData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Eye, Users } from "lucide-react";
import { formatViews } from "@/lib/format";

export default function ClientArea() {
  const { profile, signOut } = useAuth();
  const { data, isLoading } = useClientAreaData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">K</div>
            <span className="font-semibold text-lg">Kannon</span>
          </div>
          <Skeleton className="h-8 w-24" />
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl space-y-6">
            <Skeleton className="h-10 w-64 mx-auto" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">K</div>
            <span className="font-semibold text-lg">Kannon</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Esci</Button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <h2 className="text-xl font-semibold mb-2">Nessuna campagna collegata</h2>
            <p className="text-muted-foreground">Contatta l'agenzia per collegare la tua campagna.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">K</div>
          <span className="font-semibold text-lg">Kannon</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Esci</Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-8 animate-fade-in text-center">
          <h1 className="text-3xl font-bold">{data.campaign.name}</h1>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="py-8">
              <CardContent className="flex flex-col items-center gap-3">
                <Eye className="h-8 w-8 text-primary" />
                <p className="text-4xl font-bold">{formatViews(data.totalViews)}</p>
                <p className="text-sm text-muted-foreground">Views Totali</p>
              </CardContent>
            </Card>
            <Card className="py-8">
              <CardContent className="flex flex-col items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <p className="text-4xl font-bold">{data.activeCreators}</p>
                <p className="text-sm text-muted-foreground">Creator Attivi</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">Dati aggiornati ogni 2 ore</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center">
        <p className="text-xs text-muted-foreground">Powered by Kannon</p>
      </footer>
    </div>
  );
}
