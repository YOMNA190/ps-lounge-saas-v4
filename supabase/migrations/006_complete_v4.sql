-- ============================================================
-- PS Lounge Manager v4 — Complete Migration
-- Includes: Bug fixes + All 10 Phases
-- Prerequisite: the baseline schema (001–005) must already exist.
-- ============================================================

-- ============================================================
-- PART 0: CRITICAL BUG FIXES
-- ============================================================

-- BUG 1: alerts table missing branch_id
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
UPDATE alerts SET branch_id = get_my_branch_id() WHERE branch_id IS NULL;
ALTER TABLE alerts ALTER COLUMN branch_id SET NOT NULL;

DROP POLICY IF EXISTS "alerts_select" ON alerts;
DROP POLICY IF EXISTS "alerts_insert" ON alerts;
DROP POLICY IF EXISTS "alerts_update" ON alerts;
DROP POLICY IF EXISTS "alerts_delete" ON alerts;

CREATE POLICY "alerts_select" ON alerts FOR SELECT TO authenticated USING (branch_id = get_my_branch_id());
CREATE POLICY "alerts_insert" ON alerts FOR INSERT TO authenticated WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "alerts_update" ON alerts FOR UPDATE TO authenticated USING (branch_id = get_my_branch_id());
CREATE POLICY "alerts_delete" ON alerts FOR DELETE TO authenticated USING (branch_id = get_my_branch_id());

-- BUG 2: sale_items RLS missing WITH CHECK
DROP POLICY IF EXISTS "branch_sale_items" ON sale_items;

CREATE POLICY "branch_sale_items_select" ON sale_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sales WHERE id = sale_items.sale_id AND branch_id = get_my_branch_id()));
CREATE POLICY "branch_sale_items_insert" ON sale_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE id = sale_items.sale_id AND branch_id = get_my_branch_id()));
CREATE POLICY "branch_sale_items_update" ON sale_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM sales WHERE id = sale_items.sale_id AND branch_id = get_my_branch_id()));
CREATE POLICY "branch_sale_items_delete" ON sale_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM sales WHERE id = sale_items.sale_id AND branch_id = get_my_branch_id()));

-- BUG 3: sessions UPDATE policy too permissive
DROP POLICY IF EXISTS "sessions_update" ON sessions;
CREATE POLICY "sessions_update_notes" ON sessions FOR UPDATE TO authenticated USING (branch_id = get_my_branch_id() AND ended_at IS NULL) WITH CHECK (branch_id = get_my_branch_id());

-- BUG 4: updated_at triggers
ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
DROP TRIGGER IF EXISTS trg_devices_updated_at ON devices;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- BUG 5: Missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_devices_branch_active ON devices(branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_branches_owner ON branches(owner_id);
CREATE INDEX IF NOT EXISTS idx_card_types_branch ON card_types(branch_id);
CREATE INDEX IF NOT EXISTS idx_cards_sold_by ON cards(sold_by);
CREATE INDEX IF NOT EXISTS idx_cards_sold_to ON cards(sold_to);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_branch ON inventory_categories(branch_id);
CREATE INDEX IF NOT EXISTS idx_packages_branch ON packages(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_reservations_branch ON reservations(branch_id);
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_device ON reservations(device_id);
CREATE INDEX IF NOT EXISTS idx_reservations_package ON reservations(package_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff ON shifts(staff_id);

-- Existing reporting views must respect the querying user's RLS policies.
ALTER VIEW customer_monthly_spending SET (security_invoker = true);
ALTER VIEW daily_device_revenue SET (security_invoker = true);
ALTER VIEW top_customers_monthly SET (security_invoker = true);
ALTER VIEW top_games_monthly SET (security_invoker = true);
ALTER VIEW card_inventory_summary SET (security_invoker = true);
ALTER VIEW card_sales_report SET (security_invoker = true);

-- ============================================================
-- PHASE 1: AUDIT LOG SYSTEM
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_select" ON audit_log
  FOR SELECT TO authenticated
  USING (branch_id = get_my_branch_id() AND EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_audit_log_branch_date ON audit_log(branch_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_staff ON audit_log(staff_id);

CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT, p_table_name TEXT, p_record_id TEXT,
  p_old_values JSONB DEFAULT NULL, p_new_values JSONB DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log(branch_id, staff_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, notes)
  VALUES (get_my_branch_id(), auth.uid(), p_action, p_table_name, p_record_id, p_old_values, p_new_values, inet_client_addr(), NULL, p_notes);
END;
$$;

ALTER FUNCTION log_audit(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION log_audit(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;

-- ============================================================
-- PHASE 2: UNIFIED BILL SYSTEM
-- ============================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'vodafone_cash', 'instapay', 'debt', 'subscription'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0 CHECK (discount_amount >= 0);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- stop_session_with_bill maintains these customer aggregates, so they must
-- exist before that function is created and can be executed.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rank TEXT DEFAULT 'bronze' CHECK (rank IN ('bronze', 'silver', 'gold', 'champion'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION add_order_to_session(
  p_session_id UUID, p_product_id INTEGER, p_qty INTEGER, p_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess sessions; prod products; sale_rec sales; item sale_items; my_branch UUID;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  my_branch := get_my_branch_id();
  SELECT * INTO sess FROM sessions WHERE id = p_session_id AND branch_id = my_branch AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_ACTIVE: الجلسة غير موجودة أو منتهية'; END IF;
  SELECT * INTO prod FROM products WHERE id = p_product_id AND branch_id = my_branch AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND: المنتج غير موجود'; END IF;
  IF prod.stock_qty < p_qty THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK: الكمية غير متوفرة. المتاح: %', prod.stock_qty; END IF;

  SELECT * INTO sale_rec FROM sales WHERE session_id = p_session_id AND branch_id = my_branch LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO sales(session_id, customer_id, staff_id, branch_id, total) VALUES(p_session_id, sess.customer_id, auth.uid(), my_branch, 0) RETURNING * INTO sale_rec;
  END IF;

  INSERT INTO sale_items(sale_id, product_id, qty, unit_price, unit_cost) VALUES(sale_rec.id, p_product_id, p_qty, prod.sell_price, prod.cost_price) RETURNING * INTO item;
  -- trg_after_sale_item already updates the sale total and reduces stock once.

  PERFORM log_audit('order_added_to_session', 'sale_items', item.id::TEXT, NULL, jsonb_build_object('session_id', p_session_id, 'product', prod.name, 'qty', p_qty, 'price', prod.sell_price), 'Order added to session ' || p_session_id);

  RETURN jsonb_build_object('success', true, 'sale_id', sale_rec.id, 'item_id', item.id, 'product_name', prod.name, 'qty', p_qty, 'unit_price', prod.sell_price, 'subtotal', p_qty * prod.sell_price);
END;
$$;

ALTER FUNCTION add_order_to_session(UUID, INTEGER, INTEGER, TEXT) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION add_order_to_session(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_order_to_session(UUID, INTEGER, INTEGER, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_session_bill(p_session_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess sessions; dev devices; sale_rec sales; items JSONB; session_cost NUMERIC; orders_total NUMERIC; discount NUMERIC; grand_total NUMERIC;
BEGIN
  SELECT * INTO sess FROM sessions WHERE id = p_session_id AND branch_id = get_my_branch_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  SELECT * INTO dev FROM devices WHERE id = sess.device_id;

  IF sess.ended_at IS NOT NULL THEN session_cost := sess.cost;
  ELSE session_cost := ROUND(GREATEST(EXTRACT(EPOCH FROM (NOW() - sess.started_at)) / 3600.0, 1.0/60.0) * CASE WHEN sess.mode = 'single' THEN dev.price_single ELSE dev.price_multi END, 2);
  END IF;

  SELECT * INTO sale_rec FROM sales WHERE session_id = p_session_id AND branch_id = get_my_branch_id() ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', p.name, 'qty', si.qty, 'unit_price', si.unit_price, 'subtotal', si.subtotal)), '[]'::jsonb) INTO items
    FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = sale_rec.id;
    orders_total := COALESCE(sale_rec.total, 0);
  ELSE
    items := '[]'::jsonb;
    orders_total := 0;
  END IF;
  discount := COALESCE(sess.discount_amount, 0); grand_total := COALESCE(session_cost, 0) + orders_total - discount;

  RETURN jsonb_build_object('session_id', p_session_id, 'device_name', dev.name, 'customer_name', (SELECT name FROM customers WHERE id = sess.customer_id), 'started_at', sess.started_at, 'ended_at', sess.ended_at, 'mode', sess.mode, 'session_cost', session_cost, 'orders', items, 'orders_total', orders_total, 'discount', discount, 'discount_reason', sess.discount_reason, 'grand_total', GREATEST(grand_total, 0), 'payment_method', sess.payment_method, 'is_paid', sess.is_paid);
END;
$$;

ALTER FUNCTION get_session_bill(UUID) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION get_session_bill(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_session_bill(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION stop_session_with_bill(
  p_session_id UUID, p_discount_amount NUMERIC DEFAULT 0, p_discount_reason TEXT DEFAULT NULL, p_payment_method TEXT DEFAULT 'cash'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sess sessions; dev devices; dur_h NUMERIC; rate NUMERIC; session_cost NUMERIC; sale_rec sales; orders_total NUMERIC; grand_total NUMERIC;
BEGIN
  IF p_payment_method NOT IN ('cash', 'vodafone_cash', 'instapay', 'debt', 'subscription') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_discount_amount IS NULL OR p_discount_amount < 0 THEN RAISE EXCEPTION 'INVALID_DISCOUNT'; END IF;
  SELECT * INTO sess FROM sessions WHERE id = p_session_id AND branch_id = get_my_branch_id() AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  IF p_payment_method = 'debt' AND sess.customer_id IS NULL THEN RAISE EXCEPTION 'DEBT_REQUIRES_CUSTOMER'; END IF;
  SELECT * INTO dev FROM devices WHERE id = sess.device_id;

  dur_h := GREATEST(EXTRACT(EPOCH FROM (NOW() - sess.started_at)) / 3600.0, 1.0/60.0);
  rate := CASE WHEN sess.mode = 'single' THEN dev.price_single ELSE dev.price_multi END;
  session_cost := ROUND(dur_h * rate, 2);

  SELECT COALESCE(SUM(total), 0) INTO orders_total FROM sales WHERE session_id = p_session_id AND branch_id = get_my_branch_id();
  IF p_discount_amount > session_cost + orders_total THEN RAISE EXCEPTION 'DISCOUNT_TOO_HIGH: الخصم أكبر من الإجمالي'; END IF;
  grand_total := session_cost + orders_total - p_discount_amount;

  UPDATE sessions SET ended_at = NOW(), cost = session_cost, discount_amount = p_discount_amount, discount_reason = p_discount_reason, payment_method = p_payment_method, is_paid = CASE WHEN p_payment_method = 'debt' THEN FALSE ELSE TRUE END WHERE id = p_session_id RETURNING * INTO sess;
  UPDATE sales SET is_paid = CASE WHEN p_payment_method = 'debt' THEN FALSE ELSE TRUE END WHERE session_id = p_session_id;

  IF sess.customer_id IS NOT NULL THEN
    IF grand_total > 0 AND p_payment_method != 'debt' THEN
      UPDATE customers SET points = points + FLOOR(grand_total), total_spent = total_spent + grand_total, total_hours = total_hours + dur_h, visit_count = visit_count + 1 WHERE id = sess.customer_id;
    END IF;
    IF p_payment_method = 'debt' THEN
      INSERT INTO debts(customer_id, session_id, amount, reason, status, created_by, branch_id) VALUES(sess.customer_id, p_session_id, grand_total, 'Gaming session + orders', 'pending', auth.uid(), get_my_branch_id());
    END IF;
    PERFORM check_and_award_achievements(sess.customer_id);
    PERFORM update_customer_rank(sess.customer_id);
  END IF;

  PERFORM log_audit('session_stop', 'sessions', sess.id::TEXT, jsonb_build_object('started_at', sess.started_at, 'cost', NULL, 'is_paid', FALSE), jsonb_build_object('ended_at', sess.ended_at, 'cost', session_cost, 'discount', p_discount_amount, 'payment', p_payment_method, 'grand_total', grand_total), 'Session closed. Total: ' || grand_total || ' EGP');

  RETURN jsonb_build_object('session', sess, 'session_cost', session_cost, 'orders_total', orders_total, 'discount', p_discount_amount, 'grand_total', grand_total, 'payment_method', p_payment_method);
END;
$$;

ALTER FUNCTION stop_session_with_bill(UUID, NUMERIC, TEXT, TEXT) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION stop_session_with_bill(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stop_session_with_bill(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- ============================================================
-- PHASE 3: LOYALTY RANKS & ACHIEVEMENTS
-- ============================================================

CREATE TABLE achievements (
  id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, icon TEXT DEFAULT '🏆',
  condition_type TEXT NOT NULL CHECK (condition_type IN ('hours', 'spent', 'visits', 'streak')), condition_value NUMERIC NOT NULL DEFAULT 0,
  reward_points INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO achievements(code, name, description, icon, condition_type, condition_value, reward_points) VALUES
('first_visit', 'أول زيارة', 'لعبت أول جلسة عندنا', '🎮', 'visits', 1, 50),
('regular', 'زبون دائم', '10 زيارات', '⭐', 'visits', 10, 100),
('hours_100', '100 ساعة لعب', 'لعبت 100 ساعة', '⏰', 'hours', 100, 200),
('hours_500', '500 ساعة لعب', 'لعبت 500 ساعة', '🔥', 'hours', 500, 500),
('big_spender_1000', 'كبار الزبائن', 'صرفت 1000 جنيه', '💰', 'spent', 1000, 100),
('big_spender_5000', 'أسطورة الإنفاق', 'صرفت 5000 جنيه', '👑', 'spent', 5000, 300),
('night_owl', 'بومة الليل', 'لعبت بعد منتصف الليل 5 مرات', '🦉', 'streak', 5, 100)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE customer_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id), unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, achievement_id)
);

ALTER TABLE customer_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_customer_achievements" ON customer_achievements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM customers WHERE id = customer_achievements.customer_id AND branch_id = get_my_branch_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM customers WHERE id = customer_achievements.customer_id AND branch_id = get_my_branch_id()));

CREATE OR REPLACE FUNCTION update_customer_rank(p_customer_id UUID) RETURNS customers LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cust customers; new_rank TEXT;
BEGIN
  SELECT * INTO cust FROM customers WHERE id = p_customer_id AND branch_id = get_my_branch_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;
  new_rank := CASE WHEN cust.total_spent >= 10000 THEN 'champion' WHEN cust.total_spent >= 5000 THEN 'gold' WHEN cust.total_spent >= 1000 THEN 'silver' ELSE 'bronze' END;
  UPDATE customers SET rank = new_rank WHERE id = p_customer_id; cust.rank := new_rank; RETURN cust;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_award_achievements(p_customer_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cust customers; ach achievements; new_achievements JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO cust FROM customers WHERE id = p_customer_id AND branch_id = get_my_branch_id();
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  FOR ach IN SELECT * FROM achievements LOOP
    IF EXISTS (SELECT 1 FROM customer_achievements WHERE customer_id = p_customer_id AND achievement_id = ach.id) THEN CONTINUE; END IF;
    IF (ach.condition_type = 'hours' AND cust.total_hours >= ach.condition_value) OR (ach.condition_type = 'spent' AND cust.total_spent >= ach.condition_value) OR (ach.condition_type = 'visits' AND cust.visit_count >= ach.condition_value) THEN
      INSERT INTO customer_achievements(customer_id, achievement_id) VALUES(p_customer_id, ach.id);
      UPDATE customers SET points = points + ach.reward_points WHERE id = p_customer_id;
      new_achievements := new_achievements || jsonb_build_object('achievement', ach.name, 'icon', ach.icon, 'points', ach.reward_points);
      PERFORM log_audit('achievement_unlocked', 'customer_achievements', p_customer_id, NULL, jsonb_build_object('achievement', ach.name, 'points', ach.reward_points), 'Achievement unlocked: ' || ach.name);
    END IF;
  END LOOP;
  RETURN new_achievements;
END;
$$;

-- ============================================================
-- PHASE 4: DEBT TRACKING
-- ============================================================

CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL REFERENCES customers(id),
  session_id UUID REFERENCES sessions(id), sale_id UUID REFERENCES sales(id), amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL, status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'waived')),
  amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0), paid_at TIMESTAMPTZ, notes TEXT,
  created_by UUID REFERENCES auth.users(id), branch_id UUID NOT NULL REFERENCES branches(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_debts" ON debts FOR ALL TO authenticated USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());

CREATE INDEX idx_debts_customer ON debts(customer_id, status);
CREATE INDEX idx_debts_branch_status ON debts(branch_id, status);

CREATE OR REPLACE VIEW customer_debt_summary AS
SELECT c.id AS customer_id, c.name, c.phone, COUNT(d.id) FILTER (WHERE d.status IN ('pending', 'partial')) AS pending_debts,
  COALESCE(SUM(d.amount - d.amount_paid) FILTER (WHERE d.status IN ('pending', 'partial')), 0) AS total_pending,
  COALESCE(SUM(d.amount), 0) AS total_debt_history, COALESCE(SUM(d.amount_paid), 0) AS total_paid
FROM customers c LEFT JOIN debts d ON d.customer_id = c.id WHERE c.branch_id = get_my_branch_id() GROUP BY c.id, c.name, c.phone;

ALTER VIEW customer_debt_summary SET (security_invoker = true);

CREATE OR REPLACE FUNCTION pay_debt(p_debt_id UUID, p_amount NUMERIC, p_payment_method TEXT DEFAULT 'cash') RETURNS debts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE d debts; remaining NUMERIC;
BEGIN
  SELECT * INTO d FROM debts WHERE id = p_debt_id AND branch_id = get_my_branch_id() AND status IN ('pending', 'partial');
  IF NOT FOUND THEN RAISE EXCEPTION 'DEBT_NOT_FOUND'; END IF;
  remaining := d.amount - d.amount_paid;
  IF p_amount > remaining THEN RAISE EXCEPTION 'OVERPAYMENT: المبلغ أكبر من الدين المتبقي'; END IF;
  UPDATE debts SET amount_paid = amount_paid + p_amount, status = CASE WHEN amount_paid + p_amount >= amount THEN 'paid' ELSE 'partial' END, paid_at = CASE WHEN amount_paid + p_amount >= amount THEN NOW() ELSE paid_at END WHERE id = p_debt_id RETURNING * INTO d;
  PERFORM log_audit('debt_payment', 'debts', p_debt_id, jsonb_build_object('amount_paid_before', d.amount_paid - p_amount), jsonb_build_object('amount_paid_after', d.amount_paid, 'status', d.status), 'Debt payment: ' || p_amount || ' EGP');
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION waive_debt(p_debt_id UUID, p_reason TEXT) RETURNS debts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE d debts;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'ADMIN_ONLY'; END IF;
  SELECT * INTO d FROM debts WHERE id = p_debt_id AND branch_id = get_my_branch_id() AND status IN ('pending', 'partial');
  IF NOT FOUND THEN RAISE EXCEPTION 'DEBT_NOT_FOUND'; END IF;
  UPDATE debts SET status = 'waived', notes = COALESCE(notes || ' | ', '') || 'Waived: ' || p_reason WHERE id = p_debt_id RETURNING * INTO d;
  PERFORM log_audit('debt_waived', 'debts', p_debt_id, NULL, NULL, 'Reason: ' || p_reason); RETURN d;
END;
$$;

-- ============================================================
-- PHASE 5: HAPPY HOUR / DYNAMIC PRICING
-- ============================================================

CREATE TABLE happy_hours (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL, end_time TIME NOT NULL, discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent BETWEEN 0 AND 100),
  device_type TEXT CHECK (device_type IN ('PS4', 'PS5', 'all')) DEFAULT 'all', is_active BOOLEAN DEFAULT TRUE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE happy_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_happy_hours" ON happy_hours FOR ALL TO authenticated USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE INDEX idx_happy_hours_branch ON happy_hours(branch_id, is_active);

CREATE OR REPLACE FUNCTION check_happy_hour(p_device_type TEXT, p_branch_id UUID DEFAULT NULL) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE hh happy_hours; b_id UUID;
BEGIN
  b_id := COALESCE(p_branch_id, get_my_branch_id());
  SELECT * INTO hh FROM happy_hours WHERE branch_id = b_id AND is_active = TRUE AND day_of_week = EXTRACT(DOW FROM NOW() AT TIME ZONE 'Africa/Cairo')
    AND start_time <= (NOW() AT TIME ZONE 'Africa/Cairo')::TIME AND end_time > (NOW() AT TIME ZONE 'Africa/Cairo')::TIME AND (device_type = 'all' OR device_type = p_device_type)
  ORDER BY discount_percent DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('is_happy_hour', true, 'name', hh.name, 'discount_percent', hh.discount_percent, 'end_time', hh.end_time, 'message', 'Happy Hour: ' || hh.discount_percent || '% خصم!');
  ELSE RETURN jsonb_build_object('is_happy_hour', false); END IF;
END;
$$;

-- ============================================================
-- PHASE 6: WAITLIST
-- ============================================================

CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL, customer_phone TEXT, device_type TEXT CHECK (device_type IN ('PS4', 'PS5', 'any')) DEFAULT 'any',
  mode TEXT CHECK (mode IN ('single', 'multi')) DEFAULT 'single', preferred_time TIMESTAMPTZ,
  estimated_wait_minutes INTEGER DEFAULT 30, status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'seated', 'cancelled')),
  notified_at TIMESTAMPTZ, branch_id UUID NOT NULL REFERENCES branches(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_waitlist" ON waitlist FOR ALL TO authenticated USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE INDEX idx_waitlist_branch_status ON waitlist(branch_id, status, created_at);

CREATE OR REPLACE FUNCTION check_waitlist_and_assign() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE w waitlist; free_device devices; my_branch UUID;
BEGIN
  my_branch := get_my_branch_id();
  SELECT * INTO w FROM waitlist WHERE branch_id = my_branch AND status = 'waiting' ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('assigned', false); END IF;
  SELECT * INTO free_device FROM devices WHERE branch_id = my_branch AND is_active = TRUE AND id NOT IN (SELECT device_id FROM sessions WHERE ended_at IS NULL) AND (w.device_type = 'any' OR type = w.device_type) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('assigned', false, 'reason', 'no_devices'); END IF;
  UPDATE waitlist SET status = 'notified', notified_at = NOW() WHERE id = w.id;
  RETURN jsonb_build_object('assigned', true, 'waitlist_id', w.id, 'customer_name', w.customer_name, 'device_name', free_device.name);
END;
$$;

CREATE OR REPLACE FUNCTION trigger_check_waitlist() RETURNS TRIGGER AS $$ BEGIN IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN PERFORM check_waitlist_and_assign(); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_end_check_waitlist ON sessions;
CREATE TRIGGER trg_session_end_check_waitlist AFTER UPDATE ON sessions FOR EACH ROW WHEN (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL) EXECUTE FUNCTION trigger_check_waitlist();

-- ============================================================
-- PHASE 7: SUBSCRIPTION PLANS
-- ============================================================

CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, total_hours INTEGER NOT NULL CHECK (total_hours > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0), validity_days INTEGER DEFAULT 30, is_active BOOLEAN DEFAULT TRUE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plans(name, description, total_hours, price) VALUES
('أساسي', '20 ساعة شهرياً', 20, 300), ('فضي', '50 ساعة شهرياً', 50, 600), ('ذهبي', '100 ساعة شهرياً', 100, 1000)
ON CONFLICT DO NOTHING;

CREATE TABLE customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id), custom_name TEXT, total_hours NUMERIC(10,2) NOT NULL,
  hours_used NUMERIC(10,2) DEFAULT 0 CHECK (hours_used <= total_hours), starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, is_active BOOLEAN DEFAULT TRUE, created_by UUID REFERENCES auth.users(id),
  branch_id UUID NOT NULL REFERENCES branches(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_customer_subscriptions" ON customer_subscriptions FOR ALL TO authenticated USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE INDEX idx_subscriptions_customer ON customer_subscriptions(customer_id, is_active, expires_at);

CREATE OR REPLACE FUNCTION create_subscription(p_customer_id UUID, p_plan_id INTEGER DEFAULT NULL, p_custom_hours INTEGER DEFAULT NULL, p_custom_price NUMERIC DEFAULT NULL, p_custom_name TEXT DEFAULT NULL)
RETURNS customer_subscriptions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE sub customer_subscriptions; plan subscription_plans; hours INTEGER; price NUMERIC; name TEXT;
BEGIN
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO plan FROM subscription_plans WHERE id = p_plan_id AND (branch_id = get_my_branch_id() OR branch_id IS NULL);
    IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND'; END IF; hours := plan.total_hours; price := plan.price; name := plan.name;
  ELSE IF p_custom_hours IS NULL OR p_custom_price IS NULL THEN RAISE EXCEPTION 'CUSTOM_PLAN_REQUIRES_HOURS_AND_PRICE'; END IF;
    hours := p_custom_hours; price := p_custom_price; name := COALESCE(p_custom_name, 'Custom'); END IF;
  INSERT INTO customer_subscriptions(customer_id, plan_id, custom_name, total_hours, hours_used, starts_at, expires_at, created_by, branch_id)
  VALUES(p_customer_id, p_plan_id, name, hours, 0, NOW(), NOW() + INTERVAL '30 days', auth.uid(), get_my_branch_id()) RETURNING * INTO sub;
  PERFORM log_audit('subscription_created', 'customer_subscriptions', sub.id::TEXT, NULL, jsonb_build_object('plan', name, 'hours', hours, 'price', price), NULL); RETURN sub;
END;
$$;

CREATE OR REPLACE FUNCTION deduct_subscription_hours(p_subscription_id UUID, p_hours NUMERIC) RETURNS customer_subscriptions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE sub customer_subscriptions;
BEGIN
  SELECT * INTO sub FROM customer_subscriptions WHERE id = p_subscription_id AND branch_id = get_my_branch_id() AND is_active = TRUE AND expires_at > NOW() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND_OR_EXPIRED'; END IF;
  IF sub.hours_used + p_hours > sub.total_hours THEN RAISE EXCEPTION 'INSUFFICIENT_HOURS: متبقي % ساعة فقط', sub.total_hours - sub.hours_used; END IF;
  UPDATE customer_subscriptions SET hours_used = hours_used + p_hours WHERE id = p_subscription_id RETURNING * INTO sub;
  IF sub.hours_used >= sub.total_hours THEN UPDATE customer_subscriptions SET is_active = FALSE WHERE id = p_subscription_id; END IF;
  RETURN sub;
END;
$$;

-- ============================================================
-- PHASE 8: TOURNAMENT SYSTEM
-- ============================================================

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, game TEXT NOT NULL, start_date TIMESTAMPTZ NOT NULL,
  entry_fee NUMERIC(10,2) DEFAULT 0, prize_pool NUMERIC(10,2) DEFAULT 0, max_players INTEGER NOT NULL DEFAULT 16,
  current_players INTEGER DEFAULT 0, status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'registration_open', 'in_progress', 'completed', 'cancelled')),
  format TEXT DEFAULT 'single_elimination' CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin')),
  branch_id UUID NOT NULL REFERENCES branches(id), created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id), player_name TEXT NOT NULL, player_phone TEXT, seed INTEGER,
  is_paid BOOLEAN DEFAULT FALSE, registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL, match_number INTEGER NOT NULL, player1_id UUID REFERENCES tournament_participants(id),
  player2_id UUID REFERENCES tournament_participants(id), winner_id UUID REFERENCES tournament_participants(id),
  player1_score INTEGER, player2_score INTEGER, status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  scheduled_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, notes TEXT
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_tournaments" ON tournaments FOR ALL TO authenticated USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());
CREATE POLICY "branch_tournament_participants" ON tournament_participants FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM tournaments WHERE id = tournament_participants.tournament_id AND branch_id = get_my_branch_id())) WITH CHECK (EXISTS (SELECT 1 FROM tournaments WHERE id = tournament_participants.tournament_id AND branch_id = get_my_branch_id()));
CREATE POLICY "branch_tournament_matches" ON tournament_matches FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM tournaments WHERE id = tournament_matches.tournament_id AND branch_id = get_my_branch_id())) WITH CHECK (EXISTS (SELECT 1 FROM tournaments WHERE id = tournament_matches.tournament_id AND branch_id = get_my_branch_id()));

CREATE OR REPLACE FUNCTION generate_bracket(p_tournament_id UUID) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE participants tournament_participants[]; count INTEGER; rounds INTEGER; i INTEGER; match_num INTEGER := 1;
BEGIN
  SELECT array_agg(tp ORDER BY seed NULLS LAST, registered_at) INTO participants FROM tournament_participants tp WHERE tournament_id = p_tournament_id;
  count := array_length(participants, 1);
  IF count IS NULL OR count < 2 THEN RAISE EXCEPTION 'NOT_ENOUGH_PLAYERS: يجب 2 لاعبين على الأقل'; END IF;
  rounds := CEIL(LOG(2, count));
  FOR i IN 1..count/2 LOOP
    INSERT INTO tournament_matches(tournament_id, round, match_number, player1_id, player2_id) VALUES(p_tournament_id, 1, match_num, participants[i*2-1].id, participants[i*2].id); match_num := match_num + 1;
  END LOOP;
  IF count % 2 = 1 THEN INSERT INTO tournament_matches(tournament_id, round, match_number, player1_id, player2_id, winner_id, status) VALUES(p_tournament_id, 1, match_num, participants[count].id, NULL, participants[count].id, 'completed'); END IF;
  FOR i IN 2..rounds LOOP FOR match_num IN 1..(2^(rounds-i)) LOOP INSERT INTO tournament_matches(tournament_id, round, match_number) VALUES(p_tournament_id, i, match_num); END LOOP; END LOOP;
  UPDATE tournaments SET status = 'in_progress' WHERE id = p_tournament_id;
  PERFORM log_audit('bracket_generated', 'tournaments', p_tournament_id::TEXT, NULL, jsonb_build_object('players', count, 'rounds', rounds), NULL); RETURN rounds;
END;
$$;

-- ============================================================
-- PHASE 9: DEVICE QR CODES
-- ============================================================

CREATE TABLE device_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  qr_code_url TEXT, expires_at TIMESTAMPTZ, branch_id UUID NOT NULL REFERENCES branches(id), created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE device_qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_device_qr_codes" ON device_qr_codes FOR ALL TO authenticated USING (branch_id = get_my_branch_id()) WITH CHECK (branch_id = get_my_branch_id());

-- ============================================================
-- UPDATE start_session to log audit
-- ============================================================

-- Add audit logging to start_session by creating a wrapper
CREATE OR REPLACE FUNCTION start_session_with_audit(
  p_device_id INTEGER, p_customer_id UUID DEFAULT NULL, p_mode TEXT DEFAULT 'single',
  p_hourly_rate NUMERIC DEFAULT NULL, p_game_played TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE sess sessions;
BEGIN
  SELECT * INTO sess FROM start_session(p_device_id, p_customer_id, p_mode, p_hourly_rate, p_game_played);
  PERFORM log_audit('session_start', 'sessions', sess.id::TEXT, NULL, jsonb_build_object('device_id', p_device_id, 'customer_id', p_customer_id, 'mode', p_mode), 'Session started on device ' || p_device_id);
  RETURN jsonb_build_object('session', sess, 'success', true);
END;
$$;
