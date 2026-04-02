/**
 * Authentication and authorization utilities
 * Provides type-safe role checking for financial data access
 */

export type UserRole = 'admin' | 'staff' | 'user';

/**
 * Type guard: Check if user has admin role
 * Use this instead of loose string comparisons like role === 'admin'
 */
export function requireAdmin(role: string | undefined | null): boolean {
  return role === 'admin';
}

/**
 * Type guard: Check if user has staff or admin role
 * Use this for operations available to staff and above
 */
export function requireStaff(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'staff';
}

/**
 * Type guard: Check if user can access financial data
 * Currently only admins can view financial reports
 */
export function canAccessFinancialData(role: string | undefined | null): boolean {
  return requireAdmin(role);
}

/**
 * Type guard: Check if user can start/stop sessions
 * Staff and admins can manage sessions
 */
export function canManageSessions(role: string | undefined | null): boolean {
  return requireStaff(role);
}

/**
 * Type guard: Check if user can view audit logs
 * Only admins can access audit trails for fraud detection
 */
export function canViewAuditLogs(role: string | undefined | null): boolean {
  return requireAdmin(role);
}
