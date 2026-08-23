-- ============================================================
-- Migration 013: Command function execute privilege lock-down
-- ============================================================
-- PostgreSQL grants EXECUTE to PUBLIC by default for newly created functions.
-- SECURITY DEFINER command_* functions must only be callable by the trusted
-- Edge Function service role; client roles must not call or impersonate actor IDs.

REVOKE ALL ON FUNCTION command_add_order_line(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_close_session(UUID, UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_close_shift(UUID, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_create_customer(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_open_shift(UUID, UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_provision_branch(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_queue_device_command(UUID, UUID, UUID, INTEGER, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_record_pos_sale(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_start_session(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION command_update_expense(UUID, UUID, UUID, INTEGER, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION command_add_order_line(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_close_session(UUID, UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_close_shift(UUID, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION command_create_customer(UUID, UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_open_shift(UUID, UUID, UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION command_provision_branch(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_queue_device_command(UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION command_record_pos_sale(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_start_session(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_update_expense(UUID, UUID, UUID, INTEGER, NUMERIC, TEXT) TO service_role;
