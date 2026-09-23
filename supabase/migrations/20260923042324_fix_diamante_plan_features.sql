-- Fix Plano Diamante to match Black's notification features
-- Diamante should be the top tier: message_tier C, send_eta true, distance_update_interval_min 2
UPDATE subscription_plans SET message_tier = 'C' WHERE name = 'Plano Diamante';

UPDATE plan_notification_features 
SET send_eta = true, 
    send_driver_info = true,
    distance_update_interval_min = 2
WHERE plan_id = (SELECT id FROM subscription_plans WHERE name = 'Plano Diamante');
