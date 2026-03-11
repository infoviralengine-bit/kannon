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
  MessageCircle, Video, ExternalLink, HelpCircle, Pencil, ChevronDown,
  Mail, AtSign, StickyNote, User, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  useCloserLeads,
  useOnboardingLinks,
  useUpdateLeadStatus,
  useCreateOnboardingLink,
  useDeleteCloserLead,
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

function useProfiles() {
  return useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function getOnboardingBaseUrl() {
  const host = window.location.hostname;
  // Preview URLs require Lovable login — use published URL for onboarding links
  if (host.includes("lovableproject.com") || host.startsWith("id-preview--")) {
    return "https://kannon.lovable.app";
  }
  return window.location.origin;
}

/* ── Lead Card Component ─────────────────────────────────── */

function LeadCard({
  lead,
  link,
  creatorName,
  onOutcome,
  onGenerateLink,
  onCopyLink,
  onDelete,
}: {
  lead: CloserLead;
  link?: { token: string; status: string } | null;
  creatorName?: string;
  onOutcome: (lead: CloserLead) => void;
  onGenerateLink: (lead: CloserLead) => void;
  onCopyLink: (token: string) => void;
  onDelete: (lead: CloserLead) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const callDate = new Date(lead.call_datetime);
  const isPast = callDate < new Date();

  const statusBadge = (status: string) => {
    switch (status) {
      case "interested":
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[11px] px-2 py-0.5"><CheckCircle className="h-3 w-3 mr-1" />Interessato</Badge>;
      case "not_interested":
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[11px] px-2 py-0.5"><XCircle className="h-3 w-3 mr-1" />Non interessato</Badge>;
      case "undecided":
        return <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[11px] px-2 py-0.5"><HelpCircle className="h-3 w-3 mr-1" />Indeciso</Badge>;
      default:
        return <Badge variant="secondary" className="text-[11px] px-2 py-0.5"><Clock className="h-3 w-3 mr-1" />In attesa</Badge>;
    }
  };

  const channelIcon = (channel: string) => {
    switch (channel) {
      case "google_meet": return <Video className="h-3.5 w-3.5" />;
      case "phone": return <Phone className="h-3.5 w-3.5" />;
      default: return <MessageCircle className="h-3.5 w-3.5" />;
    }
  };

  const channelLabel = (channel: string) => {
    switch (channel) {
      case "google_meet": return "Google Meet";
      case "phone": return "Telefonata";
      default: return "WhatsApp";
    }
  };

  // Primary action button
  const primaryAction = () => {
    if (lead.status === "pending" || lead.status === "undecided") {
      return (
        <Button size="sm" className="h-8 text-xs px-3" onClick={(e) => { e.stopPropagation(); onOutcome(lead); }}>
          Segna esito
        </Button>
      );
    }
    if (lead.status === "interested") {
      if (link) {
        return (
          <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={(e) => { e.stopPropagation(); onCopyLink(link.token); }}>
            <Copy className="h-3 w-3 mr-1.5" />Copia link
          </Button>
        );
      }
      return (
        <Button size="sm" className="h-8 text-xs px-3" onClick={(e) => { e.stopPropagation(); onGenerateLink(lead); }}>
          <LinkIcon className="h-3 w-3 mr-1.5" />Genera link
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-border bg-card transition-colors">
      {/* ── Compact view ── */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Left: name + status + meta */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Row 1: Name + Status */}
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {lead.first_name} {lead.last_name}
            </span>
            {statusBadge(lead.status)}
          </div>
          {/* Row 2: Date + Channel */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className={`flex items-center gap-1.5 ${isPast ? "text-muted-foreground" : "text-foreground font-medium"}`}>
              <Calendar className="h-3 w-3 shrink-0" />
              {format(callDate, "dd MMM yyyy · HH:mm", { locale: it })}
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5">
              {channelIcon(lead.call_channel)}
              {channelLabel(lead.call_channel)}
            </span>
          </div>
        </div>

        {/* Right: action + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {primaryAction()}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Expanded view ── */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-3 bg-muted/30">
          {/* Contacts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Telefono:</span>
                <span className="text-xs">{lead.phone}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Email:</span>
                <span className="text-xs truncate">{lead.email}</span>
              </div>
            )}
          </div>

          {/* TikTok */}
          {lead.tiktok_username && (
            <div className="flex items-center gap-2 text-sm">
              <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">TikTok:</span>
              <span className="text-xs text-foreground">@{lead.tiktok_username}</span>
            </div>
          )}

          {/* Meet Link */}
          {lead.call_channel === "google_meet" && lead.meet_link && (
            <div className="flex items-center gap-2 text-sm">
              <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Link Meet:</span>
              <a
                href={lead.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Apri <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Notes */}
          {lead.notes && (
            <div className="flex items-start gap-2 text-sm">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground">Note:</span>
              <span className="text-xs text-foreground">{lead.notes}</span>
            </div>
          )}

          {/* Created by */}
          <div className="flex items-center gap-2 text-sm pt-1 border-t border-border/50">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              Inserito da {creatorName || "Sconosciuto"} il {format(new Date(lead.created_at), "dd MMM yyyy", { locale: it })}
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(lead)}
            >
              <Trash2 className="h-3 w-3 mr-1.5" />Elimina
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-3"
              onClick={() => onOutcome(lead)}
            >
              <Pencil className="h-3 w-3 mr-1.5" />Modifica
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CloserPage() {
  const { data: leads = [], isLoading } = useCloserLeads();
  const { data: links = [] } = useOnboardingLinks();
  const { data: contracts = [] } = useContracts();
  const { data: profiles = [] } = useProfiles();
  const updateStatus = useUpdateLeadStatus();
  const createLink = useCreateOnboardingLink();
  const deleteLead = useDeleteCloserLead();

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
      const onboardingBaseUrl = getOnboardingBaseUrl();
      const url = `${onboardingBaseUrl}/onboarding/${link.token}`;
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
    const onboardingBaseUrl = getOnboardingBaseUrl();
    const url = `${onboardingBaseUrl}/onboarding/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiato!");
  };

  const getProfileName = (userId: string | null) => {
    if (!userId) return "Sconosciuto";
    const p = profiles.find(p => p.id === userId);
    return p?.full_name || "Sconosciuto";
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
                  {filteredLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      link={getLeadLink(lead.id)}
                      creatorName={getProfileName(lead.created_by)}
                      onOutcome={(l) => {
                        setSelectedLead(l);
                        setOutcomeNotes(l.notes || "");
                        setOutcomeDialog(true);
                      }}
                      onGenerateLink={(l) => {
                        setSelectedLead(l);
                        setContractDialog(true);
                      }}
                      onCopyLink={copyLink}
                      onDelete={(l) => {
                        if (confirm(`Eliminare il lead ${l.first_name} ${l.last_name}?`)) {
                          deleteLead.mutate(l.id, {
                            onSuccess: () => toast.success("Lead eliminato"),
                            onError: () => toast.error("Errore nell'eliminazione"),
                          });
                        }
                      }}
                    />
                  ))}
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
