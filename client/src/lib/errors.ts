/**
 * Client-side error handling
 * Mirrors server-side error sanitization for consistent UX
 */

// Structured error codes thrown by our database functions
const DB_ERROR_CODES: Record<string, string> = {
  SESSION_NOT_FOUND: 'الجلسة غير موجودة أو تم إغلاقها بالفعل',
  DEVICE_UNAVAILABLE: 'الجهاز غير متاح حالياً',
  DUPLICATE_SESSION: 'يوجد جلسة نشطة بالفعل على هذا الجهاز',
};

const MYSQL_ERROR_CODES: Record<string, string> = {
  '1062': 'يوجد تكرار في البيانات — يرجى المحاولة مرة أخرى',
  '1452': 'خطأ في البيانات المرتبطة',
  '3819': 'البيانات المدخلة تنتهك قواعد النظام',
  '1213': 'يرجى المحاولة مرة أخرى — تضارع في العمليات',
};

export interface AppError {
  message: string; // User-facing Arabic message
  code?: string; // Internal code for programmatic handling
  isRetryable: boolean; // Should the UI offer a retry button?
}

/**
 * Sanitize any error into a user-friendly AppError with Arabic message.
 * Internal details are logged to console for debugging.
 */
export function sanitizeError(error: unknown): AppError {
  // Log full error internally for debugging
  console.error('[PS Lounge Error]', error);

  if (error instanceof Error) {
    const msg = error.message;

    // Check for our custom database function error codes
    for (const [code, arabicMsg] of Object.entries(DB_ERROR_CODES)) {
      if (msg.includes(code)) {
        return { message: arabicMsg, code, isRetryable: false };
      }
    }

    // Check for MySQL error codes
    const mysqlCodeMatch = msg.match(/(\d{4})/);
    if (mysqlCodeMatch && MYSQL_ERROR_CODES[mysqlCodeMatch[1]]) {
      const code = mysqlCodeMatch[1];
      return {
        message: MYSQL_ERROR_CODES[code],
        code,
        isRetryable: ['1213'].includes(code),
      };
    }

    // Network errors are retryable
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
      return {
        message: 'خطأ في الاتصال بالشبكة — تحقق من الإنترنت وحاول مرة أخرى',
        code: 'NETWORK_ERROR',
        isRetryable: true,
      };
    }

    // Timeout errors are retryable
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      return {
        message: 'انتهت مهلة الانتظار — يرجى المحاولة مرة أخرى',
        code: 'TIMEOUT_ERROR',
        isRetryable: true,
      };
    }
  }

  // Safe fallback — never expose internals
  return {
    message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    isRetryable: true,
  };
}

/**
 * Check if an error is retryable (transient failure)
 */
export function isRetryableError(error: unknown): boolean {
  return sanitizeError(error).isRetryable;
}

/**
 * Type guard to check if a value is an AppError
 */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'isRetryable' in value
  );
}
