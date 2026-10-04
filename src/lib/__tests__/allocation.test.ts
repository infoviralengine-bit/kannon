import { describe, expect, it } from 'vitest';
import { activeDays, campTotals, effectiveSlots, paint, shiftWeek, type AllocationCampaign } from '@/lib/allocation';

const camp: AllocationCampaign = { id: 'easy', name: 'Easy Regalo', client_name: 'Easy', start_date: '2026-10-05', end_date: '2026-11-05', status: 'active', min_monthly_videos: 500, monthly_spend_cap: null, priority: 3, is_residual: false };
describe('allocation', () => {
  it('fills a free stretch, stopping at another campaign', () => {
    const first = paint([null, null, null, null, null, null], 2, 'easy');
    expect(first).toEqual(['easy', 'easy', 'easy', null, null, null]);
    expect(paint(first, 4, 'unflat')).toEqual(['easy', 'easy', 'easy', 'unflat', 'unflat', null]);
  });
  it('shortens and clears runs, overwrites only the clicked different color', () => {
    expect(paint(['a','a','a','a',null], 2, 'a')).toEqual(['a','a',null,null,null]);
    expect(paint(['a','a','a',null], 0, 'a')).toEqual([null,null,null,null]);
    expect(paint(['a','a','b','b'], 2, 'a')).toEqual(['a','a','a','b']);
  });
  it('counts partial weeks and excludes Sunday', () => {
    expect(activeDays(camp, '2026-11-02')).toBe(4);
    expect(campTotals([{ creator_id: 'c', paused: false, slots: ['easy', null] }], camp, '2026-11-02', 'finanz', true)).toMatchObject({ videos: 4, target: 77, accounts: 1 });
    expect(activeDays(camp, '2026-11-09')).toBe(0);
    expect(shiftWeek('2026-11-02', 1)).toBe('2026-11-09');
  });
  it('excludes paused capacity and fills only implicit residual', () => {
    const r = { creator_id: 'c', paused: false, slots: [null, 'easy'] };
    expect(effectiveSlots(r, 'finanz', true)).toEqual(['finanz', 'easy']);
    expect(effectiveSlots(r, 'finanz', false)).toEqual([null, 'easy']);
    expect(effectiveSlots({ ...r, paused: true }, 'finanz', true)).toEqual([]);
  });
});