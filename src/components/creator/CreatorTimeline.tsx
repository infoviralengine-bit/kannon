import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface Milestone {
  label: string;
  description: string;
  date: string | null;
  status: "completed" | "active" | "pending";
}

function formatItalianDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function useCreatorTimeline(creatorId: string) {
  return useQuery({
    queryKey: ["creator-timeline", creatorId],
    queryFn: async () => {
      // Fetch creator
      const { data: creator } = await supabase
        .from("creators")
        .select("id, name, email, phone, created_at, profile_id")
        .eq("id", creatorId)
        .single();

      if (!creator) return [] as Milestone[];

      // Fetch related data in parallel
      const [
        { data: accounts },
        { data: onboardingLinks },
        { data: signatures },
      ] = await Promise.all([
        supabase.from("tiktok_accounts").select("warmup_day, warmup_started_at, following_count").eq("creator_id", creatorId),
        supabase.from("onboarding_links").select("created_at, completed_at, status").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(1),
        supabase.from("contract_signatures").select("signed_at").eq("creator_id", creatorId).order("signed_at", { ascending: true }).limit(1),
      ]);

      // Try to find linked lead via email
      let leadData: { created_at: string; status: string; call_datetime: string | null } | null = null;
      if (creator.email) {
        const { data: leads } = await supabase
          .from("closer_leads")
          .select("created_at, status, call_datetime")
          .eq("email", creator.email)
          .order("created_at", { ascending: false })
          .limit(1);
        if (leads?.length) leadData = leads[0];
      }

      // Get profile created_at (onboarding completed = account created)
      let profileCreatedAt: string | null = null;
      if (creator.profile_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("created_at")
          .eq("id", creator.profile_id)
          .single();
        if (profile) profileCreatedAt = profile.created_at;
      }

      const link = onboardingLinks?.[0] ?? null;
      const sig = signatures?.[0] ?? null;
      const allAccounts = accounts ?? [];
      const allWarmupDone = allAccounts.length > 0 && allAccounts.every(a => a.warmup_day >= 3 && a.following_count >= 40);
      const anyWarmupStarted = allAccounts.some(a => a.warmup_started_at);
      const earliestWarmupStart = allAccounts
        .filter(a => a.warmup_started_at)
        .sort((a, b) => new Date(a.warmup_started_at!).getTime() - new Date(b.warmup_started_at!).getTime())[0]?.warmup_started_at ?? null;

      // Determine the latest warmup completion time (approximate: warmup_started_at + 3 days)
      let warmupCompletedAt: string | null = null;
      if (allWarmupDone && allAccounts.length > 0) {
        // Use the latest warmup_started_at + rough estimate
        const latestStart = allAccounts
          .filter(a => a.warmup_started_at)
          .sort((a, b) => new Date(b.warmup_started_at!).getTime() - new Date(a.warmup_started_at!).getTime())[0]?.warmup_started_at;
        warmupCompletedAt = latestStart ?? null;
      }

      const callDone = leadData?.status === "done" || leadData?.status === "signed";

      // Build milestones
      const milestones: Milestone[] = [
        {
          label: "Lead acquisito",
          description: leadData ? "Lead creato nel sistema closer" : "Nessun lead collegato trovato",
          date: leadData?.created_at ?? null,
          status: leadData ? "completed" : "pending",
        },
        {
          label: "Call completata",
          description: callDone ? "Call di onboarding completata" : "In attesa della call",
          date: callDone ? (leadData?.call_datetime ?? leadData?.created_at ?? null) : null,
          status: callDone ? "completed" : leadData ? "active" : "pending",
        },
        {
          label: "Link onboarding inviato",
          description: link ? "Link di onboarding generato e inviato" : "Link non ancora inviato",
          date: link?.created_at ?? null,
          status: link ? "completed" : "pending",
        },
        {
          label: "Dati personali inseriti",
          description: creator.created_at ? "Profilo creator creato durante l'onboarding" : "Dati non ancora inseriti",
          date: creator.created_at ?? null,
          status: creator.created_at ? "completed" : "pending",
        },
        {
          label: "Contratto firmato",
          description: sig ? "Contratto firmato digitalmente" : "In attesa della firma",
          date: sig?.signed_at ?? null,
          status: sig ? "completed" : "pending",
        },
        {
          label: "Account creato",
          description: profileCreatedAt ? "Account utente creato — onboarding completato" : "Account non ancora creato",
          date: profileCreatedAt ?? null,
          status: profileCreatedAt ? "completed" : "pending",
        },
        {
          label: "Warmup iniziato",
          description: anyWarmupStarted ? "Warmup degli account TikTok avviato" : "Warmup non ancora iniziato",
          date: earliestWarmupStart,
          status: anyWarmupStarted ? "completed" : "pending",
        },
        {
          label: "Warmup completato",
          description: allWarmupDone ? "Tutti gli account hanno completato il warmup" : "Warmup in corso",
          date: warmupCompletedAt,
          status: allWarmupDone ? "completed" : anyWarmupStarted ? "active" : "pending",
        },
        {
          label: "Operativo",
          description: allWarmupDone ? "Il creator è operativo e pronto a pubblicare" : "Non ancora operativo",
          date: null,
          status: allWarmupDone ? "active" : "pending",
        },
      ];

      // Fix: mark the first pending after completed chain as active (if not already set)
      let foundPending = false;
      for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].status === "pending" && !foundPending) {
          // Only override if no milestone is already "active"
          if (!milestones.some(m => m.status === "active")) {
            milestones[i].status = "active";
          }
          foundPending = true;
        }
      }

      return milestones;
    },
    enabled: !!creatorId,
  });
}

export default function CreatorTimeline({ creatorId }: { creatorId: string }) {
  const { data: milestones, isLoading } = useCreatorTimeline(creatorId);

  if (isLoading) return <div className="space-y-4 py-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  if (!milestones?.length) return <p className="text-sm text-muted-foreground py-8 text-center">Nessun dato disponibile per il percorso.</p>;

  return (
    <div className="relative py-4 pl-8">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-6 bottom-6 w-[2px] bg-border" />

      <div className="space-y-1">
        {milestones.map((m, i) => (
          <div key={i} className="relative flex items-start gap-4 py-3">
            {/* Icon */}
            <div className="absolute left-[-25px] mt-0.5">
              {m.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : m.status === "active" ? (
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
              ) : (
                <Circle className="h-5 w-5 text-muted" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 ${m.status === "pending" ? "opacity-40" : ""}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-sm font-semibold ${
                  m.status === "completed" ? "text-foreground" :
                  m.status === "active" ? "text-blue-400" :
                  "text-muted-foreground"
                }`}>
                  {m.label}
                </span>
                {m.status === "active" && m.label === "Operativo" && (
                  <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">In corso</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
              {m.date && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">{formatItalianDate(m.date)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
