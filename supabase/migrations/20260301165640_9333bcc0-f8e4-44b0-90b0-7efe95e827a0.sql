
SELECT cron.schedule(
  'scrape-tiktok-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ceknjgwzxexxzckcqjmq.supabase.co/functions/v1/scrape-tiktok',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNla25qZ3d6eGV4eHpja2Nxam1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzAyMDcsImV4cCI6MjA4Nzg0NjIwN30.ugfGWCmG46HV_buJENCwN_wSCKcH6XoDVXY-pLn9ekQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
