-- Install pg_net extension (provides net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove the broken cron job
SELECT cron.unschedule('ride-distance-updates') WHERE true;

-- Reschedule using extensions.net.http_post (pg_net installed in extensions schema)
SELECT cron.schedule(
  'ride-distance-updates',
  '* * * * *',
  $$
    SELECT extensions.net.http_post(
      url := 'https://mshxunqqyecwpspnxiph.supabase.co/functions/v1/ride-distance-updates',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
