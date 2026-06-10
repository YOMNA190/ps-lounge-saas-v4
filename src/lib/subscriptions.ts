import { supabase } from '@/lib/supabase'
import { CustomerSubscription, SubscriptionPlan } from '@/types'
import { sanitizeError } from '@/lib/errors'

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('price')
  if (error) throw error
  return data || []
}

export async function getCustomerSubscriptions(customerId?: string): Promise<CustomerSubscription[]> {
  let q = supabase.from('customer_subscriptions').select(`*,plan:subscription_plans(*)`).order('created_at', { ascending: false })
  if (customerId) q = q.eq('customer_id', customerId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createSubscription(customerId: string, planId?: number, customHours?: number, customPrice?: number, customName?: string): Promise<CustomerSubscription> {
  const { data, error } = await supabase.rpc('create_subscription', { p_customer_id: customerId, p_plan_id: planId ?? null, p_custom_hours: customHours ?? null, p_custom_price: customPrice ?? null, p_custom_name: customName ?? null })
  if (error) throw new Error(sanitizeError(error).message)
  return data as CustomerSubscription
}
