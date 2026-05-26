
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-alerts-hourly') THEN
    PERFORM cron.unschedule('generate-alerts-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'generate-alerts-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ceknjgwzxexxzckcqjmq.supabase.co/functions/v1/generate-alerts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNla25qZ3d6eGV4eHpja2Nxam1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzAyMDcsImV4cCI6MjA4Nzg0NjIwN30.ugfGWCmG46HV_buJENCwN_wSCKcH6XoDVXY-pLn9ekQ"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
