-- Remove the broken cron job that used http_post (from the http extension)
SELECT cron.unschedule('ride-distance-updates') WHERE true;

-- Reschedule using net.http_post from pg_net (the correct extension for HTTP calls in pg_cron)
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
