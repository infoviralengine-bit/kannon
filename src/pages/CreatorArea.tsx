import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorPortal } from "@/hooks/useCreatorPortal";
import { getCurrentPeriodNumber, parseContractStartDate } from "@/lib/contractPeriods";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Flame, FileText, CalendarDays, Coins, Lock, LayoutDashboard, ChevronLeft, ChevronRight } from "lucide-react";
import CreatorWelcome from "@/components/creator/CreatorWelcome";
import CreatorWarmup from "@/components/creator/CreatorWarmup";
import CreatorDashboard from "@/components/creator/CreatorDashboard";
import CreatorEarnings from "@/components/creator/CreatorEarnings";
import { ComingSoon } from "@/components/ComingSoon";

type Section = "dashboard" | "warmup" | "contenuti" | "calendario" | "guadagni";

export default function CreatorArea() {
  const { profile, signOut } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>(undefined);
  const { data, isLoading } = useCreatorPortal(selectedPeriod);
  const [section, setSection] = useState<Section>("dashboard");
  const [showWelcome, setShowWelcome] = useState(false);

  const isOperativo = data?.isOperativo ?? false;

  useEffect(() => {
    if (data?.isFirstVisit && !isOperativo) {
      setShowWelcome(true);
    }
  }, [data?.isFirstVisit, isOperativo]);

  // Set default section based on status
  useEffect(() => {
    if (data) {
      if (isOperativo) {
        setSection("dashboard");
      } else {
        setSection("warmup");
      }
    }
  }, [data, isOperativo]);

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

  const unlocked = data.unlocked;

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

  // Build nav items based on status
  const NAV_ITEMS: { key: Section; label: string; icon: typeof Flame }[] = isOperativo
    ? [
        { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { key: "guadagni", label: "Guadagni", icon: Coins },
        { key: "contenuti", label: "Contenuti", icon: FileText },
        { key: "calendario", label: "Calendario", icon: CalendarDays },
      ]
    : [
        { key: "warmup", label: "Warmup", icon: Flame },
        { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { key: "contenuti", label: "Contenuti", icon: FileText },
        { key: "calendario", label: "Calendario", icon: CalendarDays },
        { key: "guadagni", label: "Guadagni", icon: Coins },
      ];

  const currentPeriod = selectedPeriod ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <Header name={profile?.full_name ?? null} onSignOut={signOut} />

      {/* Navigation */}
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const isLocked = !isOperativo && item.key !== "warmup" && !unlocked;
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

          {/* Period selector */}
          <div className="flex items-center gap-1 ml-4 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedPeriod(Math.max(1, currentPeriod - 1))}
              disabled={currentPeriod <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
              Periodo {currentPeriod}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedPeriod(currentPeriod + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 animate-fade-in">
        {section === "warmup" && !isOperativo && (
          <CreatorWarmup
            accounts={data.warmupAccounts}
            allDone={data.allWarmupDone}
            creatorName={data.creator.name}
            creatorId={data.creator.id}
          />
        )}
        {section === "dashboard" && (
          <CreatorDashboard
            accountStats={data.accountStats}
            earnings={data.earnings}
            creatorName={data.creator.name}
            monthLabel={`Periodo ${currentPeriod}`}
          />
        )}
        {section === "contenuti" && (
          <ComingSoon icon={FileText} title="Contenuti" />
        )}
        {section === "calendario" && (
          <ComingSoon icon={CalendarDays} title="Calendario" />
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
