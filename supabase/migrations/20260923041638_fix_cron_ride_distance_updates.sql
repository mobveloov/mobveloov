-- Enable http extension for cron to call edge functions
CREATE EXTENSION IF NOT EXISTS http;

-- Remove the broken cron job that used net.http_post
SELECT cron.unschedule('ride-distance-updates') WHERE true;

-- Reschedule using http_post from the http extension
SELECT cron.schedule(
  'ride-distance-updates',
  '* * * * *',
  $$
    SELECT http_post(
      'https://mshxunqqyecwpspnxiph.supabase.co/functions/v1/ride-distance-updates',
      '{}'::jsonb,
      'application/json'
    );
  $$
);
