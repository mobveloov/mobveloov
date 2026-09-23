-- Remove the broken cron job
SELECT cron.unschedule('ride-distance-updates') WHERE true;

-- Reschedule using net.http_post (pg_net is now installed, net schema exists)
-- Set search_path to include net so the function is found
SELECT cron.schedule(
  'ride-distance-updates',
  '* * * * *',
  $$
    SET search_path TO net, public;
    SELECT http_post(
      url := 'https://mshxunqqyecwpspnxiph.supabase.co/functions/v1/ride-distance-updates',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
