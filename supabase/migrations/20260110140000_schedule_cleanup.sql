-- Enable pg_cron extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup function to run daily at 3:00 AM
-- Note: You need to replace [PROJECT_REF] and [ANON_KEY] with actual values, 
-- or use an internal calling mechanism if available.
-- However, standard way in Supabase is using pg_net or invoking via cron.

-- Option A: Using pg_cron to call the function via HTTP (requires pg_net)
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'cleanup-rejected-docs-daily', -- name of the cron job
  '0 3 * * *',                   -- schedule: every day at 3:00 AM
  $$
  select
    net.http_post(
        url:='https://nwszukpenvkctthbsocw.supabase.co/functions/v1/cleanup-rejected-documents',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SUA_SERVICE_ROLE_KEY]"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('cleanup-rejected-docs-daily');
