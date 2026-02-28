import { BarChart3, Film, TrendingUp, Search, FileText, CalendarDays, Landmark, Settings } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function PipelinePage() { return <ComingSoon icon={BarChart3} title="Pipeline CRM" />; }
export function MediaPage() { return <ComingSoon icon={Film} title="Media Library" />; }
export function ReportsPage() { return <ComingSoon icon={TrendingUp} title="Report" />; }
export function RecruitingPage() { return <ComingSoon icon={Search} title="Recruiting" />; }
export function ContractsPage() { return <ComingSoon icon={FileText} title="Contratti" />; }
export function CalendarPage() { return <ComingSoon icon={CalendarDays} title="Calendario" />; }
export function FinancePage() { return <ComingSoon icon={Landmark} title="Finanza" />; }
export function SettingsPage() { return <ComingSoon icon={Settings} title="Impostazioni" />; }
