import { supabase } from '@/lib/supabase'
import { Debt, CustomerDebtSummary } from '@/types'
import { sanitizeError } from '@/lib/errors'

export async function getDebts(status?: string): Promise<Debt[]> {
  let q = supabase.from('debts').select(`*,customer:customers(*)`).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getCustomerDebtSummaries(): Promise<CustomerDebtSummary[]> {
  const { data, error } = await supabase.from('customer_debt_summary').select('*')
  if (error) throw error
  return data || []
}

export async function payDebt(debtId: string, amount: number, paymentMethod = 'cash'): Promise<Debt> {
  const { data, error } = await supabase.rpc('pay_debt', { p_debt_id: debtId, p_amount: amount, p_payment_method: paymentMethod })
  if (error) throw new Error(sanitizeError(error).message)
  return data as Debt
}

export async function waiveDebt(debtId: string, reason: string): Promise<Debt> {
  const { data, error } = await supabase.rpc('waive_debt', { p_debt_id: debtId, p_reason: reason })
  if (error) throw new Error(sanitizeError(error).message)
  return data as Debt
}
