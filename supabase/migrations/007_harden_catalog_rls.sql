-- ============================================================
-- Migration 007: Harden catalog RLS
-- ============================================================
-- The tables below are curated catalogs. They are readable only by signed-in
-- lounge users; achievement definitions cannot be changed from the client.

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_authenticated_select" ON achievements;
CREATE POLICY "achievements_authenticated_select" ON achievements
  FOR SELECT TO authenticated
  USING (TRUE);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_plans_authenticated_select" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_admin_write" ON subscription_plans;

CREATE POLICY "subscription_plans_authenticated_select" ON subscription_plans
  FOR SELECT TO authenticated
  USING (branch_id IS NULL OR branch_id = get_my_branch_id());

CREATE POLICY "subscription_plans_admin_write" ON subscription_plans
  FOR ALL TO authenticated
  USING (
    branch_id = get_my_branch_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    branch_id = get_my_branch_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
