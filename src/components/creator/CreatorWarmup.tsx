import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Flame } from "lucide-react";
import { WarmupAccount, useCompleteWarmupDay } from "@/hooks/useCreatorPortal";
import { toast } from "sonner";

const CHECKLIST = [
  "Ho seguito almeno 40 creator della mia nicchia",
  "Ho scorso la FYP per almeno 30 minuti",
  "Ho guardato i video fino alla fine",
  "Ho messo like, commentato e salvato contenuti",
  "Ho inviato 5-10 video a un amico o al mio account principale",
];

interface Props {
  accounts: WarmupAccount[];
  allDone: boolean;
  creatorName: string;
  creatorId: string;
}

function WarmupCard({ account }: { account: WarmupAccount }) {
  const [checked, setChecked] = useState<boolean[]>(new Array(CHECKLIST.length).fill(false));
  const allChecked = checked.every(Boolean);
  const completeDay = useCompleteWarmupDay();

  if (account.isReady) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-5 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
          <div>
            <TikTokLink username={account.username} className="font-semibold" />
            <p className="text-sm text-green-400">Account pronto ✅</p>
            <p className="text-xs text-muted-foreground">{account.campaignName}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (account.needsMoreFollowing) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <TikTokLink username={account.username} className="font-semibold" />
          </div>
          <p className="text-xs text-muted-foreground">{account.campaignName}</p>
          <p className="text-sm text-warning">
            Hai completato i 3 giorni ma hai ancora pochi following ({account.followingCount}/40). 
            Continua a seguire creator della tua nicchia — ci siamo quasi!
          </p>
        </CardContent>
      </Card>
    );
  }

  const day = account.warmupDay;
  const progress = (day / 3) * 100;

  const handleComplete = () => {
    completeDay.mutate(
      { accountId: account.id, currentDay: day },
      {
        onSuccess: (newDay) => {
          if (newDay >= 3) {
            toast.success("Warmup completato! 🎉");
          } else {
            toast.success(`Ottimo! Torna domani per il Giorno ${newDay + 1} 💪`);
          }
          setChecked(new Array(CHECKLIST.length).fill(false));
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base"><TikTokLink username={account.username} /></CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{account.campaignName}</p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Flame className="h-3 w-3" />
            Giorno {Math.min(day + 1, 3)} di 3
          </Badge>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground font-medium">Checklist di oggi:</p>
        {CHECKLIST.map((item, i) => (
          <label key={i} className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={checked[i]}
              onCheckedChange={(v) => {
                const next = [...checked];
                next[i] = !!v;
                setChecked(next);
              }}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
              {item}
            </span>
          </label>
        ))}
        <Button
          className="w-full mt-2"
          disabled={!allChecked || completeDay.isPending}
          onClick={handleComplete}
        >
          {completeDay.isPending ? "Salvataggio..." : "Ho completato le attività di oggi ✓"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CreatorWarmup({ accounts, allDone, creatorName, creatorId }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" /> Warmup
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Prepara i tuoi account TikTok prima di iniziare a pubblicare
        </p>
      </div>

      {allDone && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-5 text-center space-y-1">
            <p className="text-lg font-bold text-green-400">
              🚀 Tutti i tuoi account sono pronti!
            </p>
            <p className="text-sm text-muted-foreground">
              Le sezioni Contenuti, Calendario e Guadagni sono ora disponibili.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((acc) => (
          <WarmupCard key={acc.id} account={acc} />
        ))}
      </div>
    </div>
  );
}
