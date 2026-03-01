import { useState } from "react";
import { Eye, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatCurrency, formatViews } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { useCpmPayoffData } from "@/hooks/useCpmPayoffData";
import { CappedBadge } from "@/components/CappedViewsBadge";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export default function PayoffPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = useCpmPayoffData(year, month);
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Payoff CPM</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section 1: KPI Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                Views Totali Periodo <CappedBadge variant="icon" />
              </CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatViews(data?.kpi.totalViews ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CPM Cliente (€)</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-success">{formatCurrency(data?.kpi.clientCpmTotal ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CPM Creator (€)</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(data?.kpi.creatorCpmTotal ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className={(data?.kpi.marginCpm ?? 0) >= 0 ? "border-success/50" : "border-destructive/50"}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Margine CPM (€)</CardTitle>
              <DollarSign className={`h-4 w-4 ${(data?.kpi.marginCpm ?? 0) >= 0 ? "text-success" : "text-destructive"}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(data?.kpi.marginCpm ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(data?.kpi.marginCpm ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Line chart: daily views */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (data?.dailyViews?.length ?? 0) > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Views Giornaliere — {MONTHS[month]} {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data!.dailyViews}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tickFormatter={(v: string) => {
                    const d = parseInt(v.split("-")[2], 10);
                    return String(d);
                  }}
                />
                <YAxis className="text-xs" tickFormatter={(v) => formatViews(v)} />
                <Tooltip
                  formatter={(value: number) => [formatViews(value), "Views"]}
                  labelFormatter={(label: string) => {
                    const parts = label.split("-");
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* Section 2: Campaign Detail */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Dettaglio per Campagna</h2>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : !data?.campaignRows.length ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nessuna campagna attiva nel periodo selezionato
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {data.campaignRows.map((camp) => (
              <AccordionItem key={camp.campaignId} value={camp.campaignId} className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{camp.name}</span>
                      <Badge variant="secondary" className="text-xs font-normal">{camp.clientName}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{formatViews(camp.viewsPeriod)} views <CappedBadge /></span>
                      <span className={camp.marginCpm >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                        {formatCurrency(camp.marginCpm)}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-4">
                  {/* Campaign CPM metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center">Views periodo <CappedBadge variant="icon" /></p>
                      <p className="font-semibold text-lg">{formatViews(camp.viewsPeriod)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CPM Cliente (€{camp.clientCpm}/1k)</p>
                      <p className="font-semibold text-lg text-success">{formatCurrency(camp.clientCpmAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CPM Creator</p>
                      <p className="font-semibold text-lg text-destructive">{formatCurrency(camp.creatorCpmAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Margine CPM</p>
                      <p className={`font-semibold text-lg ${camp.marginCpm >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(camp.marginCpm)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Views</p>
                      <p className="text-sm">
                        <span className="text-success">{formatViews(camp.viewsDefinitive)} definitive</span>
                        {" · "}
                        <span className="text-warning">{formatViews(camp.viewsProvvisorie)} provvisorie</span>
                      </p>
                    </div>
                  </div>

                  {/* Weekly bar chart */}
                  {camp.weeklyViews.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Views per settimana</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={camp.weeklyViews}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="week" className="text-xs" />
                          <YAxis className="text-xs" tickFormatter={(v) => formatViews(v)} />
                          <Tooltip
                            formatter={(value: number) => [formatViews(value), "Views"]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />
                          <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Section 3: Creator CPM Detail */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Dettaglio CPM per Creator</h2>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : !data?.creatorRows.length ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nessun creator con views nel periodo selezionato
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Campagna</TableHead>
                  <TableHead className="text-right">Views totali</TableHead>
                  <TableHead className="text-right">Definitive</TableHead>
                  <TableHead className="text-right">Provvisorie</TableHead>
                  <TableHead className="text-right">CPM maturato (€)</TableHead>
                  <TableHead>Dettaglio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.creatorRows.map((cr, idx) => (
                  <TableRow key={`${cr.creatorId}-${cr.campaignId}-${idx}`}>
                    <TableCell
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() => navigate(`/dashboard/creators/${cr.creatorId}`)}
                    >
                      {cr.creatorName}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:underline"
                      onClick={() => navigate(`/dashboard/campaigns/${cr.campaignId}`)}
                    >
                      {cr.campaignName}
                    </TableCell>
                    <TableCell className="text-right">{formatViews(cr.viewsPeriod)}</TableCell>
                    <TableCell className="text-right text-success">{formatViews(cr.viewsDefinitive)}</TableCell>
                    <TableCell className="text-right text-warning">{formatViews(cr.viewsProvvisorie)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(cr.cpmAmount)}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {cr.videoDefinitivi} definitivi + {cr.videoProvvisori} provvisori
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
