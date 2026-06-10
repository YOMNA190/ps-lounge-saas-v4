import { useState, useEffect, useCallback } from 'react'
import { AuditLogEntry } from '@/types'
import { getAuditLog } from '@/lib/audit'

export function useAuditLog(filters?: { action?: string; staffId?: string; fromDate?: string; toDate?: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getAuditLog(filters)
    setEntries(data)
    setLoading(false)
  }, [filters?.action, filters?.staffId, filters?.fromDate, filters?.toDate])

  useEffect(() => { fetch() }, [fetch])

  return { entries, loading, refetch: fetch }
}
