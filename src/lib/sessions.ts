import { supabase } from '@/lib/supabase'
import { Session, SessionBill } from '@/types'
import { sanitizeError } from '@/lib/errors'
import { calculateSessionCharge } from '@/lib/businessRules'

export function calculateSessionPrice(durationSeconds: number, hourlyRate: number): number {
  return calculateSessionCharge(durationSeconds, hourlyRate)
}

export async function startSession(deviceId: number, customerId?: string, mode = 'single', hourlyRate?: number, gamePlayed?: string): Promise<Session> {
  try {
    const { data, error } = await supabase.rpc('start_session', {
      p_device_id: deviceId, p_customer_id: customerId ?? null, p_mode: mode, p_hourly_rate: hourlyRate ?? null, p_game_played: gamePlayed ?? null
    })
    if (error) throw new Error(sanitizeError(error).message)
    const session = Array.isArray(data) ? data[0] : data
    if (!session) throw new Error('فشل إنشاء الجلسة')
    return session as Session
  } catch (err) { throw new Error(sanitizeError(err).message) }
}

export async function stopSession(sessionId: string): Promise<Session> {
  try {
    const { data, error } = await supabase.rpc('stop_session', { p_session_id: sessionId })
    if (error) throw new Error(sanitizeError(error).message)
    const session = Array.isArray(data) ? data[0] : data
    if (!session) throw new Error('فشل إنهاء الجلسة')
    return session as Session
  } catch (err) { throw new Error(sanitizeError(err).message) }
}

export async function stopSessionWithBill(sessionId: string, discountAmount = 0, discountReason?: string, paymentMethod = 'cash'): Promise<{ session: Session; session_cost: number; orders_total: number; discount: number; grand_total: number; payment_method: string }> {
  try {
    const { data, error } = await supabase.rpc('stop_session_with_bill', {
      p_session_id: sessionId, p_discount_amount: discountAmount, p_discount_reason: discountReason ?? null, p_payment_method: paymentMethod
    })
    if (error) throw new Error(sanitizeError(error).message)
    return data as { session: Session; session_cost: number; orders_total: number; discount: number; grand_total: number; payment_method: string }
  } catch (err) { throw new Error(sanitizeError(err).message) }
}

export async function addOrderToSession(sessionId: string, productId: number, qty: number, notes?: string) {
  try {
    const { data, error } = await supabase.rpc('add_order_to_session', { p_session_id: sessionId, p_product_id: productId, p_qty: qty, p_notes: notes ?? null })
    if (error) throw new Error(sanitizeError(error).message)
    return data as { success: boolean; sale_id: string; item_id: number; product_name: string; qty: number; unit_price: number; subtotal: number }
  } catch (err) { throw new Error(sanitizeError(err).message) }
}

export async function getSessionBill(sessionId: string): Promise<SessionBill> {
  try {
    const { data, error } = await supabase.rpc('get_session_bill', { p_session_id: sessionId })
    if (error) throw new Error(sanitizeError(error).message)
    return data as unknown as SessionBill
  } catch (err) { throw new Error(sanitizeError(err).message) }
}

export async function getActiveSessions(): Promise<Session[]> {
  const { data, error } = await supabase.from('sessions').select(`*,device:devices(*),customer:customers(*)`).is('ended_at', null).order('started_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTodaySessions(): Promise<Session[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const { data, error } = await supabase.from('sessions').select(`*,device:devices(*),customer:customers(*)`).gte('started_at', today.toISOString()).not('ended_at', 'is', null).order('ended_at', { ascending: false })
  if (error) throw error
  return data || []
}

let channelCounter = 0
export function subscribeToSessions(callback: () => void, branchId?: string) {
  const channelName = `sessions_realtime_${++channelCounter}_${Date.now()}`
  return supabase.channel(channelName).on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', ...(branchId && { filter: `branch_id=eq.${branchId}` }) }, callback).subscribe()
}
