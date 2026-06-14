import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyableField } from "./CopyableField";
import { STATUS_META, formatDateIt } from "@/components/content-calendar/_helpers";
import type { PortalBrief } from "@/hooks/useClientBriefs";

export function CreatorBriefCard({ brief }: { brief: PortalBrief }) {
  const meta = STATUS_META[brief.status];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge className={`${meta.badge} text-sm px-3 py-1`}>{meta.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {formatDateIt(brief.planned_publish_date, { day: "numeric", month: "long" })}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-tight">{brief.title || "Brief"}</h3>
          {brief.format_name && <Badge variant="secondary">{brief.format_name}</Badge>}
        </div>

        {brief.reference_links.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">Riferimenti</p>
            <div className="flex flex-col gap-1">
              {brief.reference_links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                  {l.label} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>
        )}

        <CopyableField label="Copy (testo da dire)" value={brief.copy_text} copyLabel="Copy copiato" />
        {brief.caption && <CopyableField label="Caption" value={brief.caption} copyLabel="Caption copiata" />}
        {brief.hashtags.length > 0 && (
          <CopyableField label="Hashtag" value={brief.hashtags.map((h) => `#${h}`).join(" ")} copyLabel="Hashtag copiati" />
        )}
        {brief.visual_note && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">Note visuali</p>
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-sm">{brief.visual_note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
