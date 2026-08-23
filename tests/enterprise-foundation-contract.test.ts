import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/010_enterprise_command_foundation.sql'),
  'utf8',
)

const edgeCommandApi = readFileSync(
  resolve(process.cwd(), 'supabase/functions/command-api/index.ts'),
  'utf8',
)

const lockDownMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/011_lock_browser_mutations.sql'),
  'utf8',
)

const saleItemPolicyRepairMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/012_remove_legacy_sale_item_write_policies.sql'),
  'utf8',
)

const commandPrivilegeLockMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/013_lock_command_function_execute.sql'),
  'utf8',
)

describe('enterprise command foundation contract', () => {
  it('introduces explicit membership and immutable accounting primitives', () => {
    for (const table of ['organizations', 'branch_memberships', 'command_idempotency', 'ledger_transactions', 'ledger_entries', 'payment_transactions', 'outbox_events', 'device_commands']) {
      expect(migration).toContain(`CREATE TABLE ${table}`)
    }
    expect(migration).toContain('UNIQUE (actor_id, request_id)')
    expect(migration).toContain('IMMUTABLE_FINANCIAL_RECORD')
    expect(migration).toContain('CREATE TRIGGER deny_ledger_entry_mutation')
  })

  it('snapshots prices and serializes the core money commands', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS rate_snapshot')
    for (const command of ['command_start_session', 'command_add_order_line', 'command_record_pos_sale', 'command_close_session', 'command_open_shift', 'command_close_shift']) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION ${command}`)
    }
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain("'session.closed'")
    expect(migration).toContain("'sale.completed'")
  })

  it('reserves command execution for trusted server code', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION command_close_session')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION command_close_session')
    expect(migration).toContain('TO service_role')
  })

  it('validates the user before creating a privileged client and exposes only typed commands', () => {
    expect(edgeCommandApi).toContain("auth.getUser()")
    expect(edgeCommandApi.indexOf("auth.getUser()")).toBeLessThan(edgeCommandApi.indexOf("getKey('secret')"))
    expect(edgeCommandApi).toContain('z.discriminatedUnion')
    expect(edgeCommandApi).toContain("action: z.literal('closeSession')")
    expect(edgeCommandApi).toContain("action: z.literal('recordPosSale')")
    expect(edgeCommandApi).toContain("action: z.literal('queueDeviceCommand')")
  })

  it('locks browser writes only after the command boundary exists', () => {
    expect(lockDownMigration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE branches, devices, sessions, customers')
    expect(lockDownMigration).toContain('REVOKE ALL ON FUNCTION start_session')
    expect(lockDownMigration).toContain('CREATE POLICY sessions_member_read')
    expect(lockDownMigration).toContain('has_branch_membership(auth.uid(), branch_id')
  })

  it('removes split legacy sale-item DML policies rather than relying only on revoked grants', () => {
    expect(saleItemPolicyRepairMigration).toContain('DROP POLICY IF EXISTS "branch_sale_items_insert"')
    expect(saleItemPolicyRepairMigration).toContain('DROP POLICY IF EXISTS "branch_sale_items_update"')
    expect(saleItemPolicyRepairMigration).toContain('DROP POLICY IF EXISTS "branch_sale_items_delete"')
  })

  it('revokes PostgreSQL default PUBLIC execution from SECURITY DEFINER commands', () => {
    expect(commandPrivilegeLockMigration).toContain('FROM PUBLIC, anon, authenticated')
    expect(commandPrivilegeLockMigration).toContain('command_record_pos_sale')
    expect(commandPrivilegeLockMigration).toContain('TO service_role')
  })
})
