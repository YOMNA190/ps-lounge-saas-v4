import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/006_complete_v4.sql'),
  'utf8',
)

describe('migration 006 contract', () => {
  it('uses portable trigger replacement and provides the required timestamp columns', () => {
    expect(migration).not.toContain('CREATE TRIGGER IF NOT EXISTS')
    expect(migration).toContain('ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at')
    expect(migration).toContain('ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at')
    expect(migration).toContain('ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at')
    expect(migration).toContain('DROP TRIGGER IF EXISTS trg_products_updated_at ON products;')
  })

  it('does not decrement inventory twice when adding an order to a session', () => {
    const orderFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION add_order_to_session'),
      migration.indexOf('CREATE OR REPLACE FUNCTION get_session_bill'),
    )

    expect(orderFunction).toContain('trg_after_sale_item already updates the sale total and reduces stock once.')
    expect(orderFunction).not.toMatch(/UPDATE\s+products\s+SET\s+stock_qty\s*=\s*stock_qty\s*-\s*p_qty/i)
  })

  it('handles sessions without related sales and keeps reporting views RLS-aware', () => {
    const billFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION get_session_bill'),
      migration.indexOf('CREATE OR REPLACE FUNCTION stop_session_with_bill'),
    )

    expect(billFunction).toContain("items := '[]'::jsonb;")
    expect(billFunction).toContain('orders_total := 0;')
    expect(migration).toContain('ALTER VIEW customer_monthly_spending SET (security_invoker = true);')
    expect(migration).toContain('ALTER VIEW card_sales_report SET (security_invoker = true);')
  })

  it('contains a follow-up migration that protects curated catalog tables with RLS', () => {
    const catalogRlsMigration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/007_harden_catalog_rls.sql'),
      'utf8',
    )

    expect(catalogRlsMigration).toContain('ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;')
    expect(catalogRlsMigration).toContain('ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;')
    expect(catalogRlsMigration).toContain('FOR SELECT TO authenticated')
    expect(catalogRlsMigration).toContain('subscription_plans_admin_write')
  })

  it('contains a follow-up migration that blocks anonymous SECURITY DEFINER RPC access', () => {
    const rpcHardeningMigration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/008_harden_rpc_execution.sql'),
      'utf8',
    )

    expect(rpcHardeningMigration).toContain("REVOKE ALL ON FUNCTION %s FROM anon")
    expect(rpcHardeningMigration).toContain('SET search_path = public, pg_temp')
    expect(rpcHardeningMigration).toContain('DROP POLICY IF EXISTS "profiles_update" ON profiles;')
    expect(rpcHardeningMigration).toContain('p_user_id IS DISTINCT FROM auth.uid()')
    expect(rpcHardeningMigration).toContain('DROP POLICY IF EXISTS "anon_read_active_sessions" ON sessions;')
  })

  it('contains a least-privilege follow-up for authenticated RPC execution', () => {
    const leastPrivilegeMigration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/009_minimize_rpc_grants.sql'),
      'utf8',
    )

    expect(leastPrivilegeMigration).toContain('REVOKE ALL ON FUNCTION %s FROM authenticated')
    expect(leastPrivilegeMigration).toContain('ALTER FUNCTION after_sale_item_insert() SET search_path = public, pg_temp;')
    expect(leastPrivilegeMigration).toContain('ALTER FUNCTION trigger_check_waitlist() SET search_path = public, pg_temp;')
  })
})
