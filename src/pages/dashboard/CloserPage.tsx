import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, CheckCircle, XCircle, Link as LinkIcon, Copy, Clock, Calendar,
  MessageCircle, Video, ExternalLink, HelpCircle, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  useCloserLeads,
  useOnboardingLinks,
  useUpdateLeadStatus,
  useCreateOnboardingLink,
  type CloserLead,
} from "@/hooks/useCloserData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useContracts() {
  return useQuery({
    queryKey: ["contracts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, name, creator_cpm, creator_fixed, min_videos_per_day")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function CloserPage() {
  const { data: leads = [], isLoading } = useCloserLeads();
  const { data: links = [] } = useOnboardingLinks();
  const { data: contracts = [] } = useContracts();
  const updateStatus = useUpdateLeadStatus();
  const createLink = useCreateOnboardingLink();

  const [selectedLead, setSelectedLead] = useState<CloserLead | null>(null);
  const [outcomeDialog, setOutcomeDialog] = useState(false);
  const [contractDialog, setContractDialog] = useState(false);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredLeads = filterStatus === "all"
    ? leads
    : leads.filter(l => l.status === filterStatus);

  const pendingLeads = leads.filter(l => l.status === "pending");
  const interestedLeads = leads.filter(l => l.status === "interested");

  const handleOutcome = async (status: "interested" | "not_interested" | "undecided") => {
    if (!selectedLead) return;
    try {
      await updateStatus.mutateAsync({
        id: selectedLead.id,
        status,
        notes: outcomeNotes || undefined,
      });
      const labels: Record<string, string> = { interested: "Interessato", not_interested: "Non interessato", undecided: "Indeciso" };
      toast.success(`Segnato come ${labels[status]}`);
      setOutcomeDialog(false);
      setOutcomeNotes("");
      if (status === "interested") {
        setContractDialog(true);
      } else {
        setSelectedLead(null);
      }
    } catch {
      toast.error("Errore nell'aggiornamento");
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedLead || selectedContracts.length === 0) return;
    try {
      const link = await createLink.mutateAsync({
        lead_id: selectedLead.id,
        contract_ids: selectedContracts,
      });
      const url = `${window.location.origin}/onboarding/${link.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copiato negli appunti!");
      setContractDialog(false);
      setSelectedContracts([]);
      setSelectedLead(null);
    } catch {
      toast.error("Errore nella generazione del link");
    }
  };

  const getLeadLink = (leadId: string) => links.find(l => l.lead_id === leadId);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/onboarding/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiato!");
  };

  const sourceBadge = (source: string) =>
    source === "calendly" ? (
      <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">
        <Calendar className="h-3 w-3 mr-1" /> Calendly
      </Badge>
    ) : (
      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
        <Phone className="h-3 w-3 mr-1" /> Outreach
      </Badge>
    );

  const channelBadge = (channel: string, meetLink?: string | null) => {
    switch (channel) {
      case "google_meet":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
            <Video className="h-3 w-3 mr-1" /> Google Meet
            {meetLink && (
              <a href={meetLink} target="_blank" rel="noopener noreferrer" className="ml-1" onClick={e => e.stopPropagation()}>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </Badge>
        );
      case "phone":
        return (
          <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">
            <Phone className="h-3 w-3 mr-1" /> Telefonata
          </Badge>
        );
      default:
        return (
          <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
            <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
          </Badge>
        );
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "interested":
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Interessato</Badge>;
      case "not_interested":
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Non interessato</Badge>;
      case "undecided":
        return <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30"><HelpCircle className="h-3 w-3 mr-1" /> Indeciso</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> In attesa</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Closer</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestisci le call e i lead in arrivo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{leads.length}</p>
                <p className="text-xs text-muted-foreground">Lead totali</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{interestedLeads.length}</p>
                <p className="text-xs text-muted-foreground">Interessati</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingLeads.length}</p>
                <p className="text-xs text-muted-foreground">In attesa</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">Lead</TabsTrigger>
          <TabsTrigger value="links">Link Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          {/* Filter */}
          <div className="flex items-center gap-3 mb-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="pending">In attesa</SelectItem>
                <SelectItem value="interested">Interessati</SelectItem>
                <SelectItem value="undecided">Indecisi</SelectItem>
                <SelectItem value="not_interested">Non interessati</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : filteredLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun lead trovato.</p>
          ) : (
                <div className="space-y-3">
                  {filteredLeads.map(lead => {
                    const link = getLeadLink(lead.id);
                    const callDate = new Date(lead.call_datetime);
                    const isPast = callDate < new Date();
                    return (
                      <div
                        key={lead.id}
                        className="rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors overflow-hidden"
                      >
                        {/* Top row: name + status + actions */}
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {lead.first_name} {lead.last_name}
                            </h3>
                            {statusBadge(lead.status)}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setSelectedLead(lead);
                                setOutcomeNotes(lead.notes || "");
                                setOutcomeDialog(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {lead.status === "interested" && !link && (
                              <Button
                                size="sm"
                                className="h-7 text-xs px-2.5"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setContractDialog(true);
                                }}
                              >
                                <LinkIcon className="h-3 w-3 mr-1" /> Genera link
                              </Button>
                            )}
                            {link && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2.5"
                                onClick={() => copyLink(link.token)}
                              >
                                <Copy className="h-3 w-3 mr-1" /> Copia link
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Bottom row: meta info */}
                        <div className="flex items-center gap-3 px-4 pb-3 flex-wrap text-xs text-muted-foreground">
                          <span className={`flex items-center gap-1 ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
                            <Calendar className="h-3 w-3" />
                            {format(callDate, "dd MMM · HH:mm", { locale: it })}
                          </span>
                          {channelBadge(lead.call_channel, lead.meet_link)}
                          {(lead.phone || lead.email) && (
                            <span className="truncate">
                              {lead.phone || lead.email}
                            </span>
                          )}
                          {lead.tiktok_username && (
                            <span className="truncate">@{lead.tiktok_username}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Link di onboarding generati</CardTitle>
            </CardHeader>
            <CardContent>
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun link generato.</p>
              ) : (
                <div className="space-y-3">
                  {links.map(link => {
                    const lead = leads.find(l => l.id === link.lead_id);
                    return (
                      <div
                        key={link.id}
                        className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary/30"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {lead ? `${lead.first_name} ${lead.last_name}` : "Lead sconosciuto"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Creato il {format(new Date(link.created_at), "dd/MM/yyyy HH:mm")}
                            {" • "}{link.contract_ids.length} contratt{link.contract_ids.length === 1 ? "o" : "i"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {link.status === "completed" ? (
                            <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
                              <CheckCircle className="h-3 w-3 mr-1" /> Completato
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" /> In attesa
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyLink(link.token)}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copia
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Outcome Dialog */}
      <Dialog open={outcomeDialog} onOpenChange={setOutcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esito della call</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedLead.first_name} {selectedLead.last_name} —{" "}
                {format(new Date(selectedLead.call_datetime), "dd MMM yyyy HH:mm", { locale: it })}
              </p>
              <div className="space-y-2">
                <Label>Note (opzionali)</Label>
                <Textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="Appunti sulla call..."
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => handleOutcome("not_interested")}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Non interessato
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => handleOutcome("undecided")}
                  disabled={updateStatus.isPending}
                >
                  <HelpCircle className="h-4 w-4 mr-2" /> Indeciso
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleOutcome("interested")}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Interessato
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract Assignment Dialog */}
      <Dialog open={contractDialog} onOpenChange={setContractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna contratti e genera link</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Seleziona i contratti per {selectedLead.first_name} {selectedLead.last_name}
              </p>
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun contratto attivo disponibile.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {contracts.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-secondary/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedContracts.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setSelectedContracts(prev =>
                            checked
                              ? [...prev, c.id]
                              : prev.filter(id => id !== c.id)
                          );
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          CPM €{c.creator_cpm} • Fisso €{c.creator_fixed} • Min {c.min_videos_per_day} video/giorno
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialog(false)}>Annulla</Button>
            <Button
              onClick={handleGenerateLink}
              disabled={selectedContracts.length === 0 || createLink.isPending}
            >
              <LinkIcon className="h-4 w-4 mr-1" />
              Genera e copia link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
