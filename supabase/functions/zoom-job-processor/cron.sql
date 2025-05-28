
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job processor to run every 2 minutes
SELECT cron.schedule(
  'process-zoom-sync-jobs',
  '*/2 * * * *', -- every 2 minutes
  $$
  SELECT
    net.http_post(
        url:='https://fvehswcrxhdxztycnvgz.supabase.co/functions/v1/zoom-job-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2ZWhzd2NyeGhkeHp0eWNudmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0MTA1MTMsImV4cCI6MjA2Mzk4NjUxM30.fQr6S_WCJwo86szintuzs0mjCa3ZIECF-JRFEr6DboE"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);
