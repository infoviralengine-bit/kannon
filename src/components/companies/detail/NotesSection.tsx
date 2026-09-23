import { useState } from "react";
import { Pin, PinOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDateTimeIt } from "@/lib/companies";
import { useDeleteNote, useSaveNote, type CompanyNote } from "@/hooks/useCompanyNotes";

export function NotesSection({ companyId, notes, formOpen, setFormOpen, authorName }: {
  companyId: string; notes: CompanyNote[]; formOpen: boolean; setFormOpen: (v: boolean) => void;
  authorName: (id: string | null) => string | undefined;
}) {
  const save = useSaveNote();
  const del = useDeleteNote();
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  return (
    <div className="space-y-2">
      {formOpen && (
        <div className="space-y-2">
          <Textarea autoFocus rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Scrivi un appunto" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button disabled={!body.trim() || save.isPending}
              onClick={() => save.mutate({ companyId, body: body.trim() }, { onSuccess: () => { setBody(""); setFormOpen(false); } })}>
              Salva appunto
            </Button>
          </div>
        </div>
      )}
      {notes.map((n) => (
        <div key={n.id} className={cn("rounded-lg border p-3", n.is_pinned ? "border-accent/50 bg-accent/5" : "border-border/50")}>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{n.is_pinned && <span className="mr-1 font-medium text-accent">Fissato ·</span>}
              {formatDateTimeIt(n.created_at)}{authorName(n.author_id) ? ` · ${authorName(n.author_id)}` : ""}</span>
            <div className="flex gap-0.5">
              <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Fissa"
                onClick={() => save.mutate({ id: n.id, companyId, isPinned: !n.is_pinned })}>
                {n.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Modifica"
                onClick={() => { setEditing(n.id); setEditBody(n.body); }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" aria-label="Elimina"
                onClick={() => del.mutate({ id: n.id, companyId })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {editing === n.id ? (
            <div className="mt-2 space-y-2">
              <Textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annulla</Button>
                <Button size="sm" disabled={!editBody.trim()}
                  onClick={() => save.mutate({ id: n.id, companyId, body: editBody.trim() }, { onSuccess: () => setEditing(null) })}>
                  Salva
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
          )}
        </div>
      ))}
      {!notes.length && !formOpen && <p className="text-sm text-muted-foreground">Nessun appunto.</p>}
    </div>
  );
}
