-- ============================================================
-- PlayStation Lounge Manager — Supabase Migration v1
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. USER ROLES (RBAC)
-- ─────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'staff');

CREATE TABLE profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  role      user_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Staff'), 'staff');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. DEVICES (10 PlayStation units)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE devices (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT CHECK (type IN ('PS4', 'PS5')) DEFAULT 'PS5',
  is_active     BOOLEAN DEFAULT TRUE,
  price_single  NUMERIC(8,2) NOT NULL DEFAULT 25.00,
  price_multi   NUMERIC(8,2) NOT NULL DEFAULT 20.00,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO devices (name, type, price_single, price_multi) VALUES
  ('PS5 #1',  'PS5', 25, 20),
  ('PS5 #2',  'PS5', 25, 20),
  ('PS5 #3',  'PS5', 25, 20),
  ('PS5 #4',  'PS5', 25, 20),
  ('PS5 #5',  'PS5', 25, 20),
  ('PS4 #6',  'PS4', 15, 12),
  ('PS4 #7',  'PS4', 15, 12),
  ('PS4 #8',  'PS4', 15, 12),
  ('PS4 #9',  'PS4', 15, 12),
  ('PS4 #10', 'PS4', 15, 12);

-- ─────────────────────────────────────────────────────────────
-- 3. CUSTOMERS (CRM)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT UNIQUE,
  points     INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 4. SESSIONS — Server-side timing ONLY (no client clock trust)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    INTEGER NOT NULL REFERENCES devices(id),
  customer_id  UUID REFERENCES customers(id),
  mode         TEXT NOT NULL CHECK (mode IN ('single', 'multi')),
  game_played  TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Server NOW()
  ended_at     TIMESTAMPTZ,                           -- Server NOW() on end
  cost         NUMERIC(10,2),                         -- Calculated server-side
  staff_id     UUID REFERENCES auth.users(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 5. SERVER-SIDE END SESSION FUNCTION (anti-fraud)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION end_session(session_id UUID)
RETURNS sessions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess sessions;
  dev  devices;
  duration_hours NUMERIC;
  price NUMERIC;
BEGIN
  SELECT * INTO sess FROM sessions WHERE id = session_id AND ended_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or already ended';
  END IF;

  SELECT * INTO dev FROM devices WHERE id = sess.device_id;

  -- Calculate duration using server clock — never trust client
  duration_hours := EXTRACT(EPOCH FROM (NOW() - sess.started_at)) / 3600.0;

  -- Select price based on mode
  IF sess.mode = 'single' THEN
    price := dev.price_single;
  ELSE
    price := dev.price_multi;
  END IF;

  -- Minimum charge = 30 minutes
  IF duration_hours < 0.5 THEN
    duration_hours := 0.5;
  END IF;

  UPDATE sessions
  SET
    ended_at = NOW(),
    cost = ROUND(duration_hours * price, 2)
  WHERE id = session_id
  RETURNING * INTO sess;

  -- Award loyalty points (1 point per EGP spent)
  IF sess.customer_id IS NOT NULL THEN
    UPDATE customers
    SET points = points + FLOOR(sess.cost)
    WHERE id = sess.customer_id;
  END IF;

  RETURN sess;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. FIXED EXPENSES (hardcoded monthly costs)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE expenses (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  category   TEXT DEFAULT 'fixed',
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO expenses (name, amount) VALUES
  ('إيجار المحل',          21800),
  ('بضاعة / مستلزمات',    17000),
  ('صيانة',                 2200),
  ('إنترنت',                1500),
  ('جمعية',                 4000),
  ('مرتبات',                3500),
  ('كهرباء',                4000);

-- ─────────────────────────────────────────────────────────────
-- 7. ANALYTICS VIEW — Revenue per device per day
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_device_revenue AS
SELECT
  d.id       AS device_id,
  d.name     AS device_name,
  d.type     AS device_type,
  DATE(s.ended_at AT TIME ZONE 'Africa/Cairo') AS day,
  COUNT(s.id)   AS session_count,
  ROUND(SUM(s.cost), 2) AS total_revenue,
  ROUND(AVG(s.cost), 2) AS avg_session_cost,
  ROUND(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600.0), 2) AS total_hours
FROM sessions s
JOIN devices d ON d.id = s.device_id
WHERE s.ended_at IS NOT NULL
GROUP BY d.id, d.name, d.type, DATE(s.ended_at AT TIME ZONE 'Africa/Cairo');

-- ─────────────────────────────────────────────────────────────
-- 8. TOP CUSTOMERS VIEW
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW top_customers_monthly AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.points,
  COUNT(s.id) AS session_count,
  ROUND(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600.0), 2) AS total_hours,
  ROUND(SUM(s.cost), 2) AS total_spent,
  DATE_TRUNC('month', NOW()) AS month
FROM customers c
JOIN sessions s ON s.customer_id = c.id
WHERE
  s.ended_at IS NOT NULL
  AND DATE_TRUNC('month', s.ended_at) = DATE_TRUNC('month', NOW())
GROUP BY c.id, c.name, c.phone, c.points
ORDER BY total_hours DESC;

-- ─────────────────────────────────────────────────────────────
-- 9. MOST PLAYED GAMES VIEW
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW top_games_monthly AS
SELECT
  game_played,
  COUNT(*) AS play_count,
  ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0), 2) AS total_hours
FROM sessions
WHERE
  game_played IS NOT NULL
  AND ended_at IS NOT NULL
  AND DATE_TRUNC('month', ended_at) = DATE_TRUNC('month', NOW())
GROUP BY game_played
ORDER BY play_count DESC;

-- ─────────────────────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;

-- Staff can read devices
CREATE POLICY "staff_read_devices" ON devices FOR SELECT TO authenticated USING (TRUE);

-- Staff can only see active sessions; Admin sees all
CREATE POLICY "staff_read_sessions" ON sessions FOR SELECT TO authenticated
  USING (
    ended_at IS NULL  -- active sessions visible to all staff
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only authenticated users can insert sessions
CREATE POLICY "insert_sessions" ON sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only admin can read expenses
CREATE POLICY "admin_read_expenses" ON expenses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admin can manage expenses
CREATE POLICY "admin_manage_expenses" ON expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Customers: all authenticated users
CREATE POLICY "auth_read_customers" ON customers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Profiles: users see own profile; admin sees all
CREATE POLICY "own_profile" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
