
-- Insert cycle 2 for Finanz campaign
INSERT INTO payment_cycles (campaign_id, cycle_number, cycle_start_date, cycle_end_date, is_last_cycle)
VALUES ('edfc1aae-3b5d-4556-948d-2d1cc3025cfa', 2, '2026-03-02', '2026-04-01', false);

-- Insert client payment for cycle 2
-- Views: 2345 (all under 100k cap), CPM: 1.50, newViews = 2345 - 0 = 2345
-- cpm_amount = 1.50 * 2345/1000 = 3.5175
-- fixed = 0 (client_fixed_per_creator = 0)
-- total = 3.5175
INSERT INTO client_payments (campaign_id, cycle_id, cycle_number, due_date, fixed_amount, cpm_views, cpm_amount, total_amount, views_snapshot_at, views_paid_cumulative)
VALUES (
  'edfc1aae-3b5d-4556-948d-2d1cc3025cfa',
  (SELECT id FROM payment_cycles WHERE campaign_id = 'edfc1aae-3b5d-4556-948d-2d1cc3025cfa' AND cycle_number = 2),
  2,
  '2026-03-02',
  0,
  2345,
  3.52,
  3.52,
  now(),
  2345
);
