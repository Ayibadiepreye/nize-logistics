-- ============================================
-- NIZE LOGISTICS - DATABASE RESET & INITIALIZATION
-- ============================================
-- This script completely wipes the database and recreates everything
-- WARNING: This will DELETE ALL DATA!
-- ============================================

-- 🗑️ STEP 1: DROP ALL TABLES (with CASCADE to handle dependencies)
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS invites CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS pricing_config CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;

-- 🗑️ STEP 2: DROP ALL ENUMS
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS pickup_type CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS email_service CASCADE;

-- 🧹 STEP 3: DROP ALL INDEXES (in case of orphans)
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_online;
DROP INDEX IF EXISTS idx_orders_ticket_id;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_assigned_rider;
DROP INDEX IF EXISTS idx_orders_created_at;
DROP INDEX IF EXISTS idx_orders_recipient_token;
DROP INDEX IF EXISTS idx_invites_token;
DROP INDEX IF EXISTS idx_invites_email;
DROP INDEX IF EXISTS idx_reports_order_id;
DROP INDEX IF EXISTS idx_reports_status;

-- ✅ Clean slate message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Database cleaned - all tables, enums, and indexes dropped';
END $$;

-- ============================================
-- 🎨 STEP 4: CREATE ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'rider');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_signup');
CREATE TYPE order_status AS ENUM ('pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE pickup_type AS ENUM ('immediate', 'scheduled');
CREATE TYPE payment_method AS ENUM ('paystack', 'cod');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE email_service AS ENUM ('resend', 'smtp');

DO $$ 
BEGIN 
  RAISE NOTICE '✅ All enums created successfully';
END $$;

-- ============================================
-- 📊 STEP 5: CREATE TABLES
-- ============================================

-- 1️⃣ USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  status user_status DEFAULT 'pending_signup' NOT NULL,
  suspended_until TIMESTAMP,
  
  -- Rider-specific
  full_name TEXT,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  plate_number VARCHAR(20),
  vehicle_type VARCHAR(50),
  profile_photo_url TEXT,
  
  -- Live status
  is_online BOOLEAN DEFAULT false,
  is_busy BOOLEAN DEFAULT false,
  current_lat DECIMAL(10, 7),
  current_lng DECIMAL(10, 7),
  last_seen TIMESTAMP,
  
  -- VAPID
  push_subscription JSONB,
  
  -- Stats
  total_deliveries INTEGER DEFAULT 0,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Users table created';
END $$;

-- 2️⃣ INVITES TABLE
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token TEXT UNIQUE NOT NULL,
  role user_role NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Invites table created';
END $$;

-- 3️⃣ ORDERS TABLE
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(20) UNIQUE NOT NULL,
  
  -- Pickup
  pickup_type pickup_type NOT NULL,
  scheduled_pickup_at TIMESTAMP,
  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10, 7) NOT NULL,
  pickup_lng DECIMAL(10, 7) NOT NULL,
  
  -- Drop-off
  dropoff_address TEXT NOT NULL,
  dropoff_lat DECIMAL(10, 7) NOT NULL,
  dropoff_lng DECIMAL(10, 7) NOT NULL,
  
  -- People
  sender_name VARCHAR(100) NOT NULL,
  sender_phone VARCHAR(20) NOT NULL,
  sender_whatsapp VARCHAR(20),
  recipient_name VARCHAR(100) NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_whatsapp VARCHAR(20),
  recipient_email VARCHAR(255),
  
  -- Package
  package_images JSONB DEFAULT '[]',
  description TEXT,
  notes TEXT,
  
  -- Pricing
  distance_km DECIMAL(8, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  
  -- Payment
  payment_method payment_method NOT NULL,
  payment_status payment_status DEFAULT 'pending' NOT NULL,
  payment_reference TEXT,
  cash_collected BOOLEAN DEFAULT false,
  
  -- Status
  status order_status DEFAULT 'pending' NOT NULL,
  assigned_rider_id UUID REFERENCES users(id),
  assigned_at TIMESTAMP,
  accepted_at TIMESTAMP,
  picked_up_at TIMESTAMP,
  in_transit_at TIMESTAMP,
  delivered_at TIMESTAMP,
  delivery_proof_url TEXT,
  delivery_notes TEXT,
  estimated_delivery_time TIMESTAMP,
  declined_count INTEGER DEFAULT 0,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP,
  
  -- Recipient link
  recipient_token TEXT UNIQUE,
  recipient_link_expires_at TIMESTAMP,
  
  -- Pruning
  text_snapshot TEXT,
  is_pruned BOOLEAN DEFAULT false,
  images_pruned_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Orders table created';
END $$;

-- 4️⃣ REPORTS TABLE
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  reporter_role user_role NOT NULL,
  reporter_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Reports table created';
END $$;

-- 5️⃣ PRICING CONFIG TABLE
CREATE TABLE pricing_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  base_fare DECIMAL(12, 2) DEFAULT 500 NOT NULL,
  per_km_rate DECIMAL(12, 2) DEFAULT 120 NOT NULL,
  minimum_fare DECIMAL(12, 2) DEFAULT 1000 NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Pricing config table created';
END $$;

-- 6️⃣ PLATFORM SETTINGS TABLE
CREATE TABLE platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  email_service email_service DEFAULT 'resend' NOT NULL,
  resend_api_key TEXT,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_user VARCHAR(255),
  smtp_pass TEXT,
  email_from VARCHAR(255) DEFAULT 'Nize Logistics <noreply@nizelogistics.com>',
  cloudinary_cloud_name VARCHAR(255),
  cloudinary_api_key VARCHAR(255),
  cloudinary_api_secret TEXT,
  paystack_secret_key TEXT,
  paystack_public_key VARCHAR(255),
  vapid_public_key TEXT,
  vapid_private_key TEXT,
  vapid_subject VARCHAR(255) DEFAULT 'mailto:admin@nizelogistics.com',
  pruning_enabled BOOLEAN DEFAULT true,
  days_to_keep_images INTEGER DEFAULT 30,
  days_to_keep_full INTEGER DEFAULT 90,
  scheduled_pickup_notice_minutes INTEGER DEFAULT 30,
  declined_alert_threshold INTEGER DEFAULT 3,
  auto_offline_minutes INTEGER DEFAULT 2,
  recipient_link_active_days INTEGER DEFAULT 2,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Platform settings table created';
END $$;

-- ============================================
-- 🎯 STEP 6: INSERT DEFAULT DATA
-- ============================================

-- Insert default pricing config
INSERT INTO pricing_config (id, base_fare, per_km_rate, minimum_fare)
VALUES (1, 500, 120, 1000)
ON CONFLICT (id) DO NOTHING;

-- Insert default platform settings
INSERT INTO platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Default data inserted (pricing: ₦500 base + ₦120/km, min ₦1000)';
END $$;

-- ============================================
-- 🚀 STEP 7: CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_online ON users(is_online) WHERE is_online = true;

CREATE INDEX idx_orders_ticket_id ON orders(ticket_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_assigned_rider ON orders(assigned_rider_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_recipient_token ON orders(recipient_token);

CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_email ON invites(email);

CREATE INDEX idx_reports_order_id ON reports(order_id);
CREATE INDEX idx_reports_status ON reports(status);

DO $$ 
BEGIN 
  RAISE NOTICE '✅ All indexes created';
END $$;

-- ============================================
-- 🎉 STEP 8: FINAL VERIFICATION
-- ============================================

DO $$ 
DECLARE
  table_count INTEGER;
  enum_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
  
  -- Count enums
  SELECT COUNT(*) INTO enum_count
  FROM pg_type 
  WHERE typname IN ('user_role', 'user_status', 'order_status', 'pickup_type', 'payment_method', 'payment_status', 'email_service');
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🎉 NIZE LOGISTICS DATABASE INITIALIZED!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📊 Tables created: %', table_count;
  RAISE NOTICE '🎨 Enums created: %', enum_count;
  RAISE NOTICE '🚀 Indexes created: %', index_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Database is ready for use!';
  RAISE NOTICE '🚚 ...Plenty Waka!';
  RAISE NOTICE '============================================';
END $$;

-- Return success message
SELECT 
  '✅ Database initialized successfully!' as status,
  6 as tables_created,
  7 as enums_created,
  13 as indexes_created,
  '...Plenty Waka! 🚚' as message;
