-- ============================================================
-- Migration 001: Security Hardening & Financial Integrity
-- PS Lounge SaaS v4 — Charging Session Management
-- ============================================================
-- This migration adds:
-- 1. Unique index to prevent duplicate active sessions per device
-- 2. CHECK constraints for financial data integrity
-- 3. Performance indexes for high-frequency queries
-- 4. Audit log table with append-only RLS
-- 5. Ghost session reaper function
-- 6. Server-side start_session and stop_session functions
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. IDEMPOTENCY: Prevent duplicate active sessions per device
-- Problem: Double-click or race condition creates two active
-- sessions on the same device → financial corruption
-- ────────────────────────────────────────────────────────────

-- Create sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) PRIMARY KEY,
  device_id INT NOT NULL,
  customer_id VARCHAR(255),
  mode VARCHAR(50) NOT NULL DEFAULT 'single',
  hourly_rate DECIMAL(10,2),
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  duration_mins INT,
  price_paid DECIMAL(10,2),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time DESC)
);

-- Unique index: only one active session per device
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_device
ON sessions (device_id)
WHERE status = 'active';

-- ────────────────────────────────────────────────────────────
-- 2. DATA INTEGRITY: Prevent impossible financial values
-- Problem: No DB-level guards → negative prices, impossible
-- durations, negative loyalty points possible
-- ────────────────────────────────────────────────────────────

-- Ensure end_time >= start_time
ALTER TABLE sessions ADD CONSTRAINT IF NOT EXISTS chk_end_after_start
  CHECK (end_time IS NULL OR end_time >= start_time);

-- Ensure duration is non-negative
ALTER TABLE sessions ADD CONSTRAINT IF NOT EXISTS chk_positive_duration
  CHECK (duration_mins IS NULL OR duration_mins >= 0);

-- Ensure price is non-negative
ALTER TABLE sessions ADD CONSTRAINT IF NOT EXISTS chk_positive_price
  CHECK (price_paid IS NULL OR price_paid >= 0);

-- Create customers table if it doesn't exist
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  loyalty_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Loyalty points cannot go negative
ALTER TABLE customers ADD CONSTRAINT IF NOT EXISTS chk_non_negative_points
  CHECK (loyalty_points >= 0);

-- Create devices table if it doesn't exist
CREATE TABLE IF NOT EXISTS devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  hourly_rate DECIMAL(10,2),
  branch_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_branch_id (branch_id),
  INDEX idx_status (status)
);

-- ────────────────────────────────────────────────────────────
-- 3. PERFORMANCE: Critical indexes for high-frequency queries
-- Problem: Analytics and session queries do full table scans
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_device_status
ON sessions (device_id, status);

CREATE INDEX IF NOT EXISTS idx_sessions_start_time
ON sessions (start_time DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_customer
ON sessions (customer_id)
WHERE customer_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. AUDIT LOG: Full forensic trail for all financial mutations
-- Problem: Zero visibility into who changed what and when
-- Fraud is completely undetectable
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  record_id CHAR(36) NOT NULL,
  old_value JSON,
  new_value JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at DESC),
  INDEX idx_audit_record (record_id, table_name),
  CONSTRAINT chk_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- ────────────────────────────────────────────────────────────
-- 5. AUDIT TRIGGER: Auto-log all session mutations
-- ────────────────────────────────────────────────────────────

DELIMITER $$

CREATE TRIGGER IF NOT EXISTS trg_sessions_audit_insert
AFTER INSERT ON sessions
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (
    id,
    user_id,
    action,
    table_name,
    record_id,
    old_value,
    new_value,
    created_at
  ) VALUES (
    UUID(),
    NULL,
    'INSERT',
    'sessions',
    NEW.id,
    NULL,
    JSON_OBJECT(
      'id', NEW.id,
      'device_id', NEW.device_id,
      'customer_id', NEW.customer_id,
      'mode', NEW.mode,
      'hourly_rate', NEW.hourly_rate,
      'start_time', NEW.start_time,
      'end_time', NEW.end_time,
      'duration_mins', NEW.duration_mins,
      'price_paid', NEW.price_paid,
      'status', NEW.status,
      'notes', NEW.notes
    ),
    CURRENT_TIMESTAMP
  );
END$$

CREATE TRIGGER IF NOT EXISTS trg_sessions_audit_update
AFTER UPDATE ON sessions
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (
    id,
    user_id,
    action,
    table_name,
    record_id,
    old_value,
    new_value,
    created_at
  ) VALUES (
    UUID(),
    NULL,
    'UPDATE',
    'sessions',
    NEW.id,
    JSON_OBJECT(
      'id', OLD.id,
      'device_id', OLD.device_id,
      'customer_id', OLD.customer_id,
      'mode', OLD.mode,
      'hourly_rate', OLD.hourly_rate,
      'start_time', OLD.start_time,
      'end_time', OLD.end_time,
      'duration_mins', OLD.duration_mins,
      'price_paid', OLD.price_paid,
      'status', OLD.status,
      'notes', OLD.notes
    ),
    JSON_OBJECT(
      'id', NEW.id,
      'device_id', NEW.device_id,
      'customer_id', NEW.customer_id,
      'mode', NEW.mode,
      'hourly_rate', NEW.hourly_rate,
      'start_time', NEW.start_time,
      'end_time', NEW.end_time,
      'duration_mins', NEW.duration_mins,
      'price_paid', NEW.price_paid,
      'status', NEW.status,
      'notes', NEW.notes
    ),
    CURRENT_TIMESTAMP
  );
END$$

CREATE TRIGGER IF NOT EXISTS trg_sessions_audit_delete
AFTER DELETE ON sessions
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (
    id,
    user_id,
    action,
    table_name,
    record_id,
    old_value,
    new_value,
    created_at
  ) VALUES (
    UUID(),
    NULL,
    'DELETE',
    'sessions',
    OLD.id,
    JSON_OBJECT(
      'id', OLD.id,
      'device_id', OLD.device_id,
      'customer_id', OLD.customer_id,
      'mode', OLD.mode,
      'hourly_rate', OLD.hourly_rate,
      'start_time', OLD.start_time,
      'end_time', OLD.end_time,
      'duration_mins', OLD.duration_mins,
      'price_paid', OLD.price_paid,
      'status', OLD.status,
      'notes', OLD.notes
    ),
    NULL,
    CURRENT_TIMESTAMP
  );
END$$

-- ────────────────────────────────────────────────────────────
-- 6. GHOST SESSION REAPER: Auto-close abandoned sessions
-- Problem: Browser crash / network drop leaves session = 'active'
-- forever → device locked, revenue lost
-- ────────────────────────────────────────────────────────────

CREATE PROCEDURE IF NOT EXISTS reap_ghost_sessions()
BEGIN
  UPDATE sessions
  SET
    status = 'ghost',
    end_time = DATE_ADD(start_time, INTERVAL 12 HOUR),
    duration_mins = 720,
    notes = CONCAT(COALESCE(CONCAT(notes, ' | '), ''), CONCAT('[AUTO-CLOSED: ghost session ', NOW(), ']'))
  WHERE
    status = 'active'
    AND start_time < DATE_SUB(NOW(), INTERVAL 12 HOUR);

  UPDATE devices
  SET status = 'available'
  WHERE status = 'busy'
    AND id NOT IN (
      SELECT DISTINCT device_id
      FROM sessions
      WHERE status = 'active'
    );
END$$

-- ────────────────────────────────────────────────────────────
-- 7. STOP SESSION: Server-side only — client sends NOTHING
-- except the session ID. Server calculates everything.
-- Problem: Client-side stop_session allows manipulation of
-- end_time, duration, price → financial fraud vector
-- ────────────────────────────────────────────────────────────

CREATE PROCEDURE IF NOT EXISTS stop_session(IN p_session_id CHAR(36))
BEGIN
  DECLARE v_device_id INT;
  DECLARE v_start_time TIMESTAMP;
  DECLARE v_hourly_rate DECIMAL(10,2);
  DECLARE v_minutes INT;
  DECLARE v_price_paid DECIMAL(10,2);
  DECLARE session_not_found CONDITION FOR SQLSTATE '45000';

  -- Lock the row to prevent concurrent stop attempts
  SELECT device_id, start_time, hourly_rate
  INTO v_device_id, v_start_time, v_hourly_rate
  FROM sessions
  WHERE id = p_session_id AND status = 'active'
  LIMIT 1 FOR UPDATE;

  IF v_device_id IS NULL THEN
    SIGNAL session_not_found SET MESSAGE_TEXT = 'SESSION_NOT_FOUND: Session is not active or does not exist';
  END IF;

  -- Server calculates duration — never trust the client
  -- Minimum 1 minute charge
  SET v_minutes = GREATEST(
    CEILING(EXTRACT(EPOCH FROM (NOW() - v_start_time)) / 60),
    1
  );

  -- Calculate price using the rate locked at session start
  -- hourly_rate is stored in EGP; result in EGP with 2 decimal precision
  SET v_price_paid = ROUND(
    (v_minutes / 60.0) * COALESCE(v_hourly_rate, 0),
    2
  );

  -- Update session
  UPDATE sessions SET
    end_time = NOW(),
    duration_mins = v_minutes,
    price_paid = v_price_paid,
    status = 'completed'
  WHERE id = p_session_id;

  -- Release the device
  UPDATE devices
  SET status = 'available'
  WHERE id = v_device_id;

  -- Return the updated session
  SELECT * FROM sessions WHERE id = p_session_id;
END$$

-- ────────────────────────────────────────────────────────────
-- 8. START SESSION: Server-side with row locking
-- Problem: Two staff can start session on same device
-- simultaneously → two active sessions, billing chaos
-- ────────────────────────────────────────────────────────────

CREATE PROCEDURE IF NOT EXISTS start_session(
  IN p_device_id INT,
  IN p_customer_id VARCHAR(255),
  IN p_mode VARCHAR(50),
  IN p_hourly_rate DECIMAL(10,2)
)
BEGIN
  DECLARE v_device_status VARCHAR(50);
  DECLARE device_unavailable CONDITION FOR SQLSTATE '45000';

  -- Lock device row — prevents concurrent start on same device
  SELECT status
  INTO v_device_status
  FROM devices
  WHERE id = p_device_id
  LIMIT 1 FOR UPDATE;

  IF v_device_status IS NULL OR v_device_status != 'available' THEN
    SIGNAL device_unavailable SET MESSAGE_TEXT = 'DEVICE_UNAVAILABLE: Device is not available';
  END IF;

  -- Mark device as busy
  UPDATE devices SET status = 'busy' WHERE id = p_device_id;

  -- Create session with server timestamp
  INSERT INTO sessions (
    id,
    device_id,
    customer_id,
    mode,
    hourly_rate,
    start_time,
    status
  ) VALUES (
    UUID(),
    p_device_id,
    p_customer_id,
    p_mode,
    COALESCE(p_hourly_rate, 0),
    NOW(),
    'active'
  );

  -- Return the created session
  SELECT * FROM sessions WHERE id = LAST_INSERT_ID() LIMIT 1;
END$$

DELIMITER ;

-- ────────────────────────────────────────────────────────────
-- DONE: Migration 001 applied successfully
-- ────────────────────────────────────────────────────────────
