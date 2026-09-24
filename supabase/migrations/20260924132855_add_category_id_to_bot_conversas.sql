/*
# Add selected_category_id to bot_conversas
- Stores the passenger's category choice when multiple categories are available for a connection.
*/
ALTER TABLE bot_conversas ADD COLUMN IF NOT EXISTS selected_category_id uuid;
