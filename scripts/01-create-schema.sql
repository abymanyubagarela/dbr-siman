-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create inventory_sessions table
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  started_at TIMESTAMP DEFAULT now(),
  created_by UUID,
  CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES inventory_sessions(id),
  asset_id TEXT,
  image_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('scanned', 'photographed')),
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  CONSTRAINT unique_session_asset UNIQUE(session_id, asset_id)
);

-- Create indexes for performance
CREATE INDEX idx_sessions_room_id ON inventory_sessions(room_id);
CREATE INDEX idx_items_session_id ON inventory_items(session_id);
CREATE INDEX idx_items_status ON inventory_items(status);

-- Enable RLS (Row Level Security)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rooms (public read)
CREATE POLICY "rooms_public_read" ON rooms
  FOR SELECT
  USING (true);

-- Create RLS policies for inventory_sessions (public read/write for now)
CREATE POLICY "sessions_public_read" ON inventory_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "sessions_public_insert" ON inventory_sessions
  FOR INSERT
  WITH CHECK (true);

-- Create RLS policies for inventory_items (public read/write for now)
CREATE POLICY "items_public_read" ON inventory_items
  FOR SELECT
  USING (true);

CREATE POLICY "items_public_insert" ON inventory_items
  FOR INSERT
  WITH CHECK (true);
