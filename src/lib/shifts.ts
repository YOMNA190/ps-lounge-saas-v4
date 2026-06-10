import { supabase } from '@/lib/supabase'
import { Shift } from '@/types'
import { sanitizeError } from '@/lib/errors'

export async function getActiveShift(): Promise<Shift | null> {
  const { data, error } = await supabase.from('shifts').select(`*,staff:profiles(*)`).is('ended_at', null).maybeSingle()
  if (error) throw error
  return data
}

export async function startShift(openingCash = 0): Promise<Shift> {
  const { data, error } = await supabase.from('shifts').insert({ opening_cash: openingCash }).select().single()
  if (error) throw new Error(sanitizeError(error).message)
  return data
}

export async function endShift(shiftId: string, pin: string, closingCash: number, cashTaken: number, cashLeft: number): Promise<Shift> {
  const { data, error } = await supabase.rpc('end_shift', { p_shift_id: shiftId, p_pin: pin, p_closing_cash: closingCash, p_cash_taken: cashTaken, p_cash_left: cashLeft })
  if (error) throw new Error(sanitizeError(error).message)
  return data as Shift
}
