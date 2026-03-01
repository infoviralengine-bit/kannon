-- Add 10 more videos for Arianna (from 120 to 130) for March 2026
INSERT INTO videos (tiktok_account_id, tiktok_video_id, views, likes, comments, published_at, window_expires_at, window_closed, views_final)
SELECT 
  'a1b2c3d4-0001-4000-8000-000000000001',
  'sim_arianna_extra_' || gs,
  floor(random()*50000 + 5000)::int,
  floor(random()*3000 + 100)::int,
  floor(random()*500 + 10)::int,
  '2026-03-01'::timestamp + (gs * interval '5 hours'),
  '2026-03-01'::timestamp + (gs * interval '5 hours') + interval '30 days',
  false,
  null
FROM generate_series(1, 10) gs;