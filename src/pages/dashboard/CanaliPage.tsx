import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useChannelStats } from "@/hooks/useCompanyNotes";
import { useI18n } from "@/i18n";

const PERIODS: Record<string, string> = { "30d": "Ultimi 30 giorni", "90d": "Ultimi 90 giorni", year: "Quest'anno", all: "Sempre" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function CanaliPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("all");
  const { data = [], isLoading } = useChannelStats(period);

  const withLeads = data.filter((c) => c.leads > 0);
  const bestConv = [...withLeads].sort((a, b) => pct(b.won, b.leads) - pct(a.won, a.leads))[0];
  const bestValue = [...withLeads].sort((a, b) => Number(b.won_value) - Number(a.won_value))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t("Canali")}</h1>
          <p className="text-sm text-muted-foreground">{t("Da dove arrivano le lead e quanto convertono.")}</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PERIODS).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {bestConv && bestConv.won > 0 && (
        <p className="rounded-xl border border-border/50 bg-card p-3 text-sm">
          {t("Canale che converte meglio: {channel} ({pct}%).", { channel: bestConv.channel, pct: pct(bestConv.won, bestConv.leads) })}
          {bestValue && Number(bestValue.won_value) > 0 && <>{t(" Canale con più valore vinto: {channel} ({value}/mese).", { channel: bestValue.channel, value: formatCurrency(Number(bestValue.won_value)) })}</>}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="p-3">{t("Canale")}</th><th className="p-3 text-right">Lead</th>
                <th className="p-3 text-right">{t("Arrivate a call")}</th><th className="p-3 text-right">{t("Proposte")}</th>
                <th className="p-3 text-right">{t("Vinte")}</th><th className="p-3 text-right">{t("Conversione")}</th>
                <th className="p-3 text-right">{t("Valore vinto")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.channel} className="cursor-pointer border-b border-border/30 hover:bg-accent/5"
                  onClick={() => navigate(`/dashboard/clients/pipeline?channel=${encodeURIComponent(c.channel)}`)}>
                  <td className="p-3 font-medium">{c.channel}</td>
                  <td className="p-3 text-right tabular-nums">{c.leads}</td>
                  <td className="p-3 text-right tabular-nums">{c.calls} <span className="text-xs text-muted-foreground">({pct(c.calls, c.leads)}%)</span></td>
                  <td className="p-3 text-right tabular-nums">{c.proposals}</td>
                  <td className="p-3 text-right tabular-nums">{c.won}</td>
                  <td className="p-3 text-right font-medium tabular-nums">{pct(c.won, c.leads)}%</td>
                  <td className="p-3 text-right tabular-nums">{formatCurrency(Number(c.won_value))}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("Nessuna lead nel periodo.")}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
