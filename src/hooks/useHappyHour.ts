import { useState, useEffect, useCallback } from 'react'
import { HappyHour, HappyHourCheck } from '@/types'
import { getHappyHours, checkHappyHour } from '@/lib/happy-hour'

export function useHappyHour() {
  const [happyHours, setHappyHours] = useState<HappyHour[]>([])
  const [current, setCurrent] = useState<HappyHourCheck | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [hh, cur] = await Promise.all([getHappyHours(), checkHappyHour('all')])
    setHappyHours(hh); setCurrent(cur); setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { happyHours, current, loading, refetch: fetch }
}
