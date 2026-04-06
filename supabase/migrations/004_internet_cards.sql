-- ============================================================
-- Migration 004: Internet Cards (كروت الإنترنت)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CARD TYPES — أنواع الكروت
-- ─────────────────────────────────────────────────────────────
CREATE TABLE card_types (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,         -- 'WE 10 جيجا', 'فودافون 15 جيجا'
  provider          TEXT NOT NULL,         -- 'WE', 'فودافون', 'اتصالات', 'أورانج'
  data_amount       TEXT NOT NULL,         -- '10 جيجا', '20 جيجا', 'شهري'
  validity_days     INTEGER DEFAULT 30,    -- مدة صلاحية الكارت
  cost_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  sell_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_alert   INTEGER DEFAULT 3,     -- تنبيه لما يوصل للعدد ده
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- بيانات أولية — أنواع شائعة
INSERT INTO card_types (name, provider, data_amount, validity_days, cost_price, sell_price, low_stock_alert) VALUES
  ('WE 10 جيجا شهري',       'WE',       '10 جيجا',  30, 45, 55, 3),
  ('WE 20 جيجا شهري',       'WE',       '20 جيجا',  30, 80, 95, 3),
  ('WE 30 جيجا شهري',       'WE',       '30 جيجا',  30, 110, 130, 3),
  ('فودافون 10 جيجا',        'فودافون',  '10 جيجا',  30, 48, 58, 3),
  ('فودافون 20 جيجا',        'فودافون',  '20 جيجا',  30, 85, 100, 3),
  ('اتصالات 10 جيجا',        'اتصالات',  '10 جيجا',  30, 46, 56, 3),
  ('اتصالات 20 جيجا',        'اتصالات',  '20 جيجا',  30, 82, 97, 3),
  ('أورانج 10 جيجا',         'أورانج',   '10 جيجا',  30, 47, 57, 3);

-- ─────────────────────────────────────────────────────────────
-- 2. CARDS — الكروت الفعلية (كل صف = كارت واحد)
-- ─────────────────────────────────────────────────────────────
CREATE TYPE card_status AS ENUM ('available', 'sold', 'void');
CREATE TYPE card_payment_method AS ENUM ('vodafone_cash', 'instapay', 'cash');

CREATE TABLE cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id         INTEGER NOT NULL REFERENCES card_types(id),
  serial_code     TEXT,              -- رقم/كود الكارت (اختياري)
  status          card_status DEFAULT 'available',

  -- بيانات البيع
  sold_at         TIMESTAMPTZ,
  sold_to         UUID REFERENCES customers(id),
  sold_by         UUID REFERENCES auth.users(id),
  sale_price      NUMERIC(10,2),
  payment_method  card_payment_method,
  payment_ref     TEXT,              -- رقم العملية (InstaPay / فودافون كاش)
  notes           TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index للأداء
CREATE INDEX idx_cards_type_status ON cards (type_id, status);
CREATE INDEX idx_cards_sold_at     ON cards (sold_at DESC) WHERE sold_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. SELL CARD FUNCTION — بيع كارت بشكل atomic
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
  card    cards;
  ctype   card_types;
  remaining INTEGER;
BEGIN
  -- جيب معلومات النوع
  SELECT * INTO ctype FROM card_types WHERE id = p_type_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'نوع الكارت غير موجود أو غير نشط';
  END IF;

  -- جيب أول كارت available (FIFO)
  SELECT * INTO card
  FROM cards
  WHERE type_id = p_type_id AND status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا توجد كروت متاحة من هذا النوع';
  END IF;

  -- بيع الكارت
  UPDATE cards SET
    status         = 'sold',
    sold_at        = NOW(),
    sold_to        = p_customer_id,
    sold_by        = auth.uid(),
    sale_price     = COALESCE(p_sale_price, ctype.sell_price),
    payment_method = p_payment_method::card_payment_method,
    payment_ref    = p_payment_ref,
    notes          = p_notes
  WHERE id = card.id
  RETURNING * INTO card;

  -- تحقق لو وصل للحد الأدنى → أنشئ تنبيه
  SELECT COUNT(*) INTO remaining
  FROM cards
  WHERE type_id = p_type_id AND status = 'available';

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
-- 4. RESTOCK FUNCTION — إضافة كروت جديدة
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION restock_cards(
  p_type_id     INTEGER,
  p_quantity    INTEGER,
  p_serials     TEXT[]  DEFAULT NULL   -- اختياري: أرقام السيريال
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i INTEGER;
  serial TEXT;
BEGIN
  IF p_serials IS NOT NULL AND array_length(p_serials, 1) > 0 THEN
    -- إضافة بأرقام سيريال
    FOREACH serial IN ARRAY p_serials LOOP
      INSERT INTO cards (type_id, serial_code) VALUES (p_type_id, serial);
    END LOOP;
    RETURN array_length(p_serials, 1);
  ELSE
    -- إضافة بالكمية بدون سيريال
    FOR i IN 1..p_quantity LOOP
      INSERT INTO cards (type_id) VALUES (p_type_id);
    END LOOP;
    RETURN p_quantity;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. VIEWS — للتقارير
-- ─────────────────────────────────────────────────────────────

-- ملخص المخزون لكل نوع
CREATE OR REPLACE VIEW card_inventory_summary AS
SELECT
  ct.id,
  ct.name,
  ct.provider,
  ct.data_amount,
  ct.validity_days,
  ct.cost_price,
  ct.sell_price,
  ct.sell_price - ct.cost_price AS margin,
  ct.low_stock_alert,
  ct.is_active,
  COUNT(c.id) FILTER (WHERE c.status = 'available') AS available_count,
  COUNT(c.id) FILTER (WHERE c.status = 'sold')      AS sold_count,
  COUNT(c.id) FILTER (WHERE c.status = 'void')      AS void_count,
  (COUNT(c.id) FILTER (WHERE c.status = 'available')) <= ct.low_stock_alert AS is_low_stock
FROM card_types ct
LEFT JOIN cards c ON c.type_id = ct.id
WHERE ct.is_active = TRUE
GROUP BY ct.id, ct.name, ct.provider, ct.data_amount, ct.validity_days,
         ct.cost_price, ct.sell_price, ct.low_stock_alert, ct.is_active;

-- تقرير المبيعات اليومي
CREATE OR REPLACE VIEW card_sales_report AS
SELECT
  DATE(c.sold_at AT TIME ZONE 'Africa/Cairo') AS sale_date,
  ct.provider,
  ct.name                                      AS card_name,
  ct.data_amount,
  COUNT(c.id)                                  AS qty_sold,
  SUM(c.sale_price)                            AS total_revenue,
  SUM(ct.cost_price)                           AS total_cost,
  SUM(c.sale_price - ct.cost_price)            AS total_profit,
  c.payment_method
FROM cards c
JOIN card_types ct ON ct.id = c.type_id
WHERE c.status = 'sold'
  AND c.sold_at IS NOT NULL
GROUP BY DATE(c.sold_at AT TIME ZONE 'Africa/Cairo'),
         ct.provider, ct.name, ct.data_amount, c.payment_method
ORDER BY sale_date DESC;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS POLICIES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE card_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards      ENABLE ROW LEVEL SECURITY;

-- كل الموظفين يقروا أنواع الكروت
CREATE POLICY "auth_read_card_types" ON card_types FOR SELECT TO authenticated USING (TRUE);

-- أدمن فقط يعدل أنواع الكروت
CREATE POLICY "admin_manage_card_types" ON card_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- الموظف يشوف الكروت المتاحة والكروت اللي باعها هو
CREATE POLICY "staff_read_cards" ON cards FOR SELECT TO authenticated
  USING (
    status = 'available'
    OR sold_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- الموظف يقدر يضيف كروت (restock - admin فقط)
CREATE POLICY "admin_insert_cards" ON cards FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
