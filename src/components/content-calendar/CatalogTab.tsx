import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  useVideoFormats,
  useContentTopics,
  useCreateFormat,
  useRenameFormat,
  useToggleFormatActive,
  useDeleteFormat,
  useCreateTopic,
  useRenameTopic,
  useToggleTopicActive,
  useDeleteTopic,
  type CatalogItem,
} from "@/hooks/useContentCatalog";
import type { UseMutationResult } from "@tanstack/react-query";
import { useI18n } from "@/i18n";

export default function CatalogTab() {
  const { t } = useI18n();
  const formats = useVideoFormats();
  const topics = useContentTopics();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CatalogCard
        title={t("Format")}
        items={formats.data ?? []}
        isLoading={formats.isLoading}
        useCreate={useCreateFormat}
        useRename={useRenameFormat}
        useToggle={useToggleFormatActive}
        useDelete={useDeleteFormat}
      />
      <CatalogCard
        title={t("Topic")}
        items={topics.data ?? []}
        isLoading={topics.isLoading}
        useCreate={useCreateTopic}
        useRename={useRenameTopic}
        useToggle={useToggleTopicActive}
        useDelete={useDeleteTopic}
      />
    </div>
  );
}

type CrudHook<TVars> = () => UseMutationResult<unknown, unknown, TVars, unknown>;

function CatalogCard({
  title,
  items,
  isLoading,
  useCreate,
  useRename,
  useToggle,
  useDelete,
}: {
  title: string;
  items: CatalogItem[];
  isLoading: boolean;
  useCreate: CrudHook<string>;
  useRename: CrudHook<{ id: string; name: string }>;
  useToggle: CrudHook<{ id: string; is_active: boolean }>;
  useDelete: CrudHook<string>;
}) {
  const { t } = useI18n();
  const create = useCreate();
  const rename = useRename();
  const toggle = useToggle();
  const del = useDelete();
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const onCreate = () => {
    if (!newName.trim()) return;
    create.mutate(newName.trim(), {
      onSuccess: () => { setNewName(""); toast({ title: t("{title} aggiunto", { title }) }); },
      onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
    });
  };

  const onRename = (id: string) => {
    if (!editName.trim()) return;
    rename.mutate({ id, name: editName.trim() }, {
      onSuccess: () => { setEditId(null); toast({ title: t("Rinominato") }); },
      onError: (e: any) => toast({ title: t("Errore"), description: e.message, variant: "destructive" }),
    });
  };

  const onDelete = (item: CatalogItem) => {
    if (item.brief_count > 0) {
      toast({
        title: t("Impossibile eliminare"),
        description: t("{n} brief usano questo elemento. Disattivalo invece di eliminarlo.", { n: item.brief_count }),
        variant: "destructive",
      });
      return;
    }
    del.mutate(item.id, {
      onSuccess: () => toast({ title: t("Eliminato") }),
      onError: (e: any) => toast({ title: t("Errore"), description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("Caricamento...")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Nome")}</TableHead>
                <TableHead className="text-center">{t("Brief")}</TableHead>
                <TableHead className="text-center">{t("Attivo")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {editId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7" />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRename(item.id)}><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <span className="font-medium">{item.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{item.brief_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={item.is_active} onCheckedChange={(v) => toggle.mutate({ id: item.id, is_active: v })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(item.id); setEditName(item.name); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => onDelete(item)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">{t("Nessun elemento.")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <div className="flex gap-2">
          <Input
            placeholder={t("Aggiungi {title}", { title: title.toLowerCase() })}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onCreate(); }}
          />
          <Button onClick={onCreate} disabled={create.isPending || !newName.trim()}>{t("Aggiungi")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
