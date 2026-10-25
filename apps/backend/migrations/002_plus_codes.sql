-- =============================================================================
-- Nize Logistics — coordinate-first addressing (Plus Codes + place cache)
-- =============================================================================
-- Replaces the Google Maps geocoding dependency.
--
-- Why this exists:
--   Nigeria has almost no machine-readable address data. OpenStreetMap has no
--   record of most businesses, and the commercial geocoders require a paid API
--   key. A Plus Code is derived purely from a lat/lng pair, so it works
--   anywhere on Earth with no lookup table and no network call.
--
-- What it adds:
--   1. A Plus Code and a free-text label on each order endpoint, so the rider
--      sees both the human-readable name and the authoritative coordinate code.
--   2. A `locations` place cache, so every pinned point is remembered and the
--      company builds its own map over time.
--
-- Idempotent and non-destructive: every statement is guarded, no column is
-- dropped, no row is deleted. Safe to run more than once.
--
--   psql "$DATABASE_URL" -f migrations/002_plus_codes.sql
--   (or: npm run migrate)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Orders — Plus Code + label on each endpoint
-- -----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_label       VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_plus_code   VARCHAR(16);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_label      VARCHAR(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_plus_code  VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_orders_pickup_plus_code  ON orders (pickup_plus_code);
CREATE INDEX IF NOT EXISTS idx_orders_dropoff_plus_code ON orders (dropoff_plus_code);

-- -----------------------------------------------------------------------------
-- 2. Locations — the place cache
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label          VARCHAR(120) NOT NULL,
  plus_code      VARCHAR(16)  NOT NULL,
  lat            DECIMAL(10, 7) NOT NULL,
  lng            DECIMAL(10, 7) NOT NULL,
  source         VARCHAR(20)  NOT NULL DEFAULT 'customer',
  created_by_id  UUID REFERENCES users(id),
  use_count      INTEGER      NOT NULL DEFAULT 0,
  last_used_at   TIMESTAMP,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_plus_code ON locations (plus_code);
CREATE INDEX IF NOT EXISTS idx_locations_use_count ON locations (use_count DESC);
CREATE INDEX IF NOT EXISTS idx_locations_last_used ON locations (last_used_at DESC);

-- The same physical point should not be stored twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_coords
  ON locations (lat, lng);

-- -----------------------------------------------------------------------------
-- 3. PostGIS geometry column
-- -----------------------------------------------------------------------------
-- Neon supports PostGIS, so this normally succeeds. It is wrapped in a DO block
-- so that a database without the extension (a plain local Postgres, for
-- example) still gets the table and the indexes above rather than the whole
-- migration failing.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS unavailable — locations.geom will not be created. Spatial queries are disabled.';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'locations' AND column_name = 'geom'
    ) THEN
      ALTER TABLE locations
        ADD COLUMN geom GEOMETRY(Point, 4326);

      -- Keep the geometry in sync with the plain columns.
      UPDATE locations
        SET geom = ST_SetSRID(ST_MakePoint(lng::float8, lat::float8), 4326)
        WHERE geom IS NULL;

      CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST (geom);
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Record which migration has run
-- -----------------------------------------------------------------------------
-- Records that this file has run. Uses the same `filename` column the runner
-- creates, so the two agree.
INSERT INTO schema_migrations (filename) VALUES ('002_plus_codes.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
