# PS Lounge SaaS v4 — Roadmap

This document outlines the current state, recently implemented features, and future development plans for the PS Lounge SaaS project.

## Recently Completed (v4-final)

### Security Hardening & Database Enhancements
- **Database Layer (SQL Migration):**
  - Unique index on sessions (device_id, status) to prevent duplicate active sessions.
  - CHECK constraints for positive prices, durations, loyalty points.
  - Performance indexes on sessions (device_id, status, start_time, customer_id).
  - Audit log table with append-only RLS policies and audit trigger on sessions table.
  - Ghost session reaper function (auto-close after 12 hours).
  - Server-side `start_session` function with row locking.
  - Server-side `stop_session` function with server-calculated pricing.
- **Error Handling & Utilities:**
  - `src/lib/errors.ts` with error sanitization, DB_ERROR_CODES, POSTGRES_ERROR_CODES, `sanitizeError()`, `isRetryableError()`, and `AppError` interface.
  - Client-side error handling in `client/src/lib/errors.ts`.
  - Role-based access control helpers in `client/src/lib/auth.ts`.
- **Session Operations:**
  - Updated `src/lib/sessions.ts` to use RPC for `startSession` and `stopSession` with server-side functions.
  - `calculateSessionPrice` utility for client-side display.
  - Removal of direct `.update()` or `.insert()` calls on sessions table.
- **Realtime & Hooks:**
  - `src/hooks/useDevices.ts` updated with `branch_id` filter for Realtime subscription and `isGhostRisk()` helper.
- **React Components:**
  - `src/components/devices/DeviceCard.tsx` updated with `isProcessing` state, processing guard, and ghost session warning badge.
  - `src/components/devices/StartSessionModal.tsx` updated to remove client-side price calculation from payload.
- **Authentication & Authorization:**
  - `src/lib/auth.ts` updated with `requireAdmin()`, `requireStaff()`, `canAccessFinancialData()`, `canManageSessions()`, and `canViewAuditLogs()` type guard functions.
- **Testing:**
  - Comprehensive pricing unit tests (`src/lib/__tests__/pricing.test.ts`) covering various scenarios.
  - Vitest integration and `test:watch` script.
- **Verification & Deployment:**
  - SQL migration applied to Supabase database.
  - RLS enabled on all tables and unique index created.
  - RPC calls for `start_session` and `stop_session` tested.
  - DeviceCard double-click guard and ghost warning appearance verified.
  - TypeScript compilation errors resolved.
  - UI Screenshots Guide created (`UI_SCREENSHOTS_GUIDE.md`).

### New Features & Modules
- **TrialGuard:** Implemented `src/components/TrialGuard.tsx` for managing trial periods or feature access.
- **Onboarding Process:** New `src/pages/OnboardingPage.tsx` for guiding new users through initial setup.
- **Password Reset:** Added `src/pages/ResetPasswordPage.tsx` for user password recovery.
- **Cards Management:** Introduced `src/pages/CardsPage.tsx` and `src/lib/cards.ts` for managing internet cards or similar functionalities.
- **Settings Page:** New `src/pages/SettingsPage.tsx` for user and application settings.
- **Branch Context:** `src/lib/branch-context.tsx` for multi-tenancy support or managing different branches/locations.
- **Supabase Migrations:** New migrations (`004_internet_cards.sql`, `005_multitenancy.sql`, `006_security_indexes.sql`) reflecting database schema changes for new features.

## Future Enhancements

### User Experience & Interface
- **Advanced Analytics Dashboard:** Expand analytics with more detailed reports, custom date ranges, and predictive insights.
- **Notifications System:** Implement in-app and email notifications for critical events (e.g., low inventory, session nearing end).
- **Theming Options:** Allow users to customize the application's theme and appearance.

### Core Functionality
- **Inventory Management:** Enhance inventory tracking with supplier management, automated reorder points, and stock alerts.
- **POS Integration:** Integrate with point-of-sale systems for seamless transaction processing.
- **Multi-language Support:** Add support for multiple languages to cater to a broader user base.
- **Booking System:** Implement a reservation system for devices, allowing customers to book sessions in advance.

### Performance & Scalability
- **Performance Monitoring:** Integrate advanced monitoring tools to track application performance and identify bottlenecks.
- **Caching Mechanisms:** Implement caching strategies to improve data retrieval speed and reduce database load.

### Security & Compliance
- **Two-Factor Authentication (2FA):** Add 2FA for enhanced account security.
- **GDPR/CCPA Compliance:** Ensure the application adheres to data privacy regulations.

### Technical Debt & Refactoring
- **Code Refactoring:** Continuously refactor existing codebase to improve maintainability and readability.
- **Automated Testing:** Expand unit and integration test coverage for all new and existing features.

## Deployment Instructions

### Step 1: Apply SQL Migrations
Ensure all new SQL migration files (e.g., `drizzle/migrations/*.sql` and `supabase/migrations/*.sql`) are applied to your Supabase database in the correct order.

### Step 2: Update Environment Variables
Review and update your `.env.local` file with any new environment variables introduced (e.g., from `.env.example`).

### Step 3: Deploy to Production
1. Run `pnpm install` to ensure all dependencies are up to date.
2. Run `pnpm build` to generate the production-ready build.
3. Deploy the `dist/` folder to your preferred hosting provider (Vercel / Netlify / Cloudflare Pages).
4. Run smoke tests to verify functionality after deployment.
