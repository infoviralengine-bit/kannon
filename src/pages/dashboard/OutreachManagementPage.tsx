import { OutreachAdminView } from "@/components/outreach/OutreachAdminView";
import { OutreachTemplatesAdmin } from "@/components/outreach/OutreachTemplatesAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText } from "lucide-react";

export default function OutreachManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestione Outreach</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitora il team outreach e gestisci i template dei messaggi</p>
      </div>

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Template
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <OutreachAdminView />
        </TabsContent>

        <TabsContent value="templates">
          <OutreachTemplatesAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
