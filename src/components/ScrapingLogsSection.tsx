import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

type ScrapingLog = {
  id: string;
  run_at: string;
  status: string;
  accounts_processed: number;
  videos_created: number;
  videos_updated: number;
  error_message: string | null;
};

const STATUS_ICON: Record<string, string> = {
  success: "✅",
  error: "❌",
  partial: "⚠️",
};

export default function ScrapingLogsSection() {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    const { data } = await supabase
      .from("scraping_logs" as any)
      .select("*")
      .order("run_at", { ascending: false })
      .limit(20);
    setLogs((data as any) || []);
    setLoading(false);
  }

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">📊 Log Scraping</CardTitle>
            <CardDescription>Ultimi 20 run dello scraping TikTok automatico</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun log di scraping disponibile.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/ora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Account</TableHead>
                <TableHead className="text-right">Video nuovi</TableHead>
                <TableHead className="text-right">Video aggiornati</TableHead>
                <TableHead>Errore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(log.run_at).toLocaleString("it-IT")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        log.status === "success"
                          ? "bg-green-600/20 text-green-400 border-green-600/30"
                          : log.status === "error"
                          ? "bg-red-600/20 text-red-400 border-red-600/30"
                          : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                      }
                    >
                      {STATUS_ICON[log.status] || "?"} {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{log.accounts_processed}</TableCell>
                  <TableCell className="text-right">{log.videos_created}</TableCell>
                  <TableCell className="text-right">{log.videos_updated}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {log.error_message || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
