import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Lock, Coins, Eye, TrendingUp, CalendarClock } from "lucide-react";
import { EarningsData } from "@/hooks/useCreatorPortal";
import { formatCurrency, formatViews } from "@/lib/format";

interface Props {
  earnings: EarningsData;
  locked: boolean;
}

export default function CreatorEarnings({ earnings, locked }: Props) {
  if (locked) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center space-y-2">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-semibold">🔒 Disponibile dopo il warmup</p>
          <p className="text-sm text-muted-foreground">
            I tuoi guadagni saranno visibili qui dopo il completamento del warmup.
          </p>
        </CardContent>
      </Card>
    );
  }

  const nextPayment = earnings.payments.find((p) => !p.isPaid);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" /> I tuoi guadagni
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Guadagno mese</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{formatCurrency(earnings.monthEarnings)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Guadagno totale</CardTitle></CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{formatCurrency(earnings.totalEarnings)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Views totali</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{formatViews(earnings.totalViews)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Prossimo pagamento</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span className="text-lg font-bold">{nextPayment ? nextPayment.period : "—"}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Storico pagamenti</CardTitle></CardHeader>
        <CardContent>
          {!earnings.payments.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun pagamento registrato</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Lordo</TableHead>
                  <TableHead className="text-right">Ritenuta 20%</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.payments.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.period}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.gross)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.tax)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(p.net)}</TableCell>
                    <TableCell>
                      <Badge variant={p.isPaid ? "default" : "secondary"}>
                        {p.isPaid ? "Pagato" : "In attesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("it-IT") : "—"}
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
