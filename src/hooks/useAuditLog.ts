import { useState, useEffect, useCallback } from 'react'
import { AuditLogEntry } from '@/types'
import { getAuditLog } from '@/lib/audit'

export function useAuditLog(filters?: { action?: string; staffId?: string; fromDate?: string; toDate?: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const action = filters?.action
  const staffId = filters?.staffId
  const fromDate = filters?.fromDate
  const toDate = filters?.toDate

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getAuditLog({ action, staffId, fromDate, toDate })
    setEntries(data)
    setLoading(false)
  }, [action, staffId, fromDate, toDate])

  useEffect(() => { fetch() }, [fetch])

  return { entries, loading, refetch: fetch }
}
