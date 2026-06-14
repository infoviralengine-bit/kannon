DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret FROM public.settings WHERE key = 'cron_secret';
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret not found in settings — insert it first';
  END IF;

  PERFORM cron.unschedule('generate-alerts-hourly');

  PERFORM cron.schedule(
    'generate-alerts-hourly',
    '0 * * * *',
    format($job$
      SELECT net.http_post(
        url := 'https://ceknjgwzxexxzckcqjmq.supabase.co/functions/v1/generate-alerts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNla25qZ3d6eGV4eHpja2Nxam1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzAyMDcsImV4cCI6MjA4Nzg0NjIwN30.ugfGWCmG46HV_buJENCwN_wSCKcH6XoDVXY-pLn9ekQ',
          'x-cron-secret', %L
        ),
        body := jsonb_build_object('triggered_at', now())
      );
    $job$, v_secret)
  );
END $$;