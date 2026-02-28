import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/layouts/DashboardLayout";

import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import CreatorArea from "@/pages/CreatorArea";
import ClientArea from "@/pages/ClientArea";
import GeneralePage from "@/pages/dashboard/GeneralePage";
import CampagnePage from "@/pages/dashboard/CampagnePage";
import CreatorPage from "@/pages/dashboard/CreatorPage";
import CreatorDetailPage from "@/pages/dashboard/CreatorDetailPage";
import AccountPage from "@/pages/dashboard/AccountPage";
import AccountDetailPage from "@/pages/dashboard/AccountDetailPage";
import PayoffPage from "@/pages/dashboard/PayoffPage";
import CampaignDetailPage from "@/pages/dashboard/CampaignDetailPage";
import {
  PipelinePage, MediaPage, ReportsPage, RecruitingPage,
  ContractsPage, CalendarPage, FinancePage, SettingsPage
} from "@/pages/dashboard/ComingSoonPages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard routes - admin & team */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={["admin", "team"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<GeneralePage />} />
              <Route path="campaigns" element={<CampagnePage />} />
              <Route path="campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="creators" element={<CreatorPage />} />
              <Route path="creators/:id" element={<CreatorDetailPage />} />
              <Route path="accounts" element={<AccountPage />} />
              <Route path="accounts/:id" element={<AccountDetailPage />} />
              <Route path="payoff" element={<PayoffPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="media" element={<MediaPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="recruiting" element={<RecruitingPage />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Creator area */}
            <Route path="/creator" element={
              <ProtectedRoute allowedRoles={["creator"]}>
                <CreatorArea />
              </ProtectedRoute>
            } />

            {/* Client area */}
            <Route path="/client" element={
              <ProtectedRoute allowedRoles={["client"]}>
                <ClientArea />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
