-- ============================================================
-- Migration 006: Security Hardening + Performance Indexes
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. FIX sell_card — add branch isolation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sell_card(
  p_type_id        INTEGER,
  p_customer_id    UUID    DEFAULT NULL,
  p_payment_method TEXT    DEFAULT 'cash',
  p_payment_ref    TEXT    DEFAULT NULL,
  p_sale_price     NUMERIC DEFAULT NULL,
  p_notes          TEXT    DEFAULT NULL
) RETURNS cards LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  card      cards;
  ctype     card_types;
  remaining INTEGER;
  my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();

  -- Get card type AND verify it belongs to our branch
  SELECT * INTO ctype
  FROM card_types
  WHERE id = p_type_id
    AND is_active = TRUE
    AND (branch_id = my_branch OR branch_id IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'نوع الكارت غير موجود أو لا تملك صلاحية الوصول إليه';
  END IF;

  -- Get first available card (FIFO) — scoped to branch
  SELECT * INTO card
  FROM cards
  WHERE type_id  = p_type_id
    AND status   = 'available'
    AND (branch_id = my_branch OR branch_id IS NULL)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا توجد كروت متاحة من هذا النوع';
  END IF;

  -- Mark card as sold
  UPDATE cards SET
    status         = 'sold',
    sold_at        = NOW(),
    sold_to        = p_customer_id,
    sold_by        = auth.uid(),
    sale_price     = COALESCE(p_sale_price, ctype.sell_price),
    payment_method = p_payment_method::card_payment_method,
    payment_ref    = p_payment_ref,
    notes          = p_notes,
    branch_id      = my_branch
  WHERE id = card.id
  RETURNING * INTO card;

  -- Check low stock and alert
  SELECT COUNT(*) INTO remaining
  FROM cards
  WHERE type_id = p_type_id
    AND status  = 'available'
    AND (branch_id = my_branch OR branch_id IS NULL);

  IF remaining <= ctype.low_stock_alert THEN
    INSERT INTO alerts (type, title, message, entity_id)
    VALUES (
      'low_stock',
      'كروت منخفضة: ' || ctype.name,
      'متبقي ' || remaining || ' كارت فقط — يرجى إعادة التخزين',
      p_type_id::TEXT
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN card;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. FIX end_shift — verify branch ownership
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION end_shift(
  p_shift_id     UUID,
  p_pin          TEXT,
  p_closing_cash NUMERIC,
  p_cash_taken   NUMERIC,
  p_cash_left    NUMERIC
) RETURNS shifts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  shift_rec shifts;
  staff_rec profiles;
  my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();

  -- Get shift — must belong to our branch
  SELECT * INTO shift_rec
  FROM shifts
  WHERE id = p_shift_id
    AND branch_id = my_branch
    AND ended_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الشيفت غير موجود أو لا تملك صلاحية إنهائه';
  END IF;

  -- Verify PIN
  SELECT * INTO staff_rec FROM profiles WHERE id = shift_rec.staff_id;
  IF staff_rec.shift_pin IS NULL OR crypt(p_pin, staff_rec.shift_pin) <> staff_rec.shift_pin THEN
    RAISE EXCEPTION 'PIN غير صحيح';
  END IF;

  -- Calculate revenues for this shift
  UPDATE shifts SET
    ended_at         = NOW(),
    closing_cash     = p_closing_cash,
    cash_taken       = p_cash_taken,
    cash_left        = p_cash_left,
    cash_difference  = p_closing_cash - expected_cash
  WHERE id = p_shift_id
  RETURNING * INTO shift_rec;

  RETURN shift_rec;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. PERFORMANCE INDEXES (missing from earlier migrations)
-- ─────────────────────────────────────────────────────────────

-- Sessions — most frequent queries
CREATE INDEX IF NOT EXISTS idx_sessions_branch_active
  ON sessions (branch_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_branch_date
  ON sessions (branch_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_customer_branch
  ON sessions (customer_id, branch_id) WHERE customer_id IS NOT NULL;

-- Devices
CREATE INDEX IF NOT EXISTS idx_devices_branch
  ON devices (branch_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_branch
  ON customers (branch_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers (phone) WHERE phone IS NOT NULL;

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_branch_date
  ON sales (branch_id, created_at DESC);

-- Cards
CREATE INDEX IF NOT EXISTS idx_cards_branch_status
  ON cards (branch_id, status);

CREATE INDEX IF NOT EXISTS idx_cards_type_branch_available
  ON cards (type_id, branch_id) WHERE status = 'available';

-- Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_branch_staff
  ON shifts (branch_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_shifts_active
  ON shifts (branch_id) WHERE ended_at IS NULL;

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_branch
  ON expenses (branch_id) WHERE is_active = TRUE;

-- Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unread
  ON alerts (created_at DESC) WHERE is_read = FALSE;

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_branch
  ON profiles (branch_id);

-- ─────────────────────────────────────────────────────────────
-- 4. AUTO-SET branch_id ON INSERT via triggers
-- So developers never forget to pass branch_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_set_branch_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := get_my_branch_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to all tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['devices','sessions','customers','sales','shifts','cards','card_types','products','packages','reservations','expenses'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_auto_branch_%I ON %I;
      CREATE TRIGGER trg_auto_branch_%I
        BEFORE INSERT ON %I
        FOR EACH ROW EXECUTE FUNCTION auto_set_branch_id();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. UPDATE profiles trigger — create profile on signup
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'admin'  -- first user of a new branch is always admin
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
