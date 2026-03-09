import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOutreachTemplates, useAddTemplate, useUpdateTemplate, useDeleteTemplate } from "@/hooks/useOutreachData";

export function OutreachTemplatesAdmin() {
  const { data: templates = [], isLoading } = useOutreachTemplates(true);
  const addTemplate = useAddTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addTemplate.mutateAsync({ name: newName.trim(), content: newContent.trim() });
      toast.success("Template creato");
      setNewName("");
      setNewContent("");
      setAddOpen(false);
    } catch {
      toast.error("Errore nella creazione");
    }
  };

  const openEdit = (tpl: typeof templates[0]) => {
    setEditId(tpl.id);
    setEditName(tpl.name);
    setEditContent(tpl.content);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await updateTemplate.mutateAsync({ id: editId, name: editName, content: editContent });
      toast.success("Template aggiornato");
      setEditOpen(false);
    } catch {
      toast.error("Errore nell'aggiornamento");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gestisci i template di messaggi per il team outreach</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuovo Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo template</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Es. Intro Casual" />
              </div>
              <div className="space-y-2">
                <Label>Contenuto</Label>
                <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Testo del messaggio..." rows={5} />
              </div>
              <Button onClick={handleAdd} disabled={!newName.trim()} className="w-full">Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica template</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contenuto</Label>
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={5} />
            </div>
            <Button onClick={handleEdit} className="w-full">Salva modifiche</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates list */}
      <div className="grid gap-3">
        {templates.map(tpl => (
          <Card key={tpl.id}>
            <CardContent className="py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                  {!tpl.is_active && <Badge variant="secondary" className="text-xs">Disattivato</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{tpl.content || "Nessun contenuto"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tpl)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Switch
                  checked={tpl.is_active}
                  onCheckedChange={(checked) => updateTemplate.mutate({ id: tpl.id, is_active: checked })}
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Nessun template creato. Creane uno per iniziare.</p>
        )}
      </div>
    </div>
  );
}
