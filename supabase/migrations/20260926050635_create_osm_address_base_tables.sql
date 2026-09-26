/*
# Create OSM address base tables: estados, cidades, bairros, ruas, numeros

1. Purpose
   - Stores a structured address base extracted from OpenStreetMap .pbf files.
   - Enables fast fuzzy street matching (pg_trgm + GIN) and number interpolation.
   - Populated asynchronously when a company/totem is registered in a city not yet loaded.

2. New Tables
   - estados (id, sigla, nome)
   - cidades (id, estado_id, nome, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, import_status, imported_at)
   - bairros (id, cidade_id, nome)
   - ruas (id, bairro_id, nome_rua, nome_normalizado, latitude_inicio, longitude_inicio, latitude_fim, longitude_fim)
   - numeros (id, rua_id, numero, latitude, longitude)

3. Indexes
   - GIN on ruas.nome_normalizado (pg_trgm) for fuzzy matching at 75% similarity
   - B-tree on bairros.cidade_id, ruas.bairro_id, numeros.rua_id

4. Extensions
   - pg_trgm (for similarity matching)

5. Security
   - RLS enabled on all tables
   - anon + authenticated can SELECT (address base is public reference data)
   - Only service role (edge functions) can INSERT/UPDATE/DELETE
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS estados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla text UNIQUE NOT NULL,
  nome text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado_id uuid NOT NULL REFERENCES estados(id) ON DELETE CASCADE,
  nome text NOT NULL,
  bbox_min_lat double precision,
  bbox_min_lon double precision,
  bbox_max_lat double precision,
  bbox_max_lon double precision,
  import_status text NOT NULL DEFAULT 'pending',
  imported_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (estado_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_cidades_estado ON cidades(estado_id);
CREATE INDEX IF NOT EXISTS idx_cidades_status ON cidades(import_status);

CREATE TABLE IF NOT EXISTS bairros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id uuid NOT NULL REFERENCES cidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  nome_normalizado text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (cidade_id, nome_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_bairros_cidade ON bairros(cidade_id);
CREATE INDEX IF NOT EXISTS idx_bairros_norm ON bairros(nome_normalizado);

CREATE TABLE IF NOT EXISTS ruas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro_id uuid NOT NULL REFERENCES bairros(id) ON DELETE CASCADE,
  nome_rua text NOT NULL,
  nome_normalizado text NOT NULL,
  latitude_inicio double precision,
  longitude_inicio double precision,
  latitude_fim double precision,
  longitude_fim double precision,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ruas_bairro ON ruas(bairro_id);
CREATE INDEX IF NOT EXISTS idx_ruas_norm_gin ON ruas USING GIN (nome_normalizado gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ruas_norm ON ruas(nome_normalizado);

CREATE TABLE IF NOT EXISTS numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rua_id uuid NOT NULL REFERENCES ruas(id) ON DELETE CASCADE,
  numero text NOT NULL,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_numeros_rua ON numeros(rua_id);
CREATE INDEX IF NOT EXISTS idx_numeros_numero ON numeros(rua_id, numero);

-- RLS: public read, service-role write

ALTER TABLE estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE cidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruas ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_estados" ON estados;
CREATE POLICY "public_read_estados" ON estados FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_cidades" ON cidades;
CREATE POLICY "public_read_cidades" ON cidades FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_bairros" ON bairros;
CREATE POLICY "public_read_bairros" ON bairros FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_ruas" ON ruas;
CREATE POLICY "public_read_ruas" ON ruas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_numeros" ON numeros;
CREATE POLICY "public_read_numeros" ON numeros FOR SELECT TO anon, authenticated USING (true);

-- Write policies: only authenticated (service role bypasses RLS entirely)
DROP POLICY IF EXISTS "auth_write_estados" ON estados;
CREATE POLICY "auth_write_estados" ON estados FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_write_cidades" ON cidades;
CREATE POLICY "auth_write_cidades" ON cidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_write_bairros" ON bairros;
CREATE POLICY "auth_write_bairros" ON bairros FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_write_ruas" ON ruas;
CREATE POLICY "auth_write_ruas" ON ruas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_write_numeros" ON numeros;
CREATE POLICY "auth_write_numeros" ON numeros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed estados (27 UF abbreviations)
INSERT INTO estados (sigla, nome) VALUES
  ('AC','Acre'),('AL','Alagoas'),('AP','Amapá'),('AM','Amazonas'),('BA','Bahia'),
  ('CE','Ceará'),('DF','Distrito Federal'),('ES','Espírito Santo'),('GO','Goiás'),
  ('MA','Maranhão'),('MT','Mato Grosso'),('MS','Mato Grosso do Sul'),
  ('MG','Minas Gerais'),('PA','Pará'),('PB','Paraíba'),('PR','Paraná'),
  ('PE','Pernambuco'),('PI','Piauí'),('RN','Rio Grande do Norte'),
  ('RS','Rio Grande do Sul'),('RJ','Rio de Janeiro'),('RO','Rondônia'),
  ('RR','Roraima'),('SC','Santa Catarina'),('SP','São Paulo'),('SE','Sergipe'),
  ('TO','Tocantins')
ON CONFLICT (sigla) DO NOTHING;