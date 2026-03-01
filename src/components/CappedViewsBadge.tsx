import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield } from "lucide-react";

/**
 * Small inline badge indicating views are capped for CPM calculation.
 * Variant "inline" = subtle text suffix, "icon" = shield icon with tooltip.
 */
export function CappedBadge({ variant = "inline" }: { variant?: "inline" | "icon" }) {
  if (variant === "icon") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Shield className="inline h-3.5 w-3.5 text-primary/60 ml-1 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[200px]">
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
          <span className="text-[10px] font-medium text-primary/60 uppercase tracking-wider ml-1 cursor-help">
            entro cap
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          Visualizzazioni limitate dal cap video per il calcolo CPM
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
