import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorPortal } from "@/hooks/useCreatorPortal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Flame, FileText, CalendarDays, Coins, Lock } from "lucide-react";
import CreatorWelcome from "@/components/creator/CreatorWelcome";
import CreatorWarmup from "@/components/creator/CreatorWarmup";
import CreatorContent from "@/components/creator/CreatorContent";
import CreatorCalendar from "@/components/creator/CreatorCalendar";
import CreatorEarnings from "@/components/creator/CreatorEarnings";

type Section = "warmup" | "contenuti" | "calendario" | "guadagni";

const NAV_ITEMS: { key: Section; label: string; icon: typeof Flame }[] = [
  { key: "warmup", label: "Warmup", icon: Flame },
  { key: "contenuti", label: "Contenuti", icon: FileText },
  { key: "calendario", label: "Calendario", icon: CalendarDays },
  { key: "guadagni", label: "Guadagni", icon: Coins },
];

export default function CreatorArea() {
  const { profile, signOut } = useAuth();
  const { data, isLoading } = useCreatorPortal();
  const [section, setSection] = useState<Section>("warmup");
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (data?.isFirstVisit) {
      setShowWelcome(true);
    }
  }, [data?.isFirstVisit]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header name={null} onSignOut={signOut} />
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header name={profile?.full_name ?? null} onSignOut={signOut} />
        <div className="max-w-2xl mx-auto p-6 text-center mt-20">
          <h2 className="text-xl font-semibold mb-2">Nessun profilo creator collegato</h2>
          <p className="text-muted-foreground">Contatta l'agenzia per collegare il tuo account.</p>
        </div>
      </div>
    );
  }

  const unlocked = data.anyWarmupDone;

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-background">
        <Header name={profile?.full_name ?? null} onSignOut={signOut} />
        <div className="max-w-4xl mx-auto p-6">
          <CreatorWelcome
            creatorName={data.creator.name}
            onStart={() => setShowWelcome(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header name={profile?.full_name ?? null} onSignOut={signOut} />

      {/* Navigation */}
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isLocked = item.key !== "warmup" && !unlocked;
            const isActive = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {isLocked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <item.icon className="h-3.5 w-3.5" />
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 animate-fade-in">
        {section === "warmup" && (
          <CreatorWarmup
            accounts={data.warmupAccounts}
            allDone={data.allWarmupDone}
            creatorName={data.creator.name}
            creatorId={data.creator.id}
          />
        )}
        {section === "contenuti" && (
          <CreatorContent content={data.content} locked={!unlocked} />
        )}
        {section === "calendario" && (
          <CreatorCalendar calendar={data.calendar} locked={!unlocked} />
        )}
        {section === "guadagni" && (
          <CreatorEarnings earnings={data.earnings} locked={!unlocked} />
        )}
      </div>
    </div>
  );
}

function Header({ name, onSignOut }: { name: string | null; onSignOut: () => void }) {
  return (
    <header className="border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">K</div>
        <span className="font-semibold text-lg">Kannon</span>
      </div>
      <div className="flex items-center gap-3">
        {name && <span className="text-sm text-muted-foreground">{name}</span>}
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />Esci
        </Button>
      </div>
    </header>
  );
}
