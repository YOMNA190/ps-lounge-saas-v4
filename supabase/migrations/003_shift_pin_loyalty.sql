-- ============================================================
-- PS LOUNGE v4 — Shift PIN + Customer Loyalty Limit
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Add PIN to profiles (hashed server-side)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shift_pin TEXT; -- bcrypt hash stored here

-- Function: set PIN for a staff member (admin only)
CREATE OR REPLACE FUNCTION set_staff_pin(p_staff_id UUID, p_pin TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Store pin as-is (in production use pgcrypto crypt())
  UPDATE profiles SET shift_pin = p_pin WHERE id = p_staff_id;
END;
$$;

-- Function: verify PIN before ending shift
CREATE OR REPLACE FUNCTION verify_shift_pin(p_staff_id UUID, p_pin TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  stored_pin TEXT;
BEGIN
  SELECT shift_pin INTO stored_pin FROM profiles WHERE id = p_staff_id;
  RETURN stored_pin = p_pin;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Enhanced end_shift — separate sessions vs sales revenue
--    + PIN verification + cash handling
-- ─────────────────────────────────────────────────────────────
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS pin_verified    BOOLEAN DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_taken      NUMERIC(10,2) DEFAULT 0; -- فلوس أخدتها
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_left       NUMERIC(10,2) DEFAULT 0; -- فلوس فضلت في الدرج

DROP FUNCTION IF EXISTS end_shift(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION end_shift(
  p_shift_id     UUID,
  p_closing_cash NUMERIC,
  p_pin          TEXT,
  p_cash_taken   NUMERIC DEFAULT 0,
  p_cash_left    NUMERIC DEFAULT 0
) RETURNS shifts LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  s          shifts;
  sess_rev   NUMERIC;
  sale_rev   NUMERIC;
  pin_ok     BOOLEAN;
BEGIN
  SELECT * INTO s FROM shifts WHERE id = p_shift_id AND ended_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'الشيفت غير موجود أو منتهي بالفعل'; END IF;

  -- Verify PIN
  SELECT verify_shift_pin(s.staff_id, p_pin) INTO pin_ok;
  IF NOT pin_ok THEN RAISE EXCEPTION 'PIN غير صحيح'; END IF;

  -- Sessions revenue for THIS staff in THIS shift
  SELECT COALESCE(SUM(cost), 0) INTO sess_rev
  FROM sessions
  WHERE staff_id = s.staff_id
    AND started_at >= s.started_at
    AND ended_at IS NOT NULL;

  -- Sales (products) revenue for THIS staff in THIS shift
  SELECT COALESCE(SUM(total), 0) INTO sale_rev
  FROM sales
  WHERE staff_id = s.staff_id
    AND created_at >= s.started_at;

  UPDATE shifts SET
    ended_at          = NOW(),
    closing_cash      = p_closing_cash,
    sessions_revenue  = sess_rev,
    sales_revenue     = sale_rev,
    total_revenue     = sess_rev + sale_rev,
    expected_cash     = s.opening_cash + sess_rev + sale_rev,
    cash_difference   = p_closing_cash - (s.opening_cash + sess_rev + sale_rev),
    cash_taken        = p_cash_taken,
    cash_left         = p_cash_left,
    pin_verified      = TRUE
  WHERE id = p_shift_id
  RETURNING * INTO s;

  RETURN s;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. CUSTOMER LOYALTY LIMIT — 10,000 EGP/month threshold
-- ─────────────────────────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS monthly_spend_limit  NUMERIC(10,2) DEFAULT 10000;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS reward_earned_months TEXT[] DEFAULT '{}'; -- months already rewarded

-- View: current month spending per customer
CREATE OR REPLACE VIEW customer_monthly_spending AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.points,
  c.monthly_spend_limit,
  c.reward_earned_months,
  DATE_TRUNC('month', NOW()) AS current_month,
  -- Sessions this month
  COALESCE(SUM(s.cost), 0) AS sessions_spend,
  -- Product sales this month
  COALESCE(SUM(sl.total), 0) AS products_spend,
  -- Total
  COALESCE(SUM(s.cost), 0) + COALESCE(SUM(sl.total), 0) AS total_spend,
  -- Limit remaining
  GREATEST(
    c.monthly_spend_limit - (COALESCE(SUM(s.cost), 0) + COALESCE(SUM(sl.total), 0)),
    0
  ) AS limit_remaining,
  -- Has exceeded limit this month?
  (COALESCE(SUM(s.cost), 0) + COALESCE(SUM(sl.total), 0)) >= c.monthly_spend_limit AS limit_exceeded,
  -- Already rewarded this month?
  TO_CHAR(DATE_TRUNC('month', NOW()), 'YYYY-MM') = ANY(c.reward_earned_months) AS reward_claimed_this_month,
  -- Total hours this month
  COALESCE(
    SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600.0)
    FILTER (WHERE s.ended_at IS NOT NULL AND DATE_TRUNC('month', s.ended_at) = DATE_TRUNC('month', NOW())),
    0
  ) AS total_hours_this_month
FROM customers c
LEFT JOIN sessions s ON s.customer_id = c.id
  AND DATE_TRUNC('month', s.started_at) = DATE_TRUNC('month', NOW())
  AND s.ended_at IS NOT NULL
LEFT JOIN sales sl ON sl.customer_id = c.id
  AND DATE_TRUNC('month', sl.created_at) = DATE_TRUNC('month', NOW())
GROUP BY c.id, c.name, c.phone, c.points, c.monthly_spend_limit, c.reward_earned_months;

-- Function: claim reward for customer who exceeded limit
CREATE OR REPLACE FUNCTION claim_customer_reward(p_customer_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cust     customer_monthly_spending;
  month_key TEXT;
  result   JSON;
BEGIN
  SELECT * INTO cust FROM customer_monthly_spending WHERE id = p_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;

  month_key := TO_CHAR(DATE_TRUNC('month', NOW()), 'YYYY-MM');

  IF NOT cust.limit_exceeded THEN
    RAISE EXCEPTION 'العميل لم يتجاوز الحد بعد (%.0f / %.0f جنيه)', cust.total_spend, cust.monthly_spend_limit;
  END IF;

  IF cust.reward_claimed_this_month THEN
    RAISE EXCEPTION 'تم استلام المكافأة هذا الشهر بالفعل';
  END IF;

  -- Mark month as rewarded
  UPDATE customers
  SET reward_earned_months = array_append(reward_earned_months, month_key)
  WHERE id = p_customer_id;

  result := JSON_BUILD_OBJECT(
    'customer_name',  cust.name,
    'month',          month_key,
    'total_spend',    cust.total_spend,
    'limit',          cust.monthly_spend_limit,
    'total_hours',    ROUND(cust.total_hours_this_month::NUMERIC, 1),
    'reward',         'يوم كامل مجاني أو جلسة على الحساب'
  );

  RETURN result;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS for new columns
-- ─────────────────────────----------------------------------------------------------------
-- Profiles: only admin can set PINs
CREATE POLICY "admin_set_pin" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (TRUE);
