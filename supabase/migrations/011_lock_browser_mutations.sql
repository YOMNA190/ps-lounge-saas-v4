-- ============================================================
-- Migration 011: Browser mutation lock-down after Command API cutover
-- ============================================================
-- Apply only after command-api is deployed and the client uses it for
-- onboarding, customers, POS, session control, shifts, and expenses.

-- Branch identity and devices
DROP POLICY IF EXISTS "branches_select" ON branches;
DROP POLICY IF EXISTS "branches_update" ON branches;
CREATE POLICY branches_member_read ON branches FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), id, NULL));

DROP POLICY IF EXISTS "devices_all" ON devices;
CREATE POLICY devices_member_read ON devices FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));

-- Core session and financial read models
DROP POLICY IF EXISTS "sessions_select" ON sessions;
DROP POLICY IF EXISTS "sessions_insert" ON sessions;
DROP POLICY IF EXISTS "sessions_update" ON sessions;
DROP POLICY IF EXISTS "sessions_update_notes" ON sessions;
CREATE POLICY sessions_member_read ON sessions FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));

DROP POLICY IF EXISTS "customers_all" ON customers;
CREATE POLICY customers_member_read ON customers FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));

DROP POLICY IF EXISTS "expenses_all" ON expenses;
CREATE POLICY expenses_manager_read ON expenses FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, ARRAY['owner','manager']));

DROP POLICY IF EXISTS "branch_inventory_categories" ON inventory_categories;
CREATE POLICY inventory_categories_member_read ON inventory_categories FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));

DROP POLICY IF EXISTS "branch_products" ON products;
CREATE POLICY products_member_read ON products FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));

DROP POLICY IF EXISTS "branch_sales" ON sales;
CREATE POLICY sales_member_read ON sales FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, ARRAY['owner','manager','cashier']));

DROP POLICY IF EXISTS "branch_sale_items" ON sale_items;
CREATE POLICY sale_items_member_read ON sale_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND has_branch_membership(auth.uid(), s.branch_id, ARRAY['owner','manager','cashier'])
  ));

DROP POLICY IF EXISTS "branch_shifts" ON shifts;
CREATE POLICY shifts_member_read ON shifts FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));

DROP POLICY IF EXISTS "branch_debts" ON debts;
CREATE POLICY debts_finance_read ON debts FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, ARRAY['owner','manager','cashier']));

-- Defence in depth: client JWT roles cannot bypass RLS by direct DML.
REVOKE INSERT, UPDATE, DELETE ON TABLE branches, devices, sessions, customers,
  expenses, inventory_categories, products, sales, sale_items, shifts, debts
FROM authenticated, anon;

-- Legacy direct mutation entry points are retired. The Edge function uses
-- command_* functions under service_role instead.
REVOKE ALL ON FUNCTION setup_new_branch(UUID, TEXT, TEXT, TEXT) FROM authenticated, anon;
REVOKE ALL ON FUNCTION start_session(INTEGER, UUID, TEXT, NUMERIC, TEXT) FROM authenticated, anon;
REVOKE ALL ON FUNCTION stop_session(UUID) FROM authenticated, anon;
REVOKE ALL ON FUNCTION stop_session_with_bill(UUID, NUMERIC, TEXT, TEXT) FROM authenticated, anon;
REVOKE ALL ON FUNCTION add_order_to_session(UUID, INTEGER, INTEGER, TEXT) FROM authenticated, anon;
REVOKE ALL ON FUNCTION end_shift(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM authenticated, anon;
REVOKE ALL ON FUNCTION update_expense(INTEGER, NUMERIC, TEXT) FROM authenticated, anon;

COMMENT ON TABLE command_idempotency IS 'Command responses are deduplicated per authenticated actor and request UUID.';
COMMENT ON TABLE device_commands IS 'Cloud-first command contract. A gateway dispatcher has not been deployed in this project.';
