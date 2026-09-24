// ============= Vista Radar · Orbital glass pipeline (palette Kannon chiara) =============

import { useMemo, useState } from "react";
import { PIPELINE_STAGES, STAGE_LABEL, type CompanyStage } from "@/lib/companies";
import { formatCurrency } from "@/lib/format";
import type { Company } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

interface Props {
  companies: Company[];
  onOpenCompany: (id: string) => void;
}

const SIZE = 800;
const C = SIZE / 2;
const R = C - 40;
// Dal centro (trattativa) verso l'esterno (nuova). Le vinte non appaiono nel radar.
const RINGS: CompanyStage[] = [...PIPELINE_STAGES].filter((s) => s !== "vinto").reverse();
const BAND = R / RINGS.length;

// Scala colore: rosso (centro) → viola → blu (esterno), coerente col gradiente
const RED: [number, number, number] = [255, 39, 39];
const PURPLE: [number, number, number] = [168, 85, 200];
const BLUE: [number, number, number] = [59, 130, 246];

function ringColor(ringIdx: number): string {
  const t = RINGS.length <= 1 ? 0 : ringIdx / (RINGS.length - 1);
  const lerp = (a: [number, number, number], b: [number, number, number], k: number) =>
    a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const rgb = t < 0.5 ? lerp(RED, PURPLE, t * 2) : lerp(PURPLE, BLUE, (t - 0.5) * 2);
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

function displayName(c: Company) {
  return c.app_name || c.name;
}

export function PipelineRadar({ companies, onOpenCompany }: Props) {
  const { t } = useI18n();
  const [hover, setHover] = useState<string | null>(null);
  const active = companies.filter((c) => c.stage !== "perso" && c.stage !== "vinto");
  const hidden = companies.length - active.length;
  const totalValue = active.reduce((s, c) => s + Number(c.estimated_monthly_value ?? 0), 0);

  const nodes = useMemo(() => {
    const byStage = new Map<CompanyStage, Company[]>();
    active.forEach((c) => {
      const s = c.stage as CompanyStage;
      byStage.set(s, [...(byStage.get(s) ?? []), c]);
    });
    const out: { c: Company; x: number; y: number; ringIdx: number }[] = [];
    RINGS.forEach((stage, ringIdx) => {
      const list = byStage.get(stage) ?? [];
      const offset = ringIdx * 0.9;
      list.forEach((c, i) => {
        const angle = offset + (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const radius = ringIdx === 0 && list.length === 1 ? 0 : ringIdx * BAND + BAND / 2;
        out.push({ c, x: C + Math.cos(angle) * radius, y: C + Math.sin(angle) * radius, ringIdx });
      });
    });
    return out;
  }, [active]);

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("Più una lead è vicina al centro, più è vicina alla chiusura.")}
          {hidden > 0 && <span className="block">{t("{n} lead vinte o perse non mostrate", { n: hidden })}</span>}
        </p>
        <div className="flex gap-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "rgb(59 130 246)" }} /> {t("Nuove")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" /> {t("In chiusura")}
          </span>
        </div>
      </div>

      {/* Radar */}
      <div className="mx-auto w-full max-w-[800px]">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-full shadow-sm"
          style={{
            background:
              "radial-gradient(circle at center, rgb(255 39 39 / 0.10) 0%, rgb(168 85 200 / 0.07) 55%, rgb(59 130 246 / 0.07) 100%)",
          }}
        >
          {/* Anelli orbitali, più marcati verso il centro */}
          {RINGS.map((_, ringIdx) => {
            const scale = 1 - (ringIdx * BAND) / C;
            const color = ringColor(ringIdx);
            return (
              <div
                key={ringIdx}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: `${scale * 100}%`,
                  aspectRatio: "1",
                  transform: "translate(-50%, -50%)",
                  border: `1px solid ${color}${ringIdx <= 2 ? "55" : "30"}`,
                  background:
                    ringIdx <= 2 ? `radial-gradient(circle, ${color}12 0%, transparent 70%)` : undefined,
                  animation: ringIdx === 0 ? "pulse 2.5s ease-in-out infinite" : undefined,
                }}
              />
            );
          })}

          {/* Crosshair */}
          <div className="absolute left-0 top-1/2 h-px w-full bg-black/5" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-black/5" />

          {/* Lead: pill orbitali */}
          {nodes.map(({ c, x, y, ringIdx }) => {
            const isHover = hover === c.id;
            const px = (x / SIZE) * 100;
            const py = (y / SIZE) * 100;
            const color = ringColor(ringIdx);
            return (
              <div
                key={c.id}
                className="group absolute z-10"
                style={{ left: `${px}%`, top: `${py}%`, transform: "translate(-50%, -50%)" }}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover(null)}
              >
                <button
                  onClick={() => onOpenCompany(c.id)}
                  className="flex cursor-pointer flex-col items-center gap-1.5 transition-transform hover:scale-110 active:scale-95"
                >
                  <span
                    className="block h-7 w-7 rounded-full border-2 transition-shadow"
                    style={{
                      background: color,
                      borderColor: "rgba(255,255,255,0.9)",
                      boxShadow: isHover
                        ? `0 0 0 3px white, 0 4px 18px ${color}60`
                        : `0 0 10px ${color}50`,
                    }}
                  />
                  <span className="block text-center text-[11px] font-semibold uppercase leading-none tracking-wider text-black/70">
                    {displayName(c)}
                  </span>
                </button>
                {isHover && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2">
                    <div className="whitespace-nowrap rounded bg-black px-3 py-2 text-[11px] text-white shadow-xl">
                      <p className="font-bold uppercase">{t(STAGE_LABEL[c.stage as CompanyStage])}</p>
                      <p className="opacity-80">
                        {t("Valore: {value}", { value: formatCurrency(Number(c.estimated_monthly_value ?? 0)) })}
                      </p>
                    </div>
                    <div className="mx-auto -mt-1 h-2 w-2 rotate-45 bg-black" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* HUD riepilogo */}
      <div className="mx-auto mt-4 flex w-full max-w-[800px] items-center justify-center gap-8 rounded-2xl border border-border/40 bg-surface px-10 py-4">
        <div className="px-4 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("Valore totale")}
          </span>
          <span className="text-2xl font-light tracking-tight">{formatCurrency(totalValue)}</span>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="px-4 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("Lead attive")}
          </span>
          <span className="text-2xl font-light tracking-tight">{active.length}</span>
        </div>
      </div>
    </div>
  );
}
