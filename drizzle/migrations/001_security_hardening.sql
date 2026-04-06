-- ============================================================
-- Migration 001: Security Hardening & Financial Integrity
-- PS Lounge SaaS v4 — PostgreSQL / Supabase Compatible
-- ============================================================
-- IMPORTANT: Run AFTER supabase/migrations/001, 002, 003
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PREVENT DUPLICATE ACTIVE SESSIONS PER DEVICE
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_device
  ON sessions (device_id)
  WHERE ended_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. DATA INTEGRITY CONSTRAINTS
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_end_after_start'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT chk_end_after_start
      CHECK (ended_at IS NULL OR ended_at >= started_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_cost'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT chk_positive_cost
      CHECK (cost IS NULL OR cost >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_non_negative_points'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT chk_non_negative_points
      CHECK (points >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_sell_price'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT chk_positive_sell_price
      CHECK (sell_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_stock'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT chk_positive_stock
      CHECK (stock_qty >= 0);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_device_active
  ON sessions (device_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_started_at
  ON sessions (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_staff
  ON sessions (staff_id);

CREATE INDEX IF NOT EXISTS idx_sessions_customer
  ON sessions (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_staff    ON sales (staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_created  ON sales (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. AUDIT LOG TABLE (append-only)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id),
  action     TEXT NOT NULL CHECK (action IN (
    'START_SESSION','STOP_SESSION','RESTOCK','SALE','END_SHIFT'
  )),
  table_name TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  old_value  JSONB,
  new_value  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_record  ON audit_log (record_id, table_name);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit"  ON audit_log;
DROP POLICY IF EXISTS "no_delete_audit"   ON audit_log;
DROP POLICY IF EXISTS "no_update_audit"   ON audit_log;

CREATE POLICY "admin_read_audit" ON audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "no_delete_audit" ON audit_log FOR DELETE TO authenticated
  USING (FALSE);

CREATE POLICY "no_update_audit" ON audit_log FOR UPDATE TO authenticated
  USING (FALSE);

-- ─────────────────────────────────────────────────────────────
-- 5. AUDIT TRIGGER ON SESSIONS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_session_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_value)
    VALUES (auth.uid(), 'START_SESSION', 'sessions', NEW.id::TEXT, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (auth.uid(), 'STOP_SESSION', 'sessions', NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_audit ON sessions;
CREATE TRIGGER trg_sessions_audit
  AFTER INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION log_session_change();

-- ─────────────────────────────────────────────────────────────
-- 6. GHOST SESSION REAPER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reap_ghost_sessions()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  reaped INTEGER;
BEGIN
  WITH ghost AS (
    UPDATE sessions SET
      ended_at = started_at + INTERVAL '12 hours',
      cost     = ROUND(
        12.0 * COALESCE(
          (SELECT CASE WHEN mode = 'single' THEN price_single ELSE price_multi END
           FROM devices WHERE id = device_id), 0
        ), 2
      ),
      notes = COALESCE(notes || ' | ', '') ||
              '[AUTO-CLOSED ghost session at ' || NOW()::TEXT || ']'
    WHERE ended_at IS NULL
      AND started_at < NOW() - INTERVAL '12 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO reaped FROM ghost;
  RETURN reaped;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. SERVER-SIDE start_session WITH ROW LOCKING + game_played
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION start_session(
  p_device_id   INTEGER,
  p_customer_id UUID    DEFAULT NULL,
  p_mode        TEXT    DEFAULT 'single',
  p_hourly_rate NUMERIC DEFAULT NULL,
  p_game_played TEXT    DEFAULT NULL
) RETURNS sessions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess sessions;
BEGIN
  -- Lock device row to prevent concurrent starts
  PERFORM id FROM devices WHERE id = p_device_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_UNAVAILABLE: Device % not found', p_device_id;
  END IF;

  -- Check no active session exists
  IF EXISTS (SELECT 1 FROM sessions WHERE device_id = p_device_id AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION: Device % already has an active session', p_device_id;
  END IF;

  INSERT INTO sessions (device_id, customer_id, mode, game_played, started_at, staff_id)
  VALUES (p_device_id, p_customer_id, p_mode, p_game_played, NOW(), auth.uid())
  RETURNING * INTO sess;

  RETURN sess;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. SERVER-SIDE stop_session
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION stop_session(p_session_id UUID)
RETURNS sessions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess  sessions;
  dev   devices;
  dur_h NUMERIC;
  rate  NUMERIC;
BEGIN
  SELECT * INTO sess FROM sessions
    WHERE id = p_session_id AND ended_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Session % not active', p_session_id;
  END IF;

  SELECT * INTO dev FROM devices WHERE id = sess.device_id;

  -- Server-side duration — never trust client
  dur_h := GREATEST(
    EXTRACT(EPOCH FROM (NOW() - sess.started_at)) / 3600.0,
    1.0/60.0  -- minimum 1 minute
  );

  rate := CASE WHEN sess.mode = 'single' THEN dev.price_single ELSE dev.price_multi END;

  UPDATE sessions SET
    ended_at = NOW(),
    cost     = ROUND(dur_h * COALESCE(rate, 0), 2)
  WHERE id = p_session_id
  RETURNING * INTO sess;

  -- Award loyalty points
  IF sess.customer_id IS NOT NULL THEN
    UPDATE customers SET points = points + FLOOR(sess.cost)
    WHERE id = sess.customer_id;
  END IF;

  RETURN sess;
END;
$$;
