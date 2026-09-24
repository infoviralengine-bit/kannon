import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatDateIt } from "@/lib/companies";
import type { CompanyCampaign } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

export function CampaignsTab({ campaigns }: { campaigns: CompanyCampaign[] }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/campaigns")}>
          <Plus className="mr-1 h-4 w-4" /> {t("Nuova campagna")}
        </Button>
      </div>
      {campaigns.map((c) => (
        <Card key={c.id} className="cursor-pointer hover:border-primary/50"
          onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{t("Dal {date}", { date: formatDateIt(c.start_date) })}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {c.client_fixed != null && <span>{t("Fisso {value}", { value: formatCurrency(Number(c.client_fixed)) })}</span>}
              {c.client_cpm != null && <span>{t("CPM {value}", { value: formatCurrency(Number(c.client_cpm)) })}</span>}
              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      {!campaigns.length && <p className="text-sm text-muted-foreground">{t("Nessuna campagna collegata.")}</p>}
    </div>
  );
}
