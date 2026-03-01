
-- Create a new TikTok account for Arianna on HAT Music campaign
INSERT INTO tiktok_accounts (id, username, account_type, creator_id, campaign_id, is_active)
VALUES ('a1b2c3d4-0001-4000-8000-000000000001', '@arianna.hatmusic', 'creator', 'aec92a77-9245-4b72-a5c8-91ac74c604cd', '4c312fda-fe61-449f-9d5f-f4dd0467ef94', true);

-- Also make sure Arianna is in campaign_creators for HAT Music
INSERT INTO campaign_creators (campaign_id, creator_id)
VALUES ('4c312fda-fe61-449f-9d5f-f4dd0467ef94', 'aec92a77-9245-4b72-a5c8-91ac74c604cd')
ON CONFLICT DO NOTHING;

-- Insert 120 videos for March 2026 spread across the month
INSERT INTO videos (tiktok_account_id, tiktok_video_id, published_at, views, likes, comments, window_expires_at, window_closed, views_final)
SELECT 
  'a1b2c3d4-0001-4000-8000-000000000001',
  'sim_arianna_premium_' || gs,
  '2026-03-01'::timestamp + (gs * interval '6 hours'),
  (random() * 5000 + 500)::int,
  (random() * 200 + 10)::int,
  (random() * 50 + 2)::int,
  '2026-03-01'::timestamp + (gs * interval '6 hours') + interval '30 days',
  false,
  NULL
FROM generate_series(1, 120) gs;
