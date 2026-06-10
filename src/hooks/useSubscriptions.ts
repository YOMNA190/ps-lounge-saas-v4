import { useState, useEffect, useCallback } from 'react'
import { CustomerSubscription, SubscriptionPlan } from '@/types'
import { getCustomerSubscriptions, getSubscriptionPlans } from '@/lib/subscriptions'

export function useSubscriptions(customerId?: string) {
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [subs, pls] = await Promise.all([getCustomerSubscriptions(customerId), getSubscriptionPlans()])
    setSubscriptions(subs); setPlans(pls); setLoading(false)
  }, [customerId])

  useEffect(() => { fetch() }, [fetch])

  return { subscriptions, plans, loading, refetch: fetch }
}
