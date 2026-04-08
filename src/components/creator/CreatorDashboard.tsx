import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Video, TrendingUp, Smartphone, FileText, CheckCircle, XCircle } from "lucide-react";
import { AccountStats, EarningsData } from "@/hooks/useCreatorPortal";
import { formatCurrency, formatViews } from "@/lib/format";
import CreatorVideoList, { CreatorVideo } from "./CreatorVideoList";

interface Props {
  accountStats: AccountStats[];
  earnings: EarningsData;
  creatorName: string;
  monthLabel?: string;
  periodVideos?: CreatorVideo[];
}

export default function CreatorDashboard({ accountStats, earnings, creatorName, monthLabel = "questo mese", periodVideos = [] }: Props) {
  const hasContracts = earnings.contractBreakdowns.length > 0;

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
            <span className="text-2xl font-bold">{earnings.totalVideos}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Guadagno {monthLabel}</CardTitle>
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

      {/* Month stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Views {monthLabel}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{formatViews(earnings.monthViews)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Video {monthLabel}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{earnings.monthVideos}</span>
          </CardContent>
        </Card>
      </div>

      {/* Contract breakdowns */}
      {hasContracts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Dettaglio guadagni {monthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contratto</TableHead>
                  <TableHead className="text-right">Video</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Fisso</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Subtotale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.contractBreakdowns.map((b) => (
                  <TableRow key={b.contractId}>
                    <TableCell className="font-medium">{b.contractName}</TableCell>
                    <TableCell className="text-right">{b.videoCount}</TableCell>
                    <TableCell className="text-right">{b.monthlyTarget}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {b.fixedEarned ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {formatCurrency(b.fixedAmount)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">€{b.cpmRate.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{formatViews(b.totalViews)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(b.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 text-right">
              <span className="text-sm text-muted-foreground mr-2">Totale {monthLabel}:</span>
              <span className="text-lg font-bold">{formatCurrency(earnings.monthEarnings)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-account stats */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Smartphone className="h-4 w-4 text-primary" /> I tuoi account
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {accountStats.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <a
                    href={`https://www.tiktok.com/@${acc.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    @{acc.username}
                  </a>
                  <Badge variant="default">Attivo</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{acc.campaignName}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Views totali</p>
                    <p className="font-semibold">{formatViews(acc.totalViews)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Video totali</p>
                    <p className="font-semibold">{acc.totalVideos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Views {monthLabel}</p>
                    <p className="font-semibold">{formatViews(acc.monthViews)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Video {monthLabel}</p>
                    <p className="font-semibold">{acc.monthVideos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {accountStats.length === 0 && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Nessun account collegato
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Video list */}
      <CreatorVideoList videos={periodVideos} monthLabel={monthLabel} />
    </div>
  );
}
