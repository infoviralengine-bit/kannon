import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Sparkles, PartyPopper } from "lucide-react";

export default function OnboardingCompleted() {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(240,15%,5%)] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[hsl(254,100%,64%)]" />
          <span className="text-lg font-bold tracking-tight">Kannon</span>
        </div>
      </header>

      {/* Confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                fontSize: `${12 + Math.random() * 16}px`,
              }}
            >
              {["🎉", "🎊", "✨", "⭐", "🌟"][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Registrazione completata! 🎉</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Benvenuto nel team! Il tuo account è stato creato con successo.
              Ora puoi accedere alla tua area personale per monitorare i tuoi guadagni e le tue statistiche.
            </p>
          </div>

          <Button
            onClick={() => window.location.href = "/login"}
            className="bg-[hsl(254,100%,64%)] hover:bg-[hsl(254,100%,58%)] text-white px-8 py-3 text-base"
            size="lg"
          >
            <PartyPopper className="h-5 w-5 mr-2" />
            Accedi alla tua area
          </Button>
        </div>
      </main>
    </div>
  );
}
