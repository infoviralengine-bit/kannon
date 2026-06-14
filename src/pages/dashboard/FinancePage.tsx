import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceData, FinancePeriod, useDeleteEntry } from "@/hooks/useFinanceData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { AddEntryDialog } from "@/components/finance/AddEntryDialog";
import { CashEditDialog } from "@/components/finance/CashEditDialog";
import { MovementsTable } from "@/components/finance/MovementsTable";
import { RecurringExpensesCard } from "@/components/finance/RecurringExpensesCard";
import { ReceivableTab } from "@/components/finance/ReceivableTab";
import { PayableTab } from "@/components/finance/PayableTab";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  month: "Mese corrente",
  "3m": "Ultimi 3 mesi",
  "6m": "Ultimi 6 mesi",
  year: "Anno",
};

const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
};

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("it-IT") : "—";

function KpiCard({ label, value, hint, accent, action }: { label: string; value: React.ReactNode; hint?: string; accent?: "positive" | "negative" | "warning"; action?: React.ReactNode }) {
  const accentClass = accent === "positive" ? "text-emerald-400" : accent === "negative" ? "text-red-400" : accent === "warning" ? "text-amber-400" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accentClass}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const STATUS_LABEL: Record<string, string> = {
  expected: "Previsto", confirmed: "Confermato", received: "Ricevuto", paid: "Pagato", overdue: "Scaduta",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  expected: "outline", confirmed: "secondary", received: "default", paid: "default", overdue: "destructive",
};

export default function FinancePage() {
  const { role } = useAuth();
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const { data, isLoading, error } = useFinanceData(period);
  const deleteEntry = useDeleteEntry();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "cash";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    setSearchParams({ tab: v }, { replace: true });
  };

  if (role && role !== "admin") return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Panoramica finanziaria</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border bg-card p-1">
            {(Object.keys(PERIOD_LABELS) as FinancePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <AddEntryDialog />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted/40 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => handleTabChange("receivable")}
              className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 hover:bg-muted"
            >
              <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-400" />
              Pagamenti da ricevere
            </button>
            <button
              onClick={() => handleTabChange("payable")}
              className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 hover:bg-muted"
            >
              <ArrowUpCircle className="h-3.5 w-3.5 text-amber-400" />
              Pagamenti da fare
            </button>
          </div>

          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="cash">Cash</TabsTrigger>
            <TabsTrigger value="receivable">Da Ricevere</TabsTrigger>
            <TabsTrigger value="payable">Da Pagare</TabsTrigger>
            <TabsTrigger value="movements">Movimenti</TabsTrigger>
            <TabsTrigger value="revenue">Ricavi</TabsTrigger>
            <TabsTrigger value="costs">Costi</TabsTrigger>
            <TabsTrigger value="margins">Margini</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>

          {/* RECEIVABLE */}
          <TabsContent value="receivable" className="space-y-6">
            <ReceivableTab />
          </TabsContent>

          {/* PAYABLE */}
          <TabsContent value="payable" className="space-y-6">
            <PayableTab />
          </TabsContent>

          {/* MOVEMENTS */}
          <TabsContent value="movements" className="space-y-6">
            <MovementsTable />
          </TabsContent>

          {/* CASH */}
          <TabsContent value="cash" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Cash in bank"
                value={data.cash.in_bank == null ? <span className="text-base text-muted-foreground">Non impostato</span> : formatCurrency(data.cash.in_bank)}
                hint={data.cash.updated_at ? `Aggiornato ${fmtDate(data.cash.updated_at)}` : undefined}
                action={<CashEditDialog current={data.cash.in_bank} trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />}
              />
              <KpiCard label="Burn mensile" value={formatCurrency(data.cash.burn_monthly || 0)} hint="Costi del mese corrente" />
              <KpiCard
                label="Runway"
                value={data.cash.runway_months == null ? "—" : `${data.cash.runway_months.toFixed(1)} mesi`}
                hint="Cash / burn medio 3m"
                accent={data.cash.runway_months != null && data.cash.runway_months < 3 ? "negative" : undefined}
              />
              <KpiCard label="Cash atteso" value={formatCurrency(data.cash.cash_expected || 0)} hint="Fatture non pagate" />
            </div>

            <Card>
              <CardHeader><CardTitle>Flussi previsti</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tipo</TableHead><TableHead>Descrizione</TableHead><TableHead className="text-right">Importo</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.flows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessun flusso previsto</TableCell></TableRow>}
                    {data.flows.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell><Badge variant={f.type.startsWith("revenue") || f.type === "invoice_out" ? "default" : "secondary"}>{f.type === "revenue" || f.type === "invoice_out" ? "Entrata" : "Uscita"}</Badge></TableCell>
                        <TableCell>{f.description || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(f.amount))}</TableCell>
                        <TableCell>{fmtDate(f.date)}</TableCell>
                        <TableCell><Badge variant={STATUS_VARIANT[f.status]}>{STATUS_LABEL[f.status]}</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => deleteEntry.mutate(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Fatture</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>N. fattura</TableHead><TableHead>Brand</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Importo</TableHead><TableHead>Emissione</TableHead><TableHead>Scadenza</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.invoices.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessuna fattura</TableCell></TableRow>}
                    {data.invoices.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono">{inv.invoice_number || "—"}</TableCell>
                        <TableCell>{inv.brand_name || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{inv.type === "invoice_out" ? "Emessa" : "Ricevuta"}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(inv.amount))}</TableCell>
                        <TableCell>{fmtDate(inv.date)}</TableCell>
                        <TableCell>{fmtDate(inv.due_date)}</TableCell>
                        <TableCell><Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVENUE */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Revenue MTD" value={formatCurrency(data.revenue.mtd || 0)} />
              <KpiCard
                label="MoM"
                value={data.revenue.mom_pct == null ? "—" : `${data.revenue.mom_pct > 0 ? "+" : ""}${data.revenue.mom_pct.toFixed(1)}%`}
                accent={data.revenue.mom_pct != null ? (data.revenue.mom_pct >= 0 ? "positive" : "negative") : undefined}
                hint={`Prec: ${formatCurrency(data.revenue.prev_month || 0)}`}
              />
              <KpiCard
                label="Top brand"
                value={<div className="text-sm space-y-0.5">
                  {(data.revenue.top_brands || []).slice(0, 3).map((b) => (
                    <div key={b.brand} className="flex justify-between gap-3"><span className="truncate">{b.brand}</span><span className="font-mono">{formatCurrency(Number(b.revenue))}</span></div>
                  ))}
                  {(!data.revenue.top_brands || data.revenue.top_brands.length === 0) && <span className="text-muted-foreground">—</span>}
                </div>}
              />
              <KpiCard label="Pipeline (weighted)" value={formatCurrency((data.revenue.pipeline || 0) * 0.5)} hint={`Totale: ${formatCurrency(data.revenue.pipeline || 0)}`} />
            </div>

            <Card>
              <CardHeader><CardTitle>Ricavi mensili (ultimi 6 mesi)</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={data.revenue.monthly.map((m) => ({ ...m, label: fmtMonth(m.month) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Ricavi per campagna</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Campagna</TableHead><TableHead>Brand</TableHead><TableHead className="text-right">Fisso</TableHead><TableHead className="text-right">Variabile</TableHead><TableHead className="text-right">Totale</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.revenue.by_campaign.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessun dato</TableCell></TableRow>}
                    {data.revenue.by_campaign.map((r: any) => (
                      <TableRow key={r.campaign_id}>
                        <TableCell>{r.campaign}</TableCell>
                        <TableCell>{r.brand || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(r.revenue_fixed))}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(r.revenue_variable))}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(Number(r.revenue_total))}</TableCell>
                        <TableCell>
                          <Badge variant={r.all_paid ? "default" : r.any_paid ? "secondary" : "outline"}>
                            {r.all_paid ? "Pagato" : r.any_paid ? "Parziale" : "Da pagare"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COSTS */}
          <TabsContent value="costs" className="space-y-6">
            <RecurringExpensesCard />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {["creator_pay", "operator_pay", "tool", "software", "other"].map((cat) => {
                const found = data.costs.by_category.find((c) => c.category === cat);
                const label = cat === "creator_pay" ? "Creator" : cat === "operator_pay" ? "Operator" : cat === "tool" ? "Tool" : cat === "software" ? "Software" : "Altri";
                return <KpiCard key={cat} label={`Costo ${label}`} value={formatCurrency(Number(found?.amount ?? 0))} />;
              })}
            </div>

            <Card>
              <CardHeader><CardTitle>Trend costi mensili</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={data.costs.monthly.map((m) => ({ ...m, label: fmtMonth(m.month) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="cost" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Costi per categoria</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Importo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.costs.by_category.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nessun costo</TableCell></TableRow>}
                    {data.costs.by_category.map((c) => (
                      <TableRow key={c.category}><TableCell className="capitalize">{c.category.replace("_", " ")}</TableCell><TableCell className="text-right font-mono">{formatCurrency(Number(c.amount))}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MARGINS */}
          <TabsContent value="margins" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard label="Margine lordo" value={formatCurrency(data.margins.gross || 0)} accent={data.margins.gross >= 0 ? "positive" : "negative"} />
              <KpiCard label="Margine %" value={`${data.margins.gross_pct.toFixed(1)}%`} accent={data.margins.gross_pct >= 0 ? "positive" : "negative"} />
              <KpiCard label="P&L" value={formatCurrency(data.margins.pl || 0)} hint={`Ricavi ${formatCurrency(data.margins.total_revenue)} − Costi ${formatCurrency(data.margins.total_costs)}`} accent={data.margins.pl >= 0 ? "positive" : "negative"} />
            </div>

            <Card>
              <CardHeader><CardTitle>Margine per campagna</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Campagna</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Costo creator</TableHead><TableHead className="text-right">Costo operator</TableHead><TableHead className="text-right">Margine</TableHead><TableHead className="text-right">%</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.margins.by_campaign.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessun dato</TableCell></TableRow>}
                    {data.margins.by_campaign.map((r: any) => {
                      const neg = Number(r.margin) < 0;
                      return (
                        <TableRow key={r.campaign_id} className={neg ? "bg-destructive/5" : ""}>
                          <TableCell className="flex items-center gap-2">{neg && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}{r.campaign}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(r.revenue))}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(r.creator_cost))}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(r.operator_cost))}</TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${neg ? "text-destructive" : "text-emerald-400"}`}>{formatCurrency(Number(r.margin))}</TableCell>
                          <TableCell className={`text-right font-mono ${neg ? "text-destructive" : ""}`}>{Number(r.margin_pct).toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Margine per creator</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Creator</TableHead><TableHead className="text-right">Costo</TableHead><TableHead className="text-right">Revenue generato</TableHead><TableHead className="text-right">Margine</TableHead><TableHead className="text-right">%</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.margins.by_creator.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessun dato</TableCell></TableRow>}
                    {data.margins.by_creator.map((r: any) => {
                      const neg = Number(r.margin) < 0;
                      return (
                        <TableRow key={r.creator_id} className={neg ? "bg-destructive/5" : ""}>
                          <TableCell className="flex items-center gap-2">{neg && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}{r.creator}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(r.cost))}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Number(r.revenue))}</TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${neg ? "text-destructive" : "text-emerald-400"}`}>{formatCurrency(Number(r.margin))}</TableCell>
                          <TableCell className={`text-right font-mono ${neg ? "text-destructive" : ""}`}>{Number(r.margin_pct).toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FORECAST */}
          <TabsContent value="forecast" className="space-y-6">
            {data.cash.runway_months != null && data.cash.runway_months < 3 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Runway critico</AlertTitle>
                <AlertDescription>Il runway nello scenario pessimistico è inferiore a 3 mesi ({data.cash.runway_months.toFixed(1)} mesi).</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader><CardTitle>Forecast 90 giorni — 3 scenari</CardTitle></CardHeader>
              <CardContent style={{ height: 360 }}>
                {data.forecast.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Dati insufficienti per il forecast. Aggiungi entrate/uscite con date future.
                  </div>
                ) : (
                  <ResponsiveContainer>
                    <LineChart data={data.forecast.map((f) => ({
                      date: new Date(f.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
                      Pessimistico: Number(f.pessimistic),
                      Base: Number(f.base),
                      Ottimistico: Number(f.optimistic),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Line type="monotone" dataKey="Pessimistico" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Base" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Ottimistico" stroke="rgb(52, 211, 153)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" />Pessimistico</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(Number(data.forecast.at(-1)?.pessimistic ?? 0))}</div><div className="text-xs text-muted-foreground">solo revenue confermata</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />Base</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(Number(data.forecast.at(-1)?.base ?? 0))}</div><div className="text-xs text-muted-foreground">+ pipeline weighted (50%)</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" />Ottimistico</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(Number(data.forecast.at(-1)?.optimistic ?? 0))}</div><div className="text-xs text-muted-foreground">+ full pipeline</div></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}