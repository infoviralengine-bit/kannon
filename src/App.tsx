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
import OnboardingPage from "@/pages/OnboardingPage";
import OnboardingCompleted from "@/pages/OnboardingCompleted";
import CreatorArea from "@/pages/CreatorArea";
import ClientArea from "@/pages/ClientArea";
import GeneralePage from "@/pages/dashboard/GeneralePage";
import CampagnePage from "@/pages/dashboard/CampagnePage";
import CreatorPage from "@/pages/dashboard/CreatorPage";
import CreatorDetailPage from "@/pages/dashboard/CreatorDetailPage";
import AccountPage from "@/pages/dashboard/AccountPage";
import AccountDetailPage from "@/pages/dashboard/AccountDetailPage";

import PaymentsReceivablePage from "@/pages/dashboard/PaymentsReceivablePage";
import PaymentsPayablePage from "@/pages/dashboard/PaymentsPayablePage";
import CampaignDetailPage from "@/pages/dashboard/CampaignDetailPage";
import {
  PipelinePage,
  CalendarPage
} from "@/pages/dashboard/ComingSoonPages";
import FinancePage from "@/pages/dashboard/FinancePage";
import ContractsPage from "@/pages/dashboard/ContractsPage";
import ContractDetailPage from "@/pages/dashboard/ContractDetailPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import OnboardingMonitorPage from "@/pages/dashboard/OnboardingMonitorPage";
import VideoAnalyticsPage from "@/pages/dashboard/VideoAnalyticsPage";
import ContentCalendarPage from "@/pages/dashboard/ContentCalendarPage";
import PipelineB2BPage from "@/pages/dashboard/PipelineB2BPage";

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
            <Route path="/onboarding/completed" element={<OnboardingCompleted />} />
            <Route path="/onboarding/:token" element={<OnboardingPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard routes - staff & campaign manager */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={["admin", "team", "campaign_manager"]}>
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
              <Route path="payoff" element={<Navigate to="/dashboard" replace />} />
              <Route path="payments-receivable" element={<PaymentsReceivablePage />} />
              <Route path="payments-payable" element={<PaymentsPayablePage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="recruiting" element={<Navigate to="/dashboard" replace />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="contracts/:id" element={<ContractDetailPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="closer" element={<Navigate to="/dashboard/onboarding" replace />} />
              <Route path="onboarding" element={<OnboardingMonitorPage />} />
              <Route path="content-calendar" element={<ContentCalendarPage />} />
              <Route path="videos" element={<VideoAnalyticsPage />} />
              {/* Backward-compat redirects (SP#4) */}
              <Route path="campaign-manager" element={<Navigate to="/dashboard/content-calendar?tab=analytics" replace />} />
              <Route path="trends" element={<Navigate to="/dashboard/content-calendar" replace />} />
              <Route path="trend-tiktok" element={<Navigate to="/dashboard/content-calendar" replace />} />
              <Route path="creator-pipeline" element={<Navigate to="/dashboard/onboarding" replace />} />
              <Route path="pipeline-b2b" element={<PipelineB2BPage />} />
              <Route path="hiring" element={<Navigate to="/dashboard" replace />} />
              <Route path="settings" element={<SettingsPage />} />
              {/* Redirect old payments route */}
              <Route path="payments" element={<Navigate to="/dashboard/payments-receivable" replace />} />
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
