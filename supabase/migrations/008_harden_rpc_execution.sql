-- ============================================================
-- Migration 008: Harden SECURITY DEFINER RPC execution
-- ============================================================

-- Prevent an authenticated user from changing their own role or branch through
-- direct table updates. Branch linking remains exclusively in setup_new_branch.
DROP POLICY IF EXISTS "profiles_update" ON profiles;

-- Recreate onboarding with caller binding so a user cannot bootstrap a branch
-- under another user's profile.
CREATE OR REPLACE FUNCTION setup_new_branch(
  p_user_id UUID,
  p_branch_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
) RETURNS branches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  branch branches;
  device_names TEXT[] := ARRAY[
    'PS5 #1','PS5 #2','PS5 #3','PS5 #4','PS5 #5',
    'PS4 #6','PS4 #7','PS4 #8','PS4 #9','PS4 #10'
  ];
  d TEXT;
  i INTEGER := 1;
  cats JSONB[] := ARRAY[
    '{"name":"مشروبات","icon":"🥤"}'::JSONB,
    '{"name":"سناكس","icon":"🍿"}'::JSONB,
    '{"name":"أخرى","icon":"📦"}'::JSONB
  ];
  cat JSONB;
  cat_id INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'ONBOARDING_FORBIDDEN';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND branch_id IS NOT NULL) THEN
    RAISE EXCEPTION 'BRANCH_ALREADY_EXISTS';
  END IF;

  INSERT INTO branches(name, owner_id, address, phone, plan, plan_expires_at, onboarding_done)
  VALUES(p_branch_name, p_user_id, p_address, p_phone, 'trial', NOW() + INTERVAL '14 days', TRUE)
  RETURNING * INTO branch;

  UPDATE profiles SET branch_id = branch.id, role = 'admin' WHERE id = p_user_id;

  FOREACH d IN ARRAY device_names LOOP
    INSERT INTO devices(name, type, price_single, price_multi, branch_id)
    VALUES(
      d,
      CASE WHEN i <= 5 THEN 'PS5' ELSE 'PS4' END,
      CASE WHEN i <= 5 THEN 25 ELSE 15 END,
      CASE WHEN i <= 5 THEN 20 ELSE 12 END,
      branch.id
    );
    i := i + 1;
  END LOOP;

  INSERT INTO expenses(branch_id, name, amount, sort_order) VALUES
    (branch.id, 'إيجار المحل', 0, 1),
    (branch.id, 'بضاعة / مستلزمات', 0, 2),
    (branch.id, 'مرتبات', 0, 3),
    (branch.id, 'كهرباء', 0, 4),
    (branch.id, 'إنترنت', 0, 5),
    (branch.id, 'جمعية', 0, 6),
    (branch.id, 'صيانة', 0, 7);

  FOREACH cat IN ARRAY cats LOOP
    INSERT INTO inventory_categories(name, icon, branch_id)
    VALUES(cat->>'name', cat->>'icon', branch.id)
    RETURNING id INTO cat_id;
  END LOOP;

  RETURN branch;
END;
$$;

-- The public display and QR-access policies expose every lounge's operational
-- data without a branch-scoped public token. Disable that path until a
-- dedicated, token-scoped display design is implemented and tested.
DROP POLICY IF EXISTS "anon_read_devices" ON devices;
DROP POLICY IF EXISTS "anon_read_active_sessions" ON sessions;
DROP POLICY IF EXISTS "anon_read_customers_name" ON customers;
DO $$
BEGIN
  IF to_regclass('public.public_session_status') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON TABLE public.public_session_status FROM anon';
  END IF;
END;
$$;

-- Every SECURITY DEFINER function receives an immutable search path and is no
-- longer executable by anonymous clients. Explicit grants follow for the RPCs
-- the signed-in application currently uses.
DO $$
DECLARE
  function_signature REGPROCEDURE;
BEGIN
  FOR function_signature IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', function_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', function_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', function_signature);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_branch_id() TO authenticated;
GRANT EXECUTE ON FUNCTION setup_new_branch(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION start_session(INTEGER, UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION stop_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION stop_session_with_bill(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_order_to_session(UUID, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_bill(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION end_shift(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION pay_debt(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION waive_debt(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_subscription(UUID, INTEGER, INTEGER, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_bracket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_happy_hour(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sell_card(INTEGER, UUID, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION restock_cards(INTEGER, INTEGER, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION update_expense(INTEGER, NUMERIC, TEXT) TO authenticated;
