import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
export type AccountSignal = { account_id: string; username: string; creator_id: string | null; campaign_id: string | null; campaign_name: string | null; low_count: number; tier: number; videos: { id: string; tiktok_video_id: string; views: number; published_at: string; last_scraped_at: string | null }[] };
export function useAccountSignals() {
 const { user, role } = useAuth();
 return useQuery({ queryKey: ['account-signals', user?.id, role], enabled: Boolean(user && role), refetchInterval: 60_000, queryFn: async (): Promise<AccountSignal[]> => {
  const { data, error } = await supabase.rpc('get_account_signals');
  if (error) throw error;
  return data as unknown as AccountSignal[];
 }});
}
