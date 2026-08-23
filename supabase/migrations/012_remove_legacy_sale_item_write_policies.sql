-- ============================================================
-- Migration 012: Remove legacy sale_items browser write policies
-- ============================================================
-- Migration 006 split the old FOR ALL policy into separate DML policies.
-- 011 revoked table DML privileges, but policies must also be removed so a
-- future grant cannot silently reactivate a browser-side write path.

DROP POLICY IF EXISTS "branch_sale_items_insert" ON sale_items;
DROP POLICY IF EXISTS "branch_sale_items_update" ON sale_items;
DROP POLICY IF EXISTS "branch_sale_items_delete" ON sale_items;
DROP POLICY IF EXISTS "branch_sale_items_select" ON sale_items;

-- The membership-scoped read policy is defined in migration 011. Recreate
-- defensively for databases whose policy was removed during a manual repair.
DROP POLICY IF EXISTS sale_items_member_read ON sale_items;
CREATE POLICY sale_items_member_read ON sale_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_items.sale_id
      AND has_branch_membership(auth.uid(), s.branch_id, ARRAY['owner','manager','cashier'])
  ));
