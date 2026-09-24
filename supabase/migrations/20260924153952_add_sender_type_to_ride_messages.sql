-- Add sender_type to ride_messages to distinguish human vs bot messages
ALTER TABLE ride_messages ADD COLUMN IF NOT EXISTS sender_type text DEFAULT 'human';
COMMENT ON COLUMN ride_messages.sender_type IS 'human = typed by passenger, bot = automatic bot message. Only human messages are relayed to driver.';
