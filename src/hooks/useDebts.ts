import { useState, useEffect, useCallback } from 'react'
import { Debt, CustomerDebtSummary } from '@/types'
import { getDebts, getCustomerDebtSummaries } from '@/lib/debts'

export function useDebts(status?: string) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [summaries, setSummaries] = useState<CustomerDebtSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [d, s] = await Promise.all([getDebts(status), getCustomerDebtSummaries()])
    setDebts(d); setSummaries(s); setLoading(false)
  }, [status])

  useEffect(() => { fetch() }, [fetch])

  return { debts, summaries, loading, refetch: fetch }
}
