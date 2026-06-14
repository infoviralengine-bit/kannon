import { Trophy, Video, MessageSquare, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatViews } from "@/lib/format";
import { STATUS_META, formatDateIt } from "./_helpers";
import type { Brief } from "@/hooks/useContentCalendar";

export function BriefCard({ brief, onClick }: { brief: Brief; onClick: () => void }) {
  const meta = STATUS_META[brief.status];
  const heading = brief.title || (brief.copy_text ? brief.copy_text.split("\n")[0] : "Brief");
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md border border-border bg-card p-2 hover:border-primary/50 hover:shadow-sm transition-colors space-y-1"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted-foreground">{formatDateIt(brief.planned_publish_date)}</span>
        <span className={cn("h-2 w-2 rounded-full shrink-0", meta.dot)} title={meta.label} />
      </div>
      <p className="text-xs font-medium leading-tight line-clamp-2">{heading}</p>
      <div className="flex flex-wrap items-center gap-1">
        {brief.format_name && (
          <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">{brief.format_name}</span>
        )}
        {brief.is_winner && (
          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-medium text-emerald-600">
            <Trophy className="h-2.5 w-2.5" /> Winner
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
        {brief.matched_videos_count > 0 && (
          <span className="inline-flex items-center gap-0.5"><Video className="h-2.5 w-2.5" />{brief.matched_videos_count}</span>
        )}
        {brief.matched_videos_count > 0 && (
          <span>{formatViews(brief.total_effective_views)} views</span>
        )}
        {brief.comments_count_open > 0 && (
          <span className="inline-flex items-center gap-0.5 text-amber-600"><MessageSquare className="h-2.5 w-2.5" />{brief.comments_count_open}</span>
        )}
        {brief.change_requests_count_pending > 0 && (
          <span className="inline-flex items-center gap-0.5 text-red-500"><GitPullRequest className="h-2.5 w-2.5" />{brief.change_requests_count_pending}</span>
        )}
      </div>
    </button>
  );
}
