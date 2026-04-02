# PS Lounge SaaS v4 — Security Hardening Implementation

## Phase 1: Database Layer (SQL Migration)
- [x] Create SQL migration file with all security constraints
  - [x] Unique index on sessions (device_id, status) to prevent duplicate active sessions
  - [x] CHECK constraints for positive prices, durations, loyalty points
  - [x] Performance indexes on sessions (device_id, status, start_time, customer_id)
  - [x] Audit log table with append-only RLS policies
  - [x] Audit trigger on sessions table
  - [x] Ghost session reaper function (auto-close after 12 hours)
  - [x] Server-side start_session function with row locking
  - [x] Server-side stop_session function with server-calculated pricing

## Phase 2: Error Handling & Utilities
- [x] Create src/lib/errors.ts with error sanitization
  - [x] DB_ERROR_CODES mapping for custom PostgreSQL errors
  - [x] POSTGRES_ERROR_CODES mapping for standard PostgreSQL errors
  - [x] sanitizeError() function to convert errors to Arabic messages
  - [x] isRetryableError() helper function
  - [x] AppError interface definition
- [x] Create client/src/lib/errors.ts with matching error handling
- [x] Create client/src/lib/auth.ts with role-based access control helpers

## Phase 3: Session Operations
- [x] Update src/lib/sessions.ts
  - [x] Replace startSession to use RPC with server-side function
  - [x] Replace stopSession to use RPC with server-side function
  - [x] Add calculateSessionPrice utility for client-side display
  - [x] Remove any direct .update() or .insert() calls on sessions table

## Phase 4: Realtime & Hooks
- [x] Update src/hooks/useDevices.ts
  - [x] Add branch_id filter to Realtime subscription
  - [x] Add isGhostRisk() helper to detect sessions > 6 hours
  - [x] Export isGhostRisk for use in components

## Phase 5: React Components
- [x] Update src/components/devices/DeviceCard.tsx
  - [x] Add isProcessing state for double-click guard
  - [x] Wrap session handlers with processing guard
  - [x] Disable buttons while processing
  - [x] Add ghost session warning badge (> 6 hours)
  - [x] Use sanitizeError for error messages
- [ ] Update src/components/devices/StartSessionModal.tsx
  - [ ] Remove client-side price calculation from payload
  - [ ] Keep price display for UX but don't send to server

## Phase 6: Authentication & Authorization
- [x] Update src/lib/auth.ts
  - [x] Add requireAdmin() type guard function
  - [x] Add requireStaff() type guard function
  - [x] Add canAccessFinancialData() type guard function
  - [x] Add canManageSessions() type guard function
  - [x] Add canViewAuditLogs() type guard function

## Phase 7: Testing
- [x] Create src/lib/__tests__/pricing.test.ts
  - [x] Test minimum 1-minute charge
  - [x] Test ceiling rounding on partial minutes
  - [x] Test exact hour calculations
  - [x] Test 30-minute calculations
  - [x] Test negative duration handling
  - [x] Test zero hourly rate handling
  - [x] Test high-value sessions
  - [x] Test floating point precision
- [x] Vitest already in package.json devDependencies
- [x] Add test:watch script to package.json

## Phase 8: Verification & Deployment
- [ ] Apply SQL migration to Supabase database (migration file ready)
- [ ] Verify RLS enabled on all tables (audit_log table with append-only RLS)
- [ ] Verify unique index created (unique index on sessions(device_id, status))
- [ ] Test start_session RPC call (implemented with server-side locking)
- [ ] Test stop_session RPC call (implemented with server-calculated pricing)
- [ ] Test DeviceCard double-click guard (isProcessing state prevents duplicate clicks)
- [ ] Test ghost warning appearance (isGhostRisk helper detects sessions > 6 hours)
- [x] Run pricing unit tests: `pnpm test` (27 tests PASSED in client/src/lib/__tests__/pricing.test.ts)
- [ ] Resolve TypeScript compilation errors (14 TS errors in existing pages)
- [x] Create checkpoint (saved at manus-webdev://d7d10188)

## Notes
- All error messages must be in Arabic
- Multi-tenancy: branch_id filtering required on Realtime subscriptions
- Financial data: server-side calculations are authoritative
- Client-side pricing is display-only, never sent to server
- Row-level locking prevents race conditions on start/stop
- Audit log is append-only for forensic trail
