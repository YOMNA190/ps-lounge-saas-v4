-- ============================================================
-- PS LOUNGE MANAGER v3 — Full Migration
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. INVENTORY — Products (drinks, snacks, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE inventory_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,       -- 'مشروبات', 'سناكس', 'إكسسوارات'
  icon       TEXT DEFAULT '📦',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO inventory_categories (name, icon) VALUES
  ('مشروبات', '🥤'),
  ('سناكس',   '🍿'),
  ('إكسسوارات', '🎮'),
  ('أخرى',    '📦');

CREATE TABLE products (
  id             SERIAL PRIMARY KEY,
  category_id    INTEGER REFERENCES inventory_categories(id),
  name           TEXT NOT NULL,
  barcode        TEXT UNIQUE,
  cost_price     NUMERIC(10,2) NOT NULL DEFAULT 0,   -- سعر الشراء
  sell_price     NUMERIC(10,2) NOT NULL DEFAULT 0,   -- سعر البيع
  stock_qty      INTEGER NOT NULL DEFAULT 0,          -- الكمية الحالية
  min_stock_qty  INTEGER NOT NULL DEFAULT 5,          -- حد التنبيه
  unit           TEXT DEFAULT 'قطعة',                -- 'علبة', 'كيلو'
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Sample products
INSERT INTO products (category_id, name, cost_price, sell_price, stock_qty, min_stock_qty, unit) VALUES
  (1, 'بيبسي 330ml',       3.00,  7.00, 48, 10, 'علبة'),
  (1, 'سفن أب 330ml',      3.00,  7.00, 36, 10, 'علبة'),
  (1, 'مياه معدنية 600ml', 1.50,  4.00, 50, 15, 'زجاجة'),
  (1, 'ريد بول',           15.00, 30.00, 24, 5,  'علبة'),
  (1, 'نسكافيه',           5.00,  15.00, 30, 8,  'كوب'),
  (2, 'شيبسي',             5.00,  12.00, 40, 10, 'كيس'),
  (2, 'كيكة',              3.00,  8.00,  30, 8,  'قطعة'),
  (2, 'سنكرز',             8.00,  18.00, 24, 6,  'قطعة');

-- ─────────────────────────────────────────────────────────────
-- 2. SALES (POS) — Selling products, linked to session or standalone
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id),      -- NULL = standalone sale
  customer_id UUID REFERENCES customers(id),
  staff_id    UUID REFERENCES auth.users(id),
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id         SERIAL PRIMARY KEY,
  sale_id    UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,   -- snapshot of sell_price at time of sale
  unit_cost  NUMERIC(10,2) NOT NULL,   -- snapshot of cost_price (for profit calc)
  subtotal   NUMERIC(10,2) GENERATED ALWAYS AS (qty * unit_price) STORED
);

-- Auto-reduce stock on sale
CREATE OR REPLACE FUNCTION reduce_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock_qty  = stock_qty - NEW.qty,
      updated_at = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reduce_stock
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION reduce_stock_on_sale();

-- Auto-calculate sale total
CREATE OR REPLACE FUNCTION update_sale_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sales
  SET total = (SELECT COALESCE(SUM(subtotal), 0) FROM sale_items WHERE sale_id = NEW.sale_id)
  WHERE id = NEW.sale_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_sale_total
  AFTER INSERT OR UPDATE OR DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION update_sale_total();

-- ─────────────────────────────────────────────────────────────
-- 3. STOCK MOVEMENTS — Restock, adjustments, waste
-- ─────────────────────────────────────────────────────────────
CREATE TYPE stock_movement_type AS ENUM ('restock', 'sale', 'waste', 'adjustment');

CREATE TABLE stock_movements (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  type        stock_movement_type NOT NULL,
  qty_change  INTEGER NOT NULL,         -- positive = in, negative = out
  qty_before  INTEGER NOT NULL,
  qty_after   INTEGER NOT NULL,
  notes       TEXT,
  staff_id    UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Function to restock a product
CREATE OR REPLACE FUNCTION restock_product(
  p_product_id INTEGER,
  p_qty        INTEGER,
  p_notes      TEXT DEFAULT NULL,
  p_staff_id   UUID DEFAULT NULL
) RETURNS products LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  p products;
BEGIN
  SELECT * INTO p FROM products WHERE id = p_product_id;

  INSERT INTO stock_movements (product_id, type, qty_change, qty_before, qty_after, notes, staff_id)
  VALUES (p_product_id, 'restock', p_qty, p.stock_qty, p.stock_qty + p_qty, p_notes, p_staff_id);

  UPDATE products
  SET stock_qty  = stock_qty + p_qty,
      updated_at = NOW()
  WHERE id = p_product_id
  RETURNING * INTO p;

  RETURN p;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. SHIFTS — Staff shift tracking + cash reconciliation
-- ─────────────────────────────────────────────────────────────
CREATE TABLE shifts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id           UUID NOT NULL REFERENCES auth.users(id),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Server clock
  ended_at           TIMESTAMPTZ,
  opening_cash       NUMERIC(10,2) DEFAULT 0,             -- الرصيد في الدرج عند البداية
  closing_cash       NUMERIC(10,2),                       -- الكاش الفعلي في الدرج نهاية الشيفت
  expected_cash      NUMERIC(10,2),                       -- المحسوب من الجلسات والمبيعات
  cash_difference    NUMERIC(10,2),                       -- الفرق (كشف عجز/زيادة)
  sessions_revenue   NUMERIC(10,2) DEFAULT 0,
  sales_revenue      NUMERIC(10,2) DEFAULT 0,
  total_revenue      NUMERIC(10,2) DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- End shift with cash reconciliation
CREATE OR REPLACE FUNCTION end_shift(
  p_shift_id    UUID,
  p_closing_cash NUMERIC
) RETURNS shifts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  s shifts;
  sess_rev NUMERIC;
  sale_rev NUMERIC;
BEGIN
  SELECT * INTO s FROM shifts WHERE id = p_shift_id AND ended_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found or already ended'; END IF;

  -- Sessions revenue during this shift
  SELECT COALESCE(SUM(cost), 0) INTO sess_rev
  FROM sessions
  WHERE staff_id = s.staff_id
    AND started_at >= s.started_at
    AND ended_at IS NOT NULL;

  -- Sales revenue during this shift
  SELECT COALESCE(SUM(total), 0) INTO sale_rev
  FROM sales
  WHERE staff_id = s.staff_id
    AND created_at >= s.started_at;

  UPDATE shifts SET
    ended_at         = NOW(),
    closing_cash     = p_closing_cash,
    sessions_revenue = sess_rev,
    sales_revenue    = sale_rev,
    total_revenue    = sess_rev + sale_rev,
    expected_cash    = s.opening_cash + sess_rev + sale_rev,
    cash_difference  = p_closing_cash - (s.opening_cash + sess_rev + sale_rev)
  WHERE id = p_shift_id
  RETURNING * INTO s;

  RETURN s;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. PACKAGES / OFFERS — Discounted bundles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE packages (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,         -- 'باقة الساعتين', 'عرض الجمعة'
  description   TEXT,
  device_type   TEXT,                  -- 'PS5', 'PS4', NULL = all
  mode          TEXT CHECK (mode IN ('single','multi', 'both')) DEFAULT 'both',
  duration_mins INTEGER NOT NULL,      -- مدة الباقة بالدقائق
  price         NUMERIC(10,2) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  valid_days    TEXT[] DEFAULT ARRAY['sat','sun','mon','tue','wed','thu','fri'],
  valid_from    TIME DEFAULT '00:00',
  valid_to      TIME DEFAULT '23:59',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO packages (name, description, device_type, mode, duration_mins, price) VALUES
  ('باقة الساعة',      'ساعة كاملة بسعر ثابت',       'PS5', 'single', 60,  20),
  ('باقة الساعتين',    'ساعتين بسعر مخفوض',           'PS5', 'single', 120, 35),
  ('باقة 3 ساعات',     '3 ساعات للاثنين',             'PS5', 'multi',  180, 50),
  ('عرض PS4 ساعة',     'ساعة PS4 بسعر خاص',           'PS4', 'single', 60,  12),
  ('عرض PS4 ساعتين',   'ساعتين PS4 مخفوض',            'PS4', 'single', 120, 20);

-- ─────────────────────────────────────────────────────────────
-- 6. RESERVATIONS — Pre-book a device
-- ─────────────────────────────────────────────────────────────
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

CREATE TABLE reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   INTEGER REFERENCES devices(id),
  customer_id UUID REFERENCES customers(id),
  package_id  INTEGER REFERENCES packages(id),
  reserved_at TIMESTAMPTZ NOT NULL,   -- موعد الحجز
  duration_mins INTEGER NOT NULL DEFAULT 60,
  mode        TEXT CHECK (mode IN ('single','multi')) DEFAULT 'single',
  status      reservation_status DEFAULT 'pending',
  notes       TEXT,
  staff_id    UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. ALERTS — Low stock notifications
-- ─────────────────────────────────────────────────────────────
CREATE TABLE alerts (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,      -- 'low_stock', 'long_session', 'shift_reminder'
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  entity_id   TEXT,               -- product_id or session_id
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create low stock alert
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock_qty <= NEW.min_stock_qty AND NEW.stock_qty != OLD.stock_qty THEN
    INSERT INTO alerts (type, title, message, entity_id)
    VALUES (
      'low_stock',
      'مخزون منخفض: ' || NEW.name,
      'الكمية المتبقية ' || NEW.stock_qty || ' ' || NEW.unit || ' — الحد الأدنى ' || NEW.min_stock_qty,
      NEW.id::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_low_stock_alert
  AFTER UPDATE OF stock_qty ON products
  FOR EACH ROW EXECUTE FUNCTION check_low_stock();

-- ─────────────────────────────────────────────────────────────
-- 8. ANALYTICS VIEWS — Extended
-- ─────────────────────────────────────────────────────────────

-- Daily combined revenue (sessions + sales)
CREATE OR REPLACE VIEW daily_combined_revenue AS
SELECT
  DATE(created_at AT TIME ZONE 'Africa/Cairo') AS day,
  'sales' AS source,
  COUNT(*) AS tx_count,
  SUM(total) AS revenue
FROM sales
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at AT TIME ZONE 'Africa/Cairo')

UNION ALL

SELECT
  DATE(ended_at AT TIME ZONE 'Africa/Cairo') AS day,
  'sessions' AS source,
  COUNT(*) AS tx_count,
  SUM(cost) AS revenue
FROM sessions
WHERE ended_at IS NOT NULL
  AND ended_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(ended_at AT TIME ZONE 'Africa/Cairo');

-- Product profitability
CREATE OR REPLACE VIEW product_profit_summary AS
SELECT
  p.id,
  p.name,
  p.category_id,
  c.name AS category_name,
  p.stock_qty,
  p.min_stock_qty,
  p.sell_price,
  p.cost_price,
  p.sell_price - p.cost_price AS margin_per_unit,
  ROUND(((p.sell_price - p.cost_price) / NULLIF(p.sell_price, 0)) * 100, 1) AS margin_pct,
  COALESCE(SUM(si.qty), 0) AS total_sold,
  COALESCE(SUM(si.subtotal), 0) AS total_revenue,
  COALESCE(SUM(si.qty * si.unit_cost), 0) AS total_cost,
  COALESCE(SUM(si.subtotal) - SUM(si.qty * si.unit_cost), 0) AS total_profit
FROM products p
LEFT JOIN inventory_categories c ON c.id = p.category_id
LEFT JOIN sale_items si ON si.product_id = p.id
GROUP BY p.id, p.name, p.category_id, c.name, p.stock_qty,
         p.min_stock_qty, p.sell_price, p.cost_price;

-- ─────────────────────────────────────────────────────────────
-- 9. RLS POLICIES — New tables
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;

-- All authenticated can read products/categories/packages
CREATE POLICY "auth_read_products"    ON products              FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_read_categories"  ON inventory_categories  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_read_packages"    ON packages              FOR SELECT TO authenticated USING (TRUE);

-- Staff can sell (insert sales)
CREATE POLICY "auth_insert_sales"     ON sales       FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "auth_read_own_sales"   ON sales       FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "auth_insert_sale_items" ON sale_items FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "auth_read_sale_items"   ON sale_items FOR SELECT TO authenticated USING (TRUE);

-- Admin only: stock management
CREATE POLICY "admin_manage_products" ON products    FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_manage_stock"    ON stock_movements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Shifts: staff sees own, admin sees all
CREATE POLICY "shifts_policy" ON shifts FOR ALL TO authenticated
  USING (staff_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Alerts: all authenticated
CREATE POLICY "auth_read_alerts"     ON alerts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_update_alerts"   ON alerts FOR UPDATE TO authenticated USING (TRUE);

-- Reservations
CREATE POLICY "auth_manage_reservations" ON reservations FOR ALL TO authenticated USING (TRUE);
