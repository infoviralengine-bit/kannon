import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Video, TrendingUp, Smartphone } from "lucide-react";
import { WarmupAccount, EarningsData } from "@/hooks/useCreatorPortal";
import { formatCurrency, formatViews } from "@/lib/format";

interface Props {
  accounts: WarmupAccount[];
  earnings: EarningsData;
  creatorName: string;
  totalVideos: number;
}

export default function CreatorDashboard({ accounts, earnings, creatorName, totalVideos }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Ciao {creatorName} 👋</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ecco un riepilogo delle tue performance
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Views totali</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{formatViews(earnings.totalViews)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Video pubblicati</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{totalVideos}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Guadagno mese</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{formatCurrency(earnings.monthEarnings)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Guadagno totale</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{formatCurrency(earnings.totalEarnings)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Accounts */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Smartphone className="h-4 w-4 text-primary" /> I tuoi account
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <a
                    href={`https://www.tiktok.com/@${acc.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    @{acc.username}
                  </a>
                  <p className="text-xs text-muted-foreground mt-0.5">{acc.campaignName}</p>
                </div>
                <Badge variant={acc.isReady ? "default" : "secondary"}>
                  {acc.isReady ? "Attivo" : "Warmup"}
                </Badge>
              </CardContent>
            </Card>
          ))}
          {accounts.length === 0 && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Nessun account collegato
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
