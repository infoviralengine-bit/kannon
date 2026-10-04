import { supabase } from '@/integrations/supabase/client';

// A planning target is deliberately stored separately from contractual campaign minima.
export async function saveAllocationTarget(campaignId: string, target: number | null) {
  if (target !== null && (!Number.isSafeInteger(target) || target < 0)) throw new Error('Target non valido');
  const { data: existing, error: readError } = await supabase.from('allocation_campaigns').select('campaign_id').eq('campaign_id', campaignId).maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const { error } = await supabase.from('allocation_campaigns').update({ target_monthly_videos: target }).eq('campaign_id', campaignId);
    if (error) throw error;
    return;
  }
  const { data: last, error: priorityError } = await supabase.from('allocation_campaigns').select('priority').order('priority', { ascending: false }).limit(1);
  if (priorityError) throw priorityError;
  const { error } = await supabase.from('allocation_campaigns').insert({ campaign_id: campaignId, priority: (last?.[0]?.priority ?? 0) + 1, is_residual: false, target_monthly_videos: target });
  if (error) throw error;
}

export function parsePlanningTarget(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value);
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(number)) throw new Error('Target non valido');
  return number;
}

export async function loadAllocationTarget(campaignId: string): Promise<number | null> {
  const { data, error } = await supabase.from('allocation_campaigns').select('target_monthly_videos').eq('campaign_id', campaignId).maybeSingle();
  if (error) throw error;
  return data?.target_monthly_videos ?? null;
}