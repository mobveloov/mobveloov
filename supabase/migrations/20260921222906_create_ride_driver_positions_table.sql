CREATE TABLE IF NOT EXISTS ride_driver_positions (
  ride_id UUID PRIMARY KEY REFERENCES rides(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ride_driver_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_positions" ON ride_driver_positions FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_positions_service" ON ride_driver_positions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_positions_service" ON ride_driver_positions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
