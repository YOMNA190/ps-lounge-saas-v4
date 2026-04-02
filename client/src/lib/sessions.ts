/**
 * Session operations — All critical operations use server-side functions
 * with row-level locking to prevent race conditions and financial fraud.
 */

import { sanitizeError } from './errors';

export interface Session {
  id: string;
  device_id: number;
  customer_id?: string;
  mode: string;
  hourly_rate: number;
  start_time: string;
  end_time?: string;
  duration_mins?: number;
  price_paid?: number;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Calculate session price for display purposes.
 * This is CLIENT-SIDE DISPLAY ONLY.
 * The authoritative calculation lives in the stop_session() database function.
 *
 * @param durationSeconds - Duration in seconds
 * @param hourlyRate - Hourly rate in EGP
 * @returns Price in EGP, rounded to 2 decimal places
 */
export function calculateSessionPrice(
  durationSeconds: number,
  hourlyRate: number
): number {
  // Ensure non-negative inputs
  if (durationSeconds < 0) durationSeconds = 0;
  if (hourlyRate < 0) hourlyRate = 0;

  // Convert seconds to minutes, rounding UP (ceiling)
  const minutes = Math.max(Math.ceil(durationSeconds / 60), 1); // Minimum 1 minute

  // Calculate price: (minutes / 60) * hourly_rate
  const price = (minutes / 60) * hourlyRate;

  // Round to 2 decimal places
  return Math.round(price * 100) / 100;
}

/**
 * Start a new session on a device.
 * Server-side function ensures:
 * - Row-level locking prevents concurrent starts on same device
 * - Device status is atomically updated
 * - Session timestamp is server-generated (never client-provided)
 *
 * @throws AppError with Arabic message on failure
 */
export async function startSession(
  deviceId: number,
  customerId?: string,
  mode: string = 'single',
  hourlyRate?: number
): Promise<Session> {
  try {
    // Call server-side stored procedure via API
    const response = await fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        customerId: customerId || null,
        mode,
        hourlyRate: hourlyRate || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'فشل بدء الجلسة');
    }

    const session = await response.json();
    if (!session?.id) {
      throw new Error('فشل إنشاء الجلسة');
    }

    return session as Session;
  } catch (error) {
    const appError = sanitizeError(error);
    throw new Error(appError.message);
  }
}

/**
 * Stop an active session.
 * Server-side function ensures:
 * - Row-level locking prevents concurrent stop attempts
 * - Duration is calculated server-side (never client-provided)
 * - Price is calculated using locked hourly rate
 * - Device status is atomically released
 *
 * @throws AppError with Arabic message on failure
 */
export async function stopSession(sessionId: string): Promise<Session> {
  try {
    const response = await fetch('/api/sessions/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'فشل إنهاء الجلسة');
    }

    const session = await response.json();
    if (!session?.id) {
      throw new Error('فشل إنهاء الجلسة');
    }

    return session as Session;
  } catch (error) {
    const appError = sanitizeError(error);
    throw new Error(appError.message);
  }
}

/**
 * Get all active sessions for the current branch.
 * Filtered by branch_id to prevent cross-tenant leakage.
 */
export async function getActiveSessions(): Promise<Session[]> {
  try {
    const response = await fetch('/api/sessions/active');

    if (!response.ok) {
      throw new Error('فشل جلب الجلسات النشطة');
    }

    return (await response.json()) as Session[];
  } catch (error) {
    const appError = sanitizeError(error);
    throw new Error(appError.message);
  }
}

/**
 * Get today's completed sessions for analytics.
 */
export async function getTodaySessions(): Promise<Session[]> {
  try {
    const response = await fetch('/api/sessions/today');

    if (!response.ok) {
      throw new Error('فشل جلب جلسات اليوم');
    }

    return (await response.json()) as Session[];
  } catch (error) {
    const appError = sanitizeError(error);
    throw new Error(appError.message);
  }
}
