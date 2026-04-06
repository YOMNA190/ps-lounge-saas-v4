-- ============================================================
-- Migration 005: Multi-Tenancy + Editable Expenses + Onboarding
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. BRANCHES — كل محل = branch منفصل تماماً
-- ─────────────────────────────────────────────────────────────
CREATE TABLE branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,           -- 'قاعة PS الرئيسية'
  owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address         TEXT,
  phone           TEXT,
  plan            TEXT DEFAULT 'trial',    -- 'trial' | 'basic' | 'pro'
  plan_expires_at TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  onboarding_done BOOLEAN DEFAULT FALSE,
  -- Settings
  currency        TEXT DEFAULT 'EGP',
  timezone        TEXT DEFAULT 'Africa/Cairo',
  loyalty_limit   NUMERIC(10,2) DEFAULT 10000,  -- حد المكافأة
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Add branch_id to ALL tables
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles   ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE devices    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE sessions   ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE customers  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE shifts     ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE cards      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE card_types ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE products   ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE packages   ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- ─────────────────────────────────────────────────────────────
-- 3. EDITABLE EXPENSES — replace hardcoded constants
-- ─────────────────────────────────────────────────────────────

-- Drop old expenses table and recreate with branch_id
DROP TABLE IF EXISTS expenses CASCADE;

CREATE TABLE expenses (
  id         SERIAL PRIMARY KEY,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  category   TEXT DEFAULT 'fixed',
  is_active  BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 4. ONBOARDING FUNCTION
-- Called when a new user signs up → creates their branch + default data
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION setup_new_branch(
  p_user_id     UUID,
  p_branch_name TEXT,
  p_address     TEXT DEFAULT NULL,
  p_phone       TEXT DEFAULT NULL
) RETURNS branches LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  branch branches;
  device_names TEXT[] := ARRAY[
    'PS5 #1','PS5 #2','PS5 #3','PS5 #4','PS5 #5',
    'PS4 #6','PS4 #7','PS4 #8','PS4 #9','PS4 #10'
  ];
  d TEXT;
  i INTEGER := 1;
BEGIN
  -- 1. Create branch
  INSERT INTO branches (name, owner_id, address, phone, plan, plan_expires_at)
  VALUES (
    p_branch_name, p_user_id, p_address, p_phone,
    'trial', NOW() + INTERVAL '14 days'
  )
  RETURNING * INTO branch;

  -- 2. Set profile branch_id + role = admin
  UPDATE profiles SET branch_id = branch.id, role = 'admin'
  WHERE id = p_user_id;

  -- 3. Create 10 default devices
  FOREACH d IN ARRAY device_names LOOP
    INSERT INTO devices (name, type, price_single, price_multi, branch_id)
    VALUES (
      d,
      CASE WHEN i <= 5 THEN 'PS5' ELSE 'PS4' END,
      CASE WHEN i <= 5 THEN 25 ELSE 15 END,
      CASE WHEN i <= 5 THEN 20 ELSE 12 END,
      branch.id
    );
    i := i + 1;
  END LOOP;

  -- 4. Create default expenses (editable later)
  INSERT INTO expenses (branch_id, name, amount, sort_order) VALUES
    (branch.id, 'إيجار المحل',       0, 1),
    (branch.id, 'بضاعة / مستلزمات', 0, 2),
    (branch.id, 'صيانة',             0, 3),
    (branch.id, 'إنترنت',            0, 4),
    (branch.id, 'جمعية',             0, 5),
    (branch.id, 'مرتبات',            0, 6),
    (branch.id, 'كهرباء',            0, 7);

  -- 5. Mark onboarding done
  UPDATE branches SET onboarding_done = TRUE WHERE id = branch.id;

  RETURN branch;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. HELPER: Get current user's branch_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. UPDATE EXPENSES FUNCTION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id INTEGER,
  p_amount     NUMERIC,
  p_name       TEXT DEFAULT NULL
) RETURNS expenses LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  exp expenses;
  my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();

  -- Verify ownership
  SELECT * INTO exp FROM expenses
  WHERE id = p_expense_id AND branch_id = my_branch;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المصروف غير موجود أو لا تملك صلاحية التعديل';
  END IF;

  UPDATE expenses SET
    amount     = p_amount,
    name       = COALESCE(p_name, expenses.name),
    updated_at = NOW()
  WHERE id = p_expense_id
  RETURNING * INTO exp;

  RETURN exp;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. RLS — Row Level Security per branch (CRITICAL for SaaS)
-- ─────────────────────────────────────────────────────────────

-- Branches: only owner sees their branch
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_branch" ON branches FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR id = get_my_branch_id());

-- Expenses: branch-scoped
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_expenses" ON expenses FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id());

-- Devices: branch-scoped (replace old policy)
DROP POLICY IF EXISTS "staff_read_devices" ON devices;
CREATE POLICY "branch_devices" ON devices FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id());

-- Sessions: branch-scoped (replace old policy)
DROP POLICY IF EXISTS "staff_read_sessions"  ON sessions;
DROP POLICY IF EXISTS "insert_sessions"       ON sessions;
CREATE POLICY "branch_sessions_read" ON sessions FOR SELECT TO authenticated
  USING (
    branch_id = get_my_branch_id()
    AND (
      ended_at IS NULL
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );
CREATE POLICY "branch_sessions_insert" ON sessions FOR INSERT TO authenticated
  WITH CHECK (branch_id = get_my_branch_id());

-- Customers: branch-scoped
DROP POLICY IF EXISTS "auth_read_customers"   ON customers;
DROP POLICY IF EXISTS "auth_insert_customers" ON customers;
CREATE POLICY "branch_customers" ON customers FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id());

-- Sales: branch-scoped
DROP POLICY IF EXISTS "auth_insert_sales"   ON sales;
DROP POLICY IF EXISTS "auth_read_own_sales" ON sales;
CREATE POLICY "branch_sales" ON sales FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id());

-- Shifts: branch-scoped
DROP POLICY IF EXISTS "shifts_policy" ON shifts;
CREATE POLICY "branch_shifts" ON shifts FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id());

-- Cards: branch-scoped
DROP POLICY IF EXISTS "auth_insert_cards"    ON cards;
DROP POLICY IF EXISTS "staff_read_cards"     ON cards;
CREATE POLICY "branch_cards" ON cards FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id());

DROP POLICY IF EXISTS "auth_read_card_types"    ON card_types;
DROP POLICY IF EXISTS "admin_manage_card_types"  ON card_types;
CREATE POLICY "branch_card_types" ON card_types FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id() OR branch_id IS NULL);

-- Products: branch-scoped
DROP POLICY IF EXISTS "auth_read_products"    ON products;
DROP POLICY IF EXISTS "admin_manage_products" ON products;
CREATE POLICY "branch_products" ON products FOR ALL TO authenticated
  USING (branch_id = get_my_branch_id());

-- ─────────────────────────────────────────────────────────────
-- 8. UPDATE start_session to auto-set branch_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION start_session(
  p_device_id   INTEGER,
  p_customer_id UUID    DEFAULT NULL,
  p_mode        TEXT    DEFAULT 'single',
  p_hourly_rate NUMERIC DEFAULT NULL,
  p_game_played TEXT    DEFAULT NULL
) RETURNS sessions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess      sessions;
  my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();

  PERFORM id FROM devices
  WHERE id = p_device_id AND branch_id = my_branch FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_UNAVAILABLE: Device % not found in your branch', p_device_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE device_id = p_device_id AND branch_id = my_branch AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION: Device % already has an active session', p_device_id;
  END IF;

  INSERT INTO sessions (device_id, customer_id, mode, game_played, started_at, staff_id, branch_id)
  VALUES (p_device_id, p_customer_id, p_mode, p_game_played, NOW(), auth.uid(), my_branch)
  RETURNING * INTO sess;

  RETURN sess;
END;
$$;
