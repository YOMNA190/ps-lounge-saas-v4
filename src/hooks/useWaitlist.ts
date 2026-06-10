import { useState, useEffect, useCallback } from 'react'
import { WaitlistEntry } from '@/types'
import { getWaitlist } from '@/lib/waitlist'

export function useWaitlist(status?: string) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getWaitlist(status)
    setEntries(data); setLoading(false)
  }, [status])

  useEffect(() => { fetch() }, [fetch])

  return { entries, loading, refetch: fetch }
}
