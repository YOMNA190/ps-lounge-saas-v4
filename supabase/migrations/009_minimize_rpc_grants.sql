-- ============================================================
-- Migration 009: Minimize SECURITY DEFINER grants
-- ============================================================
-- Revoke the broad authenticated grant first, then allow only RPC endpoints
-- that the signed-in client invokes. Trigger/internal helpers remain callable
-- only through their owning database functions.
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
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', function_signature);
  END LOOP;
END;
$$;

ALTER FUNCTION after_sale_item_insert() SET search_path = public, pg_temp;
ALTER FUNCTION trigger_check_waitlist() SET search_path = public, pg_temp;

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
