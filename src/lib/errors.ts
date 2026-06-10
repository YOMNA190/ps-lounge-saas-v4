interface AppError { message: string; code?: string }

const ERROR_MAP: Record<string, string> = {
  DEVICE_UNAVAILABLE: 'الجهاز غير موجود في فرعك',
  DUPLICATE_SESSION: 'يوجد جلسة نشطة بالفعل على هذا الجهاز',
  SESSION_NOT_FOUND: 'الجلسة غير موجودة أو منتهية',
  SESSION_NOT_ACTIVE: 'الجلسة غير موجودة أو منتهية',
  PRODUCT_NOT_FOUND: 'المنتج غير موجود',
  INSUFFICIENT_STOCK: 'الكمية غير متوفرة',
  INVALID_PAYMENT_METHOD: 'طريقة الدفع غير صالحة',
  DISCOUNT_TOO_HIGH: 'الخصم أكبر من الإجمالي',
  CUSTOMER_NOT_FOUND: 'العميل غير موجود',
  DEBT_NOT_FOUND: 'الدين غير موجود',
  OVERPAYMENT: 'المبلغ أكبر من الدين المتبقي',
  ADMIN_ONLY: 'هذه العملية تتطلب صلاحيات المدير',
  SUBSCRIPTION_NOT_FOUND_OR_EXPIRED: 'الاشتراك غير موجود أو منتهي',
  INSUFFICIENT_HOURS: 'ساعات الاشتراك غير كافية',
  PLAN_NOT_FOUND: 'الباقة غير موجودة',
  CUSTOM_PLAN_REQUIRES_HOURS_AND_PRICE: 'الخطة المخصصة تحتاج ساعات وسعر',
  NOT_ENOUGH_PLAYERS: 'يجب وجود لاعبين على الأقل',
}

export function sanitizeError(err: unknown): AppError {
  if (!err) return { message: 'حدث خطأ غير معروف' }

  const e = err as { message?: string; code?: string; error?: string; details?: string }
  const msg = e.message || e.error || 'حدث خطأ غير معروف'

  for (const [code, arMsg] of Object.entries(ERROR_MAP)) {
    if (msg.includes(code)) return { message: arMsg, code }
  }

  if (msg.includes('Password')) return { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  if (msg.includes('Email')) return { message: 'البريد الإلكتروني غير صالح أو مستخدم' }
  if (msg.includes('network')) return { message: 'مشكلة في الاتصال بالإنترنت' }
  if (msg.includes('timeout')) return { message: 'انتهت مهلة الاتصال' }

  return { message: msg || 'حدث خطأ، يرجى المحاولة مرة أخرى', code: e.code }
}

export function getErrorMessage(err: unknown): string {
  return sanitizeError(err).message
}
