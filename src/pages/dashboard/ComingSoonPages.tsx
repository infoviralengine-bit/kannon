import { BarChart3, Film, TrendingUp, CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function PipelinePage() { return <ComingSoon icon={BarChart3} title="Pipeline CRM" />; }
export function MediaPage() { return <ComingSoon icon={Film} title="Media Library" />; }
export function ReportsPage() { return <ComingSoon icon={TrendingUp} title="Report" />; }
export function CalendarPage() { return <ComingSoon icon={CalendarDays} title="Calendario" />; }
// SettingsPage moved to dedicated file
