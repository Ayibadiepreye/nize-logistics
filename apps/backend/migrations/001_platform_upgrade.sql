-- =============================================================================
-- Nize Logistics — platform upgrade migration
-- =============================================================================
-- Idempotent and non-destructive: every statement is IF NOT EXISTS / IF EXISTS
-- guarded, no column is dropped, and no existing row is deleted. Safe to run
-- more than once and safe to run against a database that already holds live
-- orders.
--
--   psql "$DATABASE_URL" -f migrations/001_platform_upgrade.sql
--   (or: npm run migrate)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Users — credential lifecycle columns
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 2. Reports — align the table with the code
-- -----------------------------------------------------------------------------
-- The recipient report endpoint inserted `report_type` while the table declared
-- `type`, and `reporter_role` was NOT NULL even though recipients have no
-- account. Every recipient report therefore failed. Repair both.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_label VARCHAR(50);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);

-- Carry across data from an older `report_type` column if this database has one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'report_type'
  ) THEN
    UPDATE reports SET type = report_type WHERE type IS NULL;
  END IF;
END $$;

UPDATE reports SET type = 'other' WHERE type IS NULL;
ALTER TABLE reports ALTER COLUMN type SET NOT NULL;
ALTER TABLE reports ALTER COLUMN reporter_role DROP NOT NULL;

-- Older rows used 'pending'; the code and the admin queue both use 'open'.
UPDATE reports SET status = 'open' WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 3. Platform settings — maintenance mode
-- -----------------------------------------------------------------------------
-- The super-admin settings endpoint wrote these two columns even though they
-- were never created, so every settings save failed.
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT;

-- Guarantee the singleton settings and pricing rows exist.
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO pricing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Audit log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES users(id),
  actor_label  VARCHAR(120),
  action       VARCHAR(80) NOT NULL,
  entity_type  VARCHAR(40),
  entity_id    VARCHAR(64),
  summary      TEXT,
  metadata     JSONB,
  ip_address   VARCHAR(60),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_logs (action);

-- -----------------------------------------------------------------------------
-- 5. Indexes on the hot query paths
-- -----------------------------------------------------------------------------
-- The dashboard filters by status, the rider dashboard by assigned rider, and
-- tracking looks up by ticket id — none of which were indexed.
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created        ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_rider          ON orders (assigned_rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_status   ON orders (assigned_rider_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivered      ON orders (delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_ticket_upper   ON orders (UPPER(ticket_id));
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref    ON orders (payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled      ON orders (scheduled_pickup_at)
  WHERE pickup_type = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_users_role           ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_role_status    ON users (role, status);
CREATE INDEX IF NOT EXISTS idx_users_email_lower    ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_available      ON users (role, is_online, is_busy)
  WHERE role = 'rider';

CREATE INDEX IF NOT EXISTS idx_reports_status  ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_order   ON reports (order_id);
CREATE INDEX IF NOT EXISTS idx_invites_token   ON invites (token);

-- -----------------------------------------------------------------------------
-- 6. Data integrity
-- -----------------------------------------------------------------------------
-- Prices and distances can never be negative.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_price_positive') THEN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_price_positive
      CHECK (total_price >= 0 AND distance_km >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pricing_non_negative') THEN
    ALTER TABLE pricing_config ADD CONSTRAINT chk_pricing_non_negative
      CHECK (base_fare >= 0 AND per_km_rate >= 0 AND minimum_fare >= 0);
  END IF;
END $$;

-- Repair rows left inconsistent by the old code paths:
--   a rider marked busy with no live job, and delivered orders with no timestamp.
UPDATE users u SET is_busy = FALSE
WHERE u.role = 'rider'
  AND u.is_busy = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.assigned_rider_id = u.id
      AND o.status IN ('assigned','accepted','picked_up','in_transit')
  );

UPDATE orders SET delivered_at = updated_at
WHERE status = 'delivered' AND delivered_at IS NULL;

COMMIT;
