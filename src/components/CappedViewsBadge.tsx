import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck } from "lucide-react";

/**
 * Small inline badge indicating views are capped for CPM calculation.
 * Variant "inline" = subtle pill badge, "icon" = shield icon with tooltip.
 */
export function CappedBadge({ variant = "inline" }: { variant?: "inline" | "icon" }) {
  if (variant === "icon") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 ml-1 shrink-0 cursor-help">
              <ShieldCheck className="h-3 w-3 text-primary" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[220px]">
            Views conteggiate entro il cap video per il calcolo CPM
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded px-1.5 py-0.5 ml-1 cursor-help uppercase tracking-wider leading-none">
            <ShieldCheck className="h-2.5 w-2.5" />
            cap
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          Visualizzazioni limitate dal cap video per il calcolo CPM
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
