import { useState, useEffect } from 'react'
import { DashboardSummary } from '@/types'
import { getDashboardSummary } from '@/lib/analytics'

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardSummary().then(s => { setSummary(s); setLoading(false) })
  }, [])

  return { summary, loading }
}
