-- ============================================================
-- Migration 010: Enterprise command foundation (Cloud-first)
-- ============================================================
-- This migration deliberately separates read models from state-changing
-- commands. Browser clients retain scoped SELECT access only. Mutations in
-- core operational tables move to command_* functions invoked by the Edge API.

-- ─────────────────────────────────────────────────────────────
-- 1. Multi-tenant organization and explicit branch membership
-- ─────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE branches ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE TABLE branch_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'operator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, user_id)
);

CREATE INDEX idx_branches_organization ON branches(organization_id);
CREATE INDEX idx_branch_memberships_user ON branch_memberships(user_id, status);
CREATE INDEX idx_branch_memberships_branch ON branch_memberships(branch_id, role, status);

-- Backfill one organization per existing branch. This is intentionally
-- non-destructive and retains profiles.branch_id as a transition-only default.
DO $$
DECLARE
  branch_row RECORD;
  org_id UUID;
BEGIN
  FOR branch_row IN SELECT id, name, owner_id FROM branches WHERE organization_id IS NULL LOOP
    INSERT INTO organizations(name) VALUES (branch_row.name) RETURNING id INTO org_id;
    UPDATE branches SET organization_id = org_id WHERE id = branch_row.id;

    INSERT INTO branch_memberships(organization_id, branch_id, user_id, role)
    SELECT org_id, branch_row.id, p.id,
           CASE WHEN p.role = 'admin' THEN 'owner' ELSE 'operator' END
    FROM profiles p
    WHERE p.branch_id = branch_row.id
    ON CONFLICT (branch_id, user_id) DO NOTHING;

    IF branch_row.owner_id IS NOT NULL THEN
      INSERT INTO branch_memberships(organization_id, branch_id, user_id, role)
      VALUES (org_id, branch_row.id, branch_row.owner_id, 'owner')
      ON CONFLICT (branch_id, user_id) DO UPDATE SET role = 'owner', status = 'active';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION has_branch_membership(p_user_id UUID, p_branch_id UUID, p_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM branch_memberships m
    WHERE m.user_id = p_user_id
      AND m.branch_id = p_branch_id
      AND m.status = 'active'
      AND (p_roles IS NULL OR m.role = ANY(p_roles))
  );
$$;

CREATE OR REPLACE FUNCTION assert_branch_permission(p_actor_id UUID, p_branch_id UUID, p_roles TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT has_branch_membership(p_actor_id, p_branch_id, p_roles) THEN
    RAISE EXCEPTION 'FORBIDDEN_BRANCH_COMMAND';
  END IF;
END;
$$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_member_read ON organizations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM branch_memberships m
    WHERE m.organization_id = organizations.id AND m.user_id = auth.uid() AND m.status = 'active'
  ));
CREATE POLICY memberships_self_read ON branch_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. Immutable financial and command/event models
-- ─────────────────────────────────────────────────────────────
CREATE TABLE command_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  command_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (actor_id, request_id)
);

CREATE TABLE ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  command_id UUID UNIQUE REFERENCES command_idempotency(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  account_code TEXT NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ledger_entry_one_side CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  session_id UUID REFERENCES sessions(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES sales(id) ON DELETE RESTRICT,
  debt_id UUID REFERENCES debts(id) ON DELETE RESTRICT,
  command_id UUID NOT NULL UNIQUE REFERENCES command_idempotency(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'vodafone_cash', 'instapay', 'debt', 'subscription')),
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'voided', 'refunded')),
  provider_reference TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outbox_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT
);

CREATE TABLE device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('power_on', 'power_off', 'relay_on', 'relay_off', 'health_probe')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'acknowledged', 'failed', 'expired')),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  failure_reason TEXT,
  UNIQUE (branch_id, request_id)
);

CREATE TABLE pricing_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rate_snapshot NUMERIC(10,2);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pricing_version_id UUID REFERENCES pricing_versions(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'open'
  CHECK (state IN ('open', 'closing', 'closed', 'voided'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

UPDATE sessions s
SET rate_snapshot = CASE WHEN s.mode = 'single' THEN d.price_single ELSE d.price_multi END,
    state = CASE WHEN s.ended_at IS NULL THEN 'open' ELSE 'closed' END
FROM devices d
WHERE d.id = s.device_id AND s.rate_snapshot IS NULL;

ALTER TABLE command_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY command_read_own ON command_idempotency FOR SELECT TO authenticated USING (actor_id = auth.uid());
CREATE POLICY ledger_read_manager ON ledger_transactions FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, ARRAY['owner', 'manager', 'cashier']));
CREATE POLICY ledger_entries_read_manager ON ledger_entries FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, ARRAY['owner', 'manager', 'cashier']));
CREATE POLICY payments_read_manager ON payment_transactions FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, ARRAY['owner', 'manager', 'cashier']));
CREATE POLICY device_commands_read_member ON device_commands FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));
CREATE POLICY pricing_versions_read_member ON pricing_versions FOR SELECT TO authenticated
  USING (has_branch_membership(auth.uid(), branch_id, NULL));

CREATE INDEX idx_commands_actor_request ON command_idempotency(actor_id, request_id);
CREATE INDEX idx_ledger_transactions_branch_time ON ledger_transactions(branch_id, occurred_at DESC);
CREATE INDEX idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX idx_payments_branch_time ON payment_transactions(branch_id, captured_at DESC);
CREATE INDEX idx_outbox_unpublished ON outbox_events(published_at, id) WHERE published_at IS NULL;
CREATE INDEX idx_device_commands_dispatch ON device_commands(branch_id, status, accepted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_shift_per_staff_branch
  ON shifts(branch_id, staff_id) WHERE ended_at IS NULL;

-- The database has no legitimate UPDATE/DELETE path for journal rows.
CREATE OR REPLACE FUNCTION deny_immutable_finance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_RECORD';
END;
$$;

DROP TRIGGER IF EXISTS deny_ledger_transaction_mutation ON ledger_transactions;
DROP TRIGGER IF EXISTS deny_ledger_entry_mutation ON ledger_entries;
DROP TRIGGER IF EXISTS deny_payment_mutation ON payment_transactions;
CREATE TRIGGER deny_ledger_transaction_mutation BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION deny_immutable_finance_mutation();
CREATE TRIGGER deny_ledger_entry_mutation BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION deny_immutable_finance_mutation();
CREATE TRIGGER deny_payment_mutation BEFORE UPDATE OR DELETE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION deny_immutable_finance_mutation();

CREATE OR REPLACE FUNCTION append_ledger_pair(
  p_transaction_id UUID,
  p_branch_id UUID,
  p_debit_account TEXT,
  p_credit_account TEXT,
  p_amount NUMERIC,
  p_source_type TEXT,
  p_source_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_LEDGER_AMOUNT';
  END IF;
  INSERT INTO ledger_entries(transaction_id, branch_id, account_code, debit, credit, source_type, source_id)
  VALUES
    (p_transaction_id, p_branch_id, p_debit_account, p_amount, 0, p_source_type, p_source_id),
    (p_transaction_id, p_branch_id, p_credit_account, 0, p_amount, p_source_type, p_source_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Command functions: server-only state transitions
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION command_provision_branch(
  p_actor_id UUID,
  p_request_id UUID,
  p_branch_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd command_idempotency;
  existing command_idempotency;
  org organizations;
  branch_rec branches;
  device_name TEXT;
  category_name TEXT;
  category_icon TEXT;
  result_payload JSONB;
BEGIN
  IF p_actor_id IS NULL OR length(trim(COALESCE(p_branch_name, ''))) < 2 THEN
    RAISE EXCEPTION 'INVALID_BRANCH_PROVISIONING_INPUT';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id AND branch_id IS NOT NULL) THEN
    RAISE EXCEPTION 'BRANCH_ALREADY_EXISTS';
  END IF;
  INSERT INTO command_idempotency(actor_id, request_id, command_type)
  VALUES (p_actor_id, p_request_id, 'provision_branch')
  ON CONFLICT (actor_id, request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id = p_actor_id AND request_id = p_request_id FOR UPDATE;
    IF existing.command_type <> 'provision_branch' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status = 'completed' THEN RETURN existing.response; END IF;
    RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;

  INSERT INTO organizations(name) VALUES (trim(p_branch_name)) RETURNING * INTO org;
  INSERT INTO branches(name, owner_id, address, phone, plan, plan_expires_at, onboarding_done, organization_id)
  VALUES (trim(p_branch_name), p_actor_id, NULLIF(trim(p_address), ''), NULLIF(trim(p_phone), ''), 'trial', NOW() + INTERVAL '14 days', TRUE, org.id)
  RETURNING * INTO branch_rec;
  INSERT INTO branch_memberships(organization_id, branch_id, user_id, role)
  VALUES (org.id, branch_rec.id, p_actor_id, 'owner');
  UPDATE profiles SET branch_id = branch_rec.id, role = 'admin' WHERE id = p_actor_id;

  FOREACH device_name IN ARRAY ARRAY['PS5 #1', 'PS5 #2', 'PS5 #3', 'PS5 #4', 'PS5 #5', 'PS4 #6', 'PS4 #7', 'PS4 #8', 'PS4 #9', 'PS4 #10'] LOOP
    INSERT INTO devices(name, type, price_single, price_multi, branch_id)
    VALUES (
      device_name,
      CASE WHEN device_name LIKE 'PS5%' THEN 'PS5' ELSE 'PS4' END,
      CASE WHEN device_name LIKE 'PS5%' THEN 25 ELSE 15 END,
      CASE WHEN device_name LIKE 'PS5%' THEN 20 ELSE 12 END,
      branch_rec.id
    );
  END LOOP;
  INSERT INTO expenses(branch_id, name, amount, sort_order) VALUES
    (branch_rec.id, 'إيجار المحل', 0, 1), (branch_rec.id, 'بضاعة / مستلزمات', 0, 2),
    (branch_rec.id, 'مرتبات', 0, 3), (branch_rec.id, 'كهرباء', 0, 4),
    (branch_rec.id, 'إنترنت', 0, 5), (branch_rec.id, 'جمعية', 0, 6), (branch_rec.id, 'صيانة', 0, 7);
  FOR category_name, category_icon IN SELECT * FROM unnest(ARRAY['مشروبات', 'سناكس', 'أخرى'], ARRAY['🥤', '🍿', '📦']) LOOP
    INSERT INTO inventory_categories(name, icon, branch_id) VALUES(category_name, category_icon, branch_rec.id);
  END LOOP;

  INSERT INTO outbox_events(branch_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES(branch_rec.id, 'branch', branch_rec.id, 'branch.provisioned', jsonb_build_object('organization_id', org.id, 'owner_id', p_actor_id));
  result_payload := jsonb_build_object('organization', to_jsonb(org), 'branch', to_jsonb(branch_rec));
  UPDATE command_idempotency SET branch_id = branch_rec.id, status = 'completed', response = result_payload, completed_at = NOW() WHERE id = cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_create_customer(
  p_actor_id UUID, p_branch_id UUID, p_request_id UUID, p_name TEXT, p_phone TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE cmd command_idempotency; existing command_idempotency; customer_rec customers; result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner','manager','cashier','operator']);
  IF length(trim(COALESCE(p_name,''))) < 2 THEN RAISE EXCEPTION 'INVALID_CUSTOMER_NAME'; END IF;
  INSERT INTO command_idempotency(actor_id,branch_id,request_id,command_type)
  VALUES(p_actor_id,p_branch_id,p_request_id,'create_customer') ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
    IF existing.command_type <> 'create_customer' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status='completed' THEN RETURN existing.response; END IF;
    RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;
  INSERT INTO customers(name,phone,branch_id) VALUES(trim(p_name),NULLIF(trim(p_phone),''),p_branch_id) RETURNING * INTO customer_rec;
  result_payload:=jsonb_build_object('customer',to_jsonb(customer_rec));
  UPDATE command_idempotency SET status='completed',response=result_payload,completed_at=NOW() WHERE id=cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_start_session(
  p_actor_id UUID,
  p_branch_id UUID,
  p_request_id UUID,
  p_device_id INTEGER,
  p_customer_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT 'single',
  p_game_played TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd command_idempotency;
  existing command_idempotency;
  dev devices;
  sess sessions;
  snapshot_rate NUMERIC;
  result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager', 'cashier', 'operator']);
  IF p_mode NOT IN ('single', 'multi') THEN RAISE EXCEPTION 'INVALID_SESSION_MODE'; END IF;

  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type)
  VALUES (p_actor_id, p_branch_id, p_request_id, 'start_session')
  ON CONFLICT (actor_id, request_id) DO NOTHING
  RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id = p_actor_id AND request_id = p_request_id FOR UPDATE;
    IF existing.command_type <> 'start_session' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status = 'completed' THEN RETURN existing.response; END IF;
    RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;

  SELECT * INTO dev FROM devices WHERE id = p_device_id AND branch_id = p_branch_id AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEVICE_UNAVAILABLE'; END IF;
  IF p_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND branch_id = p_branch_id) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_IN_BRANCH';
  END IF;
  snapshot_rate := CASE WHEN p_mode = 'single' THEN dev.price_single ELSE dev.price_multi END;

  INSERT INTO sessions(device_id, customer_id, mode, game_played, started_at, staff_id, branch_id, rate_snapshot, state)
  VALUES (p_device_id, p_customer_id, p_mode, p_game_played, NOW(), p_actor_id, p_branch_id, snapshot_rate, 'open')
  RETURNING * INTO sess;

  INSERT INTO outbox_events(branch_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (p_branch_id, 'session', sess.id, 'session.started', jsonb_build_object('device_id', p_device_id, 'rate_snapshot', snapshot_rate));

  result_payload := jsonb_build_object('session', to_jsonb(sess), 'rate_snapshot', snapshot_rate);
  UPDATE command_idempotency SET status = 'completed', response = result_payload, completed_at = NOW() WHERE id = cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_add_order_line(
  p_actor_id UUID,
  p_branch_id UUID,
  p_request_id UUID,
  p_session_id UUID,
  p_product_id INTEGER,
  p_qty INTEGER,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd command_idempotency;
  existing command_idempotency;
  sess sessions;
  prod products;
  sale_rec sales;
  item sale_items;
  result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager', 'cashier', 'operator']);
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type)
  VALUES (p_actor_id, p_branch_id, p_request_id, 'add_order_line')
  ON CONFLICT (actor_id, request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id = p_actor_id AND request_id = p_request_id FOR UPDATE;
    IF existing.command_type <> 'add_order_line' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status = 'completed' THEN RETURN existing.response; END IF;
    RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;

  SELECT * INTO sess FROM sessions WHERE id = p_session_id AND branch_id = p_branch_id AND state = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_OPEN'; END IF;
  SELECT * INTO prod FROM products WHERE id = p_product_id AND branch_id = p_branch_id AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND OR prod.stock_qty < p_qty THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;

  SELECT * INTO sale_rec FROM sales WHERE session_id = p_session_id AND branch_id = p_branch_id ORDER BY created_at ASC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO sales(session_id, customer_id, staff_id, branch_id, total, notes)
    VALUES(p_session_id, sess.customer_id, p_actor_id, p_branch_id, 0, p_notes)
    RETURNING * INTO sale_rec;
  END IF;
  INSERT INTO sale_items(sale_id, product_id, qty, unit_price, unit_cost)
  VALUES(sale_rec.id, p_product_id, p_qty, prod.sell_price, prod.cost_price)
  RETURNING * INTO item;

  INSERT INTO outbox_events(branch_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (p_branch_id, 'sale', sale_rec.id, 'sale.line_added', jsonb_build_object('product_id', p_product_id, 'qty', p_qty, 'subtotal', item.subtotal));
  result_payload := jsonb_build_object('sale_id', sale_rec.id, 'item_id', item.id, 'subtotal', item.subtotal);
  UPDATE command_idempotency SET status = 'completed', response = result_payload, completed_at = NOW() WHERE id = cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_record_pos_sale(
  p_actor_id UUID,
  p_branch_id UUID,
  p_request_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd command_idempotency;
  existing command_idempotency;
  product_input RECORD;
  prod products;
  sale_rec sales;
  item sale_items;
  ledger_tx ledger_transactions;
  payment_id UUID;
  total_amount NUMERIC := 0;
  result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager', 'cashier', 'operator']);
  IF p_payment_method NOT IN ('cash', 'vodafone_cash', 'instapay', 'debt', 'subscription') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'EMPTY_POS_SALE'; END IF;
  IF p_payment_method = 'debt' AND p_customer_id IS NULL THEN RAISE EXCEPTION 'DEBT_REQUIRES_CUSTOMER'; END IF;
  IF p_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers WHERE id=p_customer_id AND branch_id=p_branch_id) THEN RAISE EXCEPTION 'CUSTOMER_NOT_IN_BRANCH'; END IF;

  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type)
  VALUES(p_actor_id,p_branch_id,p_request_id,'record_pos_sale') ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
    IF existing.command_type <> 'record_pos_sale' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status='completed' THEN RETURN existing.response; END IF;
    RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;

  -- Lock products in a stable order so two carts cannot oversell stock or deadlock.
  FOR product_input IN
    SELECT (value->>'product_id')::INTEGER AS product_id, (value->>'qty')::INTEGER AS qty
    FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'product_id')::INTEGER
  LOOP
    IF product_input.qty IS NULL OR product_input.qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    SELECT * INTO prod FROM products WHERE id=product_input.product_id AND branch_id=p_branch_id AND is_active=TRUE FOR UPDATE;
    IF NOT FOUND OR prod.stock_qty < product_input.qty THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
  END LOOP;

  INSERT INTO sales(customer_id, staff_id, branch_id, total, notes, is_paid)
  VALUES(p_customer_id, p_actor_id, p_branch_id, 0, p_notes, p_payment_method <> 'debt')
  RETURNING * INTO sale_rec;
  FOR product_input IN
    SELECT (value->>'product_id')::INTEGER AS product_id, (value->>'qty')::INTEGER AS qty
    FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'product_id')::INTEGER
  LOOP
    SELECT * INTO prod FROM products WHERE id=product_input.product_id AND branch_id=p_branch_id FOR UPDATE;
    INSERT INTO sale_items(sale_id, product_id, qty, unit_price, unit_cost)
    VALUES(sale_rec.id, prod.id, product_input.qty, prod.sell_price, prod.cost_price)
    RETURNING * INTO item;
    total_amount := total_amount + item.subtotal;
  END LOOP;
  SELECT * INTO sale_rec FROM sales WHERE id=sale_rec.id FOR UPDATE;

  INSERT INTO ledger_transactions(branch_id, command_id, source_type, source_id, created_by)
  VALUES(p_branch_id, cmd.id, 'pos_sale', sale_rec.id, p_actor_id) RETURNING * INTO ledger_tx;
  PERFORM append_ledger_pair(
    ledger_tx.id, p_branch_id,
    CASE WHEN p_payment_method = 'debt' THEN 'accounts_receivable' ELSE 'cash_or_payment_clearing' END,
    'pos_revenue', sale_rec.total, 'pos_sale', sale_rec.id
  );
  INSERT INTO payment_transactions(branch_id, sale_id, command_id, amount, payment_method, recorded_by)
  VALUES(p_branch_id,sale_rec.id,cmd.id,sale_rec.total,p_payment_method,p_actor_id)
  RETURNING id INTO payment_id;
  INSERT INTO outbox_events(branch_id,aggregate_type,aggregate_id,event_type,payload)
  VALUES(p_branch_id,'sale',sale_rec.id,'sale.completed',jsonb_build_object('payment_id',payment_id,'total',sale_rec.total));
  result_payload:=jsonb_build_object('sale',to_jsonb(sale_rec),'payment_id',payment_id);
  UPDATE command_idempotency SET status='completed',response=result_payload,completed_at=NOW() WHERE id=cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_close_session(
  p_actor_id UUID,
  p_branch_id UUID,
  p_request_id UUID,
  p_session_id UUID,
  p_discount_amount NUMERIC DEFAULT 0,
  p_discount_reason TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd command_idempotency;
  existing command_idempotency;
  sess sessions;
  duration_hours NUMERIC;
  orders_total NUMERIC;
  sale_id UUID;
  session_cost NUMERIC;
  grand_total NUMERIC;
  debt_rec debts;
  ledger_tx ledger_transactions;
  payment_id UUID;
  result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager', 'cashier', 'operator']);
  IF p_payment_method NOT IN ('cash', 'vodafone_cash', 'instapay', 'debt', 'subscription') THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_discount_amount IS NULL OR p_discount_amount < 0 THEN RAISE EXCEPTION 'INVALID_DISCOUNT'; END IF;

  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type)
  VALUES (p_actor_id, p_branch_id, p_request_id, 'close_session')
  ON CONFLICT (actor_id, request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id = p_actor_id AND request_id = p_request_id FOR UPDATE;
    IF existing.command_type <> 'close_session' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status = 'completed' THEN RETURN existing.response; END IF;
    RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;

  SELECT * INTO sess FROM sessions WHERE id = p_session_id AND branch_id = p_branch_id AND state = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_OPEN'; END IF;
  IF p_payment_method = 'debt' AND sess.customer_id IS NULL THEN RAISE EXCEPTION 'DEBT_REQUIRES_CUSTOMER'; END IF;
  IF sess.rate_snapshot IS NULL THEN RAISE EXCEPTION 'MISSING_RATE_SNAPSHOT'; END IF;

  duration_hours := GREATEST(EXTRACT(EPOCH FROM (NOW() - sess.started_at)) / 3600.0, 1.0 / 60.0);
  session_cost := ROUND(duration_hours * sess.rate_snapshot, 2);
  SELECT COALESCE(SUM(total), 0), MIN(id) INTO orders_total, sale_id
  FROM sales WHERE session_id = p_session_id AND branch_id = p_branch_id;
  grand_total := session_cost + orders_total - p_discount_amount;
  IF grand_total < 0 THEN RAISE EXCEPTION 'DISCOUNT_TOO_HIGH'; END IF;

  UPDATE sessions
  SET ended_at = NOW(), cost = session_cost, discount_amount = p_discount_amount,
      discount_reason = p_discount_reason, payment_method = p_payment_method,
      is_paid = p_payment_method <> 'debt', state = 'closed', version = version + 1
  WHERE id = sess.id
  RETURNING * INTO sess;
  UPDATE sales SET is_paid = p_payment_method <> 'debt' WHERE session_id = p_session_id AND branch_id = p_branch_id;

  IF p_payment_method = 'debt' THEN
    INSERT INTO debts(customer_id, session_id, sale_id, amount, reason, status, created_by, branch_id)
    VALUES(sess.customer_id, sess.id, sale_id, grand_total, 'Session settlement', 'pending', p_actor_id, p_branch_id)
    RETURNING * INTO debt_rec;
  END IF;

  IF grand_total > 0 THEN
    INSERT INTO ledger_transactions(branch_id, command_id, source_type, source_id, created_by)
    VALUES(p_branch_id, cmd.id, 'session_settlement', sess.id, p_actor_id)
    RETURNING * INTO ledger_tx;
    PERFORM append_ledger_pair(
      ledger_tx.id, p_branch_id,
      CASE WHEN p_payment_method = 'debt' THEN 'accounts_receivable' ELSE 'cash_or_payment_clearing' END,
      'gaming_and_pos_revenue', grand_total, 'session_settlement', sess.id
    );
    INSERT INTO payment_transactions(branch_id, session_id, sale_id, debt_id, command_id, amount, payment_method, recorded_by)
    VALUES(p_branch_id, sess.id, sale_id, debt_rec.id, cmd.id, grand_total, p_payment_method, p_actor_id)
    RETURNING id INTO payment_id;
  END IF;

  IF sess.customer_id IS NOT NULL AND grand_total > 0 AND p_payment_method <> 'debt' THEN
    UPDATE customers
    SET points = points + FLOOR(grand_total), total_spent = total_spent + grand_total,
        total_hours = total_hours + duration_hours, visit_count = visit_count + 1
    WHERE id = sess.customer_id AND branch_id = p_branch_id;
  END IF;

  INSERT INTO outbox_events(branch_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES(p_branch_id, 'session', sess.id, 'session.closed', jsonb_build_object('grand_total', grand_total, 'payment_method', p_payment_method));
  result_payload := jsonb_build_object('session', to_jsonb(sess), 'session_cost', session_cost, 'orders_total', orders_total, 'grand_total', grand_total, 'payment_id', payment_id);
  UPDATE command_idempotency SET status = 'completed', response = result_payload, completed_at = NOW() WHERE id = cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_open_shift(
  p_actor_id UUID, p_branch_id UUID, p_request_id UUID, p_opening_cash NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE cmd command_idempotency; existing command_idempotency; shift_rec shifts; result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager', 'cashier', 'operator']);
  IF p_opening_cash < 0 THEN RAISE EXCEPTION 'INVALID_OPENING_CASH'; END IF;
  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type) VALUES(p_actor_id, p_branch_id, p_request_id, 'open_shift') ON CONFLICT (actor_id, request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
    IF existing.command_type <> 'open_shift' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status='completed' THEN RETURN existing.response; END IF; RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;
  INSERT INTO shifts(staff_id, branch_id, opening_cash) VALUES(p_actor_id, p_branch_id, p_opening_cash) RETURNING * INTO shift_rec;
  result_payload := jsonb_build_object('shift', to_jsonb(shift_rec));
  UPDATE command_idempotency SET status='completed',response=result_payload,completed_at=NOW() WHERE id=cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_close_shift(
  p_actor_id UUID, p_branch_id UUID, p_request_id UUID, p_shift_id UUID,
  p_pin TEXT, p_closing_cash NUMERIC, p_cash_taken NUMERIC DEFAULT 0, p_cash_left NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  cmd command_idempotency; existing command_idempotency; shift_rec shifts; staff_rec profiles;
  sessions_revenue NUMERIC; sales_revenue NUMERIC; cash_revenue NUMERIC; result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager', 'cashier', 'operator']);
  IF p_closing_cash IS NULL OR p_cash_taken < 0 OR p_cash_left < 0 THEN RAISE EXCEPTION 'INVALID_SHIFT_CASH'; END IF;
  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type)
  VALUES(p_actor_id, p_branch_id, p_request_id, 'close_shift') ON CONFLICT(actor_id, request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
    IF existing.command_type <> 'close_shift' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status='completed' THEN RETURN existing.response; END IF;
    RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;
  SELECT * INTO shift_rec FROM shifts WHERE id=p_shift_id AND branch_id=p_branch_id AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHIFT_NOT_OPEN'; END IF;
  IF shift_rec.staff_id <> p_actor_id AND NOT has_branch_membership(p_actor_id, p_branch_id, ARRAY['owner','manager']) THEN RAISE EXCEPTION 'SHIFT_CLOSE_FORBIDDEN'; END IF;
  SELECT * INTO staff_rec FROM profiles WHERE id=shift_rec.staff_id;
  IF staff_rec.shift_pin IS NOT NULL AND NOT (crypt(COALESCE(p_pin,''), staff_rec.shift_pin) = staff_rec.shift_pin) THEN RAISE EXCEPTION 'INVALID_SHIFT_PIN'; END IF;
  SELECT COALESCE(SUM(cost),0) INTO sessions_revenue FROM sessions WHERE staff_id=shift_rec.staff_id AND branch_id=p_branch_id AND started_at>=shift_rec.started_at AND state='closed';
  SELECT COALESCE(SUM(total),0) INTO sales_revenue FROM sales WHERE staff_id=shift_rec.staff_id AND branch_id=p_branch_id AND created_at>=shift_rec.started_at;
  SELECT COALESCE(SUM(amount),0) INTO cash_revenue FROM payment_transactions WHERE branch_id=p_branch_id AND recorded_by=shift_rec.staff_id AND payment_method='cash' AND captured_at>=shift_rec.started_at AND status='captured';
  UPDATE shifts SET ended_at=NOW(), closing_cash=p_closing_cash, cash_taken=p_cash_taken, cash_left=p_cash_left,
    expected_cash=opening_cash+cash_revenue, cash_difference=p_closing_cash-(opening_cash+cash_revenue),
    sessions_revenue=sessions_revenue, sales_revenue=sales_revenue, total_revenue=sessions_revenue+sales_revenue
  WHERE id=shift_rec.id RETURNING * INTO shift_rec;
  INSERT INTO outbox_events(branch_id,aggregate_type,aggregate_id,event_type,payload)
  VALUES(p_branch_id,'shift',shift_rec.id,'shift.closed',jsonb_build_object('cash_difference',shift_rec.cash_difference,'cash_revenue',cash_revenue));
  result_payload:=jsonb_build_object('shift',to_jsonb(shift_rec));
  UPDATE command_idempotency SET status='completed',response=result_payload,completed_at=NOW() WHERE id=cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_update_expense(
  p_actor_id UUID, p_branch_id UUID, p_request_id UUID, p_expense_id INTEGER, p_amount NUMERIC, p_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE cmd command_idempotency; existing command_idempotency; expense_rec expenses; result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager']);
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'INVALID_EXPENSE_AMOUNT'; END IF;
  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type) VALUES(p_actor_id,p_branch_id,p_request_id,'update_expense') ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
    IF existing.command_type <> 'update_expense' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status='completed' THEN RETURN existing.response; END IF; RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;
  UPDATE expenses SET amount=p_amount,name=COALESCE(p_name,name),updated_at=NOW() WHERE id=p_expense_id AND branch_id=p_branch_id RETURNING * INTO expense_rec;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPENSE_NOT_FOUND'; END IF;
  result_payload := jsonb_build_object('expense',to_jsonb(expense_rec));
  UPDATE command_idempotency SET status='completed',response=result_payload,completed_at=NOW() WHERE id=cmd.id;
  RETURN result_payload;
END;
$$;

CREATE OR REPLACE FUNCTION command_queue_device_command(
  p_actor_id UUID, p_branch_id UUID, p_request_id UUID, p_device_id INTEGER, p_type TEXT, p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE cmd command_idempotency; existing command_idempotency; device_cmd device_commands; result_payload JSONB;
BEGIN
  PERFORM assert_branch_permission(p_actor_id, p_branch_id, ARRAY['owner', 'manager', 'operator']);
  IF p_type NOT IN ('power_on','power_off','relay_on','relay_off','health_probe') THEN RAISE EXCEPTION 'INVALID_DEVICE_COMMAND'; END IF;
  IF NOT EXISTS(SELECT 1 FROM devices WHERE id=p_device_id AND branch_id=p_branch_id) THEN RAISE EXCEPTION 'DEVICE_NOT_FOUND'; END IF;
  INSERT INTO command_idempotency(actor_id, branch_id, request_id, command_type) VALUES(p_actor_id,p_branch_id,p_request_id,'queue_device_command') ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING * INTO cmd;
  IF NOT FOUND THEN
    SELECT * INTO existing FROM command_idempotency WHERE actor_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
    IF existing.command_type <> 'queue_device_command' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'; END IF;
    IF existing.status='completed' THEN RETURN existing.response; END IF; RAISE EXCEPTION 'COMMAND_IN_PROGRESS';
  END IF;
  INSERT INTO device_commands(branch_id,device_id,request_id,type,payload,requested_by)
  VALUES(p_branch_id,p_device_id,p_request_id,p_type,COALESCE(p_payload,'{}'::JSONB),p_actor_id) RETURNING * INTO device_cmd;
  INSERT INTO outbox_events(branch_id,aggregate_type,aggregate_id,event_type,payload)
  VALUES(p_branch_id,'device_command',device_cmd.id,'device.command.queued',to_jsonb(device_cmd));
  result_payload := jsonb_build_object('command',to_jsonb(device_cmd),'dispatch','not_configured');
  UPDATE command_idempotency SET status='completed',response=result_payload,completed_at=NOW() WHERE id=cmd.id;
  RETURN result_payload;
END;
$$;

-- Only the trusted Edge API executes command functions. Browser lock-down is
-- intentionally applied in migration 011 after the client has switched routes.
REVOKE ALL ON FUNCTION has_branch_membership(UUID, UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION assert_branch_permission(UUID, UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION append_ledger_pair(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_provision_branch(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_create_customer(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_start_session(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_add_order_line(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_close_session(UUID, UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_open_shift(UUID, UUID, UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_close_shift(UUID, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_update_expense(UUID, UUID, UUID, INTEGER, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_queue_device_command(UUID, UUID, UUID, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_branch_membership(UUID, UUID, TEXT[]) TO authenticated;

GRANT EXECUTE ON FUNCTION command_provision_branch(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_create_customer(UUID, UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_start_session(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_add_order_line(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_close_session(UUID, UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_open_shift(UUID, UUID, UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION command_close_shift(UUID, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION command_update_expense(UUID, UUID, UUID, INTEGER, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION command_queue_device_command(UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO service_role;

-- Keep the old branch pointer only as a transition default; it is not the
-- authorization source for the new command domain.
COMMENT ON COLUMN profiles.branch_id IS 'Transition-only default branch. Authorization is branch_memberships.';
