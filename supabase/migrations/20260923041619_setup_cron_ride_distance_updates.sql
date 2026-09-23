-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule ride-distance-updates to run every minute
-- It will check each en_route ride and send updates based on the plan's interval
SELECT cron.schedule(
  'ride-distance-updates',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://mshxunqqyecwpspnxiph.supabase.co/functions/v1/ride-distance-updates',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
