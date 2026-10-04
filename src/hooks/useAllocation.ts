import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { activeDays, normalizeSlots, type AllocationCampaign, type AllocationRow } from '@/lib/allocation';

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data as T;
}

export type Premium = { id: string; name: string; daily_slots: number; tier: string | null };
export type Group = { id: string; name: string; creator_ids: string[] };
export type Week = { week_start: string; residual_auto: boolean; version: number };

export function useAllocationBase() {
  return useQuery({ queryKey: ['allocation-base'], queryFn: async () => {
    const [configs, campaignsConfig, allCreators, allCampaigns, accounts, groups] = await Promise.all([
      unwrap(supabase.from('allocation_creators').select('creator_id,daily_slots,tier')),
      unwrap(supabase.from('allocation_campaigns').select('campaign_id,priority,is_residual')),
      unwrap(supabase.from('creators').select('id,name,status')),
      unwrap(supabase.from('campaigns').select('id,name,client_name,start_date,end_date,status,min_monthly_videos,monthly_spend_cap')),
      unwrap(supabase.from('tiktok_accounts').select('creator_id,campaign_id,is_active').eq('is_active', true)),
      unwrap(supabase.from('allocation_groups').select('id,name,creator_ids').order('name')),
    ]);
    const names = new Map(allCreators.map(c => [c.id, c]));
    const campaignsById = new Map(allCampaigns.map(c => [c.id, c]));
    return {
      creators: configs.flatMap(c => { const record = names.get(c.creator_id); return record?.status === 'active' ? [{ id: c.creator_id, name: record.name, daily_slots: c.daily_slots, tier: c.tier } as Premium] : []; }).sort((a,b) => (a.tier ?? 'Z').localeCompare(b.tier ?? 'Z') || a.name.localeCompare(b.name)),
      campaigns: campaignsConfig.flatMap(c => { const record = campaignsById.get(c.campaign_id); return record ? [{ ...record, priority: c.priority, is_residual: c.is_residual } as AllocationCampaign] : []; }).sort((a,b) => a.priority - b.priority),
      accounts: new Set(accounts.filter(a => a.creator_id && a.campaign_id).map(a => `${a.creator_id}:${a.campaign_id}`)),
      groups: groups as Group[],
    };
  }});
}

export function useAllocationWeek(week: string, creators: Premium[], campaigns: AllocationCampaign[], writable: boolean) {
  return useQuery({ queryKey: ['allocation-week', week], enabled: creators.length > 0 && campaigns.length > 0, queryFn: async () => {
    let current = await unwrap(supabase.from('allocation_weeks').select('week_start,residual_auto,version').eq('week_start',week).maybeSingle()) as Week | null;
    if (!current && writable) {
      await unwrap(supabase.rpc('open_allocation_week', { p_week: week }));
      current = await unwrap(supabase.from('allocation_weeks').select('week_start,residual_auto,version').eq('week_start',week).maybeSingle()) as Week | null;
    }
    const currentRows = current ? await unwrap(supabase.from('allocation_slots').select('creator_id,slots,paused').eq('week_start',week)) : [];
    const previous = await unwrap(supabase.from('allocation_weeks').select('week_start,residual_auto,version').lt('week_start',week).order('week_start',{ ascending: false }).limit(1).maybeSingle()) as Week | null;
    const previousRows = previous ? await unwrap(supabase.from('allocation_slots').select('creator_id,slots,paused').eq('week_start',previous.week_start)) : [];
    const active = new Set(campaigns.filter(c => activeDays(c, week) > 0).map(c => c.id));
    const normalize = (raw: typeof currentRows): AllocationRow[] => creators.map(c => {
      const saved = raw.find(r => r.creator_id === c.id);
      return { creator_id: c.id, paused: saved?.paused ?? false, slots: normalizeSlots(saved?.slots, c.daily_slots).map(id => id && active.has(id) ? id : null) };
    });
    return { week: (current ?? { week_start: week, residual_auto: previous?.residual_auto ?? true, version: 0 }) as Week,
      rows: normalize(currentRows.length ? currentRows : previousRows), previous: normalize(previousRows), persisted: Boolean(current) };
  }});
}

export function useAllocationActions() {
  const qc = useQueryClient();
  return {
    async save(week: Week, rows: AllocationRow[], auto: boolean) {
      const version = await unwrap(supabase.rpc('save_allocation_week', { p_week: week.week_start, p_version: week.version, p_auto: auto, p_rows: rows }));
      qc.invalidateQueries({ queryKey: ['allocation-week',week.week_start] });
      return version as number;
    },
    async tier(id: string, tier: string | null) {
      await unwrap(supabase.from('allocation_creators').update({ tier }).eq('creator_id',id));
      qc.invalidateQueries({ queryKey: ['allocation-base'] });
    },
    async createGroup(name: string, ids: string[]) {
      await unwrap(supabase.from('allocation_groups').insert({ name, creator_ids: ids }));
      qc.invalidateQueries({ queryKey: ['allocation-base'] });
    },
    async updateGroup(id: string, patch: { name?: string; creator_ids?: string[] }) {
      await unwrap(supabase.from('allocation_groups').update(patch).eq('id',id));
      qc.invalidateQueries({ queryKey: ['allocation-base'] });
    },
    async deleteGroup(id: string) {
      await unwrap(supabase.from('allocation_groups').delete().eq('id',id));
      qc.invalidateQueries({ queryKey: ['allocation-base'] });
    },
  };
}