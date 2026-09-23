-- Add machine_driver_id column to rides table to store the Machine API condutor_id
-- This is needed to send chat messages to the driver via POST /mensagens/condutor/{id}
ALTER TABLE rides ADD COLUMN IF NOT EXISTS machine_driver_id text;
