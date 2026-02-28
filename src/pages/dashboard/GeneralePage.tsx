import { useNavigate } from "react-router-dom";
import { Eye, TrendingUp, Megaphone, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatViews, formatCurrency } from "@/lib/format";
import {
  useViewsToday, useViewsYesterday, useViewsMonth,
  useActiveCampaigns, useActiveCreators,
  useCampaignTable, useCreatorAlerts,
} from "@/hooks/useDashboardData";

function KpiCard({
  icon: Icon, label, value, sub, loading,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const statusColor: Record<string, string> = {
  active: "bg-green-600/20 text-green-400 border-green-600/30",
  paused: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
  completed: "bg-muted text-muted-foreground border-border",
};

const statusLabel: Record<string, string> = {
  active: "Attiva",
  paused: "In pausa",
  completed: "Completata",
};

export default function GeneralePage() {
  const navigate = useNavigate();
  const viewsToday = useViewsToday();
  const viewsYesterday = useViewsYesterday();
  const viewsMonth = useViewsMonth();
  const activeCampaigns = useActiveCampaigns();
  const activeCreators = useActiveCreators();
  const campaignTable = useCampaignTable();
  const alerts = useCreatorAlerts();

  const todayVal = viewsToday.data ?? 0;
  const yesterdayVal = viewsYesterday.data ?? 0;
  const diff = todayVal - yesterdayVal;
  const diffSign = diff >= 0 ? "+" : "";

  const kpiLoading = viewsToday.isLoading || viewsYesterday.isLoading || viewsMonth.isLoading || activeCampaigns.isLoading || activeCreators.isLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Eye}
          label="Views Oggi"
          value={formatViews(todayVal)}
          sub={`${diffSign}${formatViews(diff)} rispetto a ieri`}
          loading={kpiLoading}
        />
        <KpiCard
          icon={TrendingUp}
          label="Views Mese"
          value={formatViews(viewsMonth.data ?? 0)}
          loading={kpiLoading}
        />
        <KpiCard
          icon={Megaphone}
          label="Campagne Attive"
          value={String(activeCampaigns.data ?? 0)}
          loading={kpiLoading}
        />
        <KpiCard
          icon={Users}
          label="Creator Attivi"
          value={String(activeCreators.data ?? 0)}
          loading={kpiLoading}
        />
      </div>

      {/* Alerts */}
      {alerts.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (alerts.data?.length ?? 0) > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Alert Creator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {alerts.data!.map((a) => (
              <p key={a.creatorName} className="text-sm">
                <span className="font-semibold">{a.creatorName}</span> — {a.published}/{a.minimum} video pubblicati oggi
              </p>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-2 py-4">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm text-success">Tutti i creator sono in regola oggi ✓</span>
          </CardContent>
        </Card>
      )}

      {/* Campaign Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campagne</CardTitle>
        </CardHeader>
        <CardContent>
          {campaignTable.isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !campaignTable.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessuna campagna trovata.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views Totali</TableHead>
                  <TableHead className="text-right">Margine Mese</TableHead>
                  <TableHead className="text-right">Creator</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignTable.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.client_name}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[c.status] ?? ""}>
                        {statusLabel[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatViews(c.totalViews)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.margin)}</TableCell>
                    <TableCell className="text-right">{c.creatorCount}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}
                      >
                        Apri
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
