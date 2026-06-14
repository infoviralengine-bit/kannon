import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCampaignsLite, useCreatorsLite } from "@/hooks/useFilterOptions";
import type { VideoAnalyticsFilters as Filters } from "@/hooks/useVideoAnalytics";

type Preset = "7d" | "30d" | "90d" | "ytd" | "custom";

function presetRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today);
  if (preset === "7d") from.setDate(today.getDate() - 7);
  if (preset === "30d") from.setDate(today.getDate() - 30);
  if (preset === "90d") from.setDate(today.getDate() - 90);
  if (preset === "ytd") {
    from.setMonth(0);
    from.setDate(1);
  }
  return { from: from.toISOString().slice(0, 10), to };
}

export function VideoAnalyticsFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const [preset, setPreset] = useState<Preset>("30d");
  const { data: campaigns } = useCampaignsLite();
  const { data: creators } = useCreatorsLite();

  const setPresetAndRange = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") onChange({ ...value, ...presetRange(p) });
  };

  const toggleCampaign = (id: string) => {
    const set = new Set(value.campaignIds ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...value, campaignIds: Array.from(set) });
  };
  const toggleCreator = (id: string) => {
    const set = new Set(value.creatorIds ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...value, creatorIds: Array.from(set) });
  };

  const activeFiltersCount =
    (value.campaignIds?.length ?? 0) + (value.creatorIds?.length ?? 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-md border bg-card p-1">
        {(["7d", "30d", "90d", "ytd", "custom"] as Preset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPresetAndRange(p)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              preset === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "7d"
              ? "7 giorni"
              : p === "30d"
              ? "30 giorni"
              : p === "90d"
              ? "90 giorni"
              : p === "ytd"
              ? "YTD"
              : "Custom"}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-[150px]"
          />
          <span className="text-muted-foreground text-sm">→</span>
          <Input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-[150px]"
          />
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Campagne
            {value.campaignIds && value.campaignIds.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {value.campaignIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <ScrollArea className="h-[320px] p-2">
            {(campaigns ?? []).map((c) => {
              const checked = (value.campaignIds ?? []).includes(c.id);
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleCampaign(c.id)} />
                  <span className="text-sm flex-1 truncate">{c.name}</span>
                  {c.client_name && (
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {c.client_name}
                    </span>
                  )}
                </label>
              );
            })}
            {(campaigns ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground p-2">Nessuna campagna</p>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Creator
            {value.creatorIds && value.creatorIds.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {value.creatorIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <ScrollArea className="h-[320px] p-2">
            {(creators ?? []).map((c) => {
              const checked = (value.creatorIds ?? []).includes(c.id);
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleCreator(c.id)} />
                  <span className="text-sm flex-1 truncate">{c.name}</span>
                  {c.status && (
                    <Badge variant="outline" className="text-[10px]">
                      {c.status}
                    </Badge>
                  )}
                </label>
              );
            })}
            {(creators ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground p-2">Nessun creator</p>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...value, campaignIds: [], creatorIds: [] })}
          className="gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}