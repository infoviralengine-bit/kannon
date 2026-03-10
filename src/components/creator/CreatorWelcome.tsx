import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, Flame, Video, Eye, Coins } from "lucide-react";

interface Props {
  creatorName: string;
  onStart: () => void;
}

const steps = [
  { icon: Flame, label: "Scalda gli account", desc: "3 giorni di warmup per preparare TikTok" },
  { icon: Video, label: "Ricevi i contenuti", desc: "Brief e script pronti da realizzare" },
  { icon: Eye, label: "Pubblica", desc: "Segui il calendario e pubblica i video" },
  { icon: Coins, label: "Guadagna", desc: "Ogni view si trasforma in guadagni reali" },
];

export default function CreatorWelcome({ creatorName, onStart }: Props) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-lg w-full space-y-8 text-center animate-fade-in">
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">
            Benvenuto in Kannon, {creatorName}! 🎉
          </h1>
          <p className="text-muted-foreground">
            Ecco cosa ti aspetta per iniziare a guadagnare
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {steps.map((step, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold text-sm">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button size="lg" className="w-full text-base" onClick={onStart}>
          Inizia 🚀
        </Button>
      </div>
    </div>
  );
}
