import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ExternalLink, Plus, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOC_DIRECTION_LABEL, DOC_TYPES, DOC_TYPE_LABEL, formatDateIt, isOverdue,
  type DocDirection, type DocType,
} from "@/lib/companies";
import {
  openDocument, useDeleteDocument, useSaveDocument, useUploadDocument, type CompanyDocument,
} from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";

export function DocumentsTab({ companyId, documents }: { companyId: string; documents: CompanyDocument[] }) {
  const saveDoc = useSaveDocument();
  const [dialogFor, setDialogFor] = useState<DocDirection | null>(null);
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("altro");
  const [dueDate, setDueDate] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const openDialog = (direction: DocDirection) => {
    setName(""); setDocType("altro"); setDueDate(""); setLinkUrl("");
    setDialogFor(direction);
  };

  const submit = () => {
    if (!name.trim() || !dialogFor) return;
    saveDoc.mutate(
      {
        values: {
          company_id: companyId,
          name: name.trim(),
          direction: dialogFor,
          doc_type: docType,
          due_date: dueDate || null,
          link_url: linkUrl.trim() || null,
          status: "in_attesa",
        },
      },
      { onSuccess: () => setDialogFor(null) },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["da_inviare", "da_ricevere"] as DocDirection[]).map((dir) => (
        <Card key={dir}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{DOC_DIRECTION_LABEL[dir]}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => openDialog(dir)}>
              <Plus className="mr-1 h-4 w-4" /> Aggiungi
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.filter((d) => d.direction === dir).map((d) => (
              <DocumentRow key={d.id} doc={d} companyId={companyId} />
            ))}
            {!documents.filter((d) => d.direction === dir).length && (
              <p className="text-sm text-muted-foreground">Niente in lista.</p>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!dialogFor} onOpenChange={(v) => { if (!v) setDialogFor(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogFor ? DOC_DIRECTION_LABEL[dialogFor] : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. contratto firmato" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Scadenza</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Link</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFor(null)}>Annulla</Button>
            <Button onClick={submit} disabled={!name.trim() || saveDoc.isPending}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentRow({ doc, companyId }: { doc: CompanyDocument; companyId: string }) {
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const saveDoc = useSaveDocument();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const overdue = doc.status === "in_attesa" && isOverdue(doc.due_date);

  return (
    <div className={cn("rounded-md border border-border p-3", overdue && "border-destructive/50")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{doc.name}</p>
          <p className="text-xs text-muted-foreground">
            {DOC_TYPE_LABEL[doc.doc_type as DocType] ?? doc.doc_type}
            {doc.due_date && ` · entro ${formatDateIt(doc.due_date)}`}
          </p>
        </div>
        <Badge variant="outline" className={cn("text-[10px]",
          doc.status === "fatto"
            ? "bg-success/20 text-success border-success/30"
            : overdue ? "bg-destructive/20 text-destructive border-destructive/30" : "")}>
          {doc.status === "fatto" ? "Completato" : "In attesa"}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <input ref={inputRef} type="file" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate({ companyId, file, documentId: doc.id });
            e.target.value = "";
          }} />
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1 h-3 w-3" /> {doc.storage_path ? "Sostituisci" : "Carica"}
        </Button>
        {doc.storage_path && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => openDocument(doc.storage_path!).catch((e: Error) =>
              toast({ title: "Errore", description: e.message, variant: "destructive" }))}>
            <Download className="mr-1 h-3 w-3" /> Apri
          </Button>
        )}
        {doc.link_url && (
          <a href={doc.link_url} target="_blank" rel="noopener"
            className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:text-primary">
            <ExternalLink className="mr-1 h-3 w-3" /> Link
          </a>
        )}
        {doc.status === "in_attesa" ? (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => saveDoc.mutate({ id: doc.id, values: { company_id: companyId, status: "fatto" } })}>
            Segna completato
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => saveDoc.mutate({ id: doc.id, values: { company_id: companyId, status: "in_attesa" } })}>
            Rimetti in attesa
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2"
          onClick={() => remove.mutate({ id: doc.id, path: doc.storage_path, companyId })}>
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
