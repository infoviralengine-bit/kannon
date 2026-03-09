import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OutreachMemberView } from "@/components/outreach/OutreachMemberView";
import { OutreachAdminView } from "@/components/outreach/OutreachAdminView";
import { OutreachTemplatesAdmin } from "@/components/outreach/OutreachTemplatesAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, FileText } from "lucide-react";

export default function RecruitingPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "team";

  if (!isAdmin) {
    // Outreach member view
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Outreach</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestisci i tuoi account e registra le attività giornaliere</p>
        </div>
        <OutreachMemberView />
      </div>
    );
  }

  // Admin view with tabs
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recruiting & Outreach</h1>
        <p className="text-sm text-muted-foreground mt-1">Panoramica del team outreach e gestione template</p>
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
