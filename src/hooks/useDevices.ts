import { useState, useEffect, useCallback } from 'react'
import { Device, Session } from '@/types'
import { supabase } from '@/lib/supabase'
import { useBranch } from '@/lib/branch-context'
import { subscribeToSessions } from '@/lib/sessions'

export function useDevices() {
  const { branchId } = useBranch()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDevices = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const { data: devicesData, error } = await supabase.from('devices').select('*').eq('branch_id', branchId).eq('is_active', true).order('id')
    if (error) { setLoading(false); return }

    const { data: sessionsData } = await supabase.from('sessions').select(`*,customer:customers(*)`).is('ended_at', null).eq('branch_id', branchId)
    const activeSessionsMap = new Map<number, Session>()
    sessionsData?.forEach((s: Session) => activeSessionsMap.set(s.device_id, s))

    const devicesWithSessions = (devicesData || []).map((d: Device) => ({
      ...d,
      active_session: activeSessionsMap.get(d.id) || null,
    }))

    setDevices(devicesWithSessions)
    setLoading(false)
  }, [branchId])

  useEffect(() => { fetchDevices() }, [fetchDevices])

  useEffect(() => {
    if (!branchId) return
    const sub = subscribeToSessions(fetchDevices, branchId)
    return () => { sub.unsubscribe() }
  }, [branchId, fetchDevices])

  return { devices, loading, refetch: fetchDevices }
}

export function isGhostRisk(startedAt: string): boolean {
  return Date.now() - new Date(startedAt).getTime() > 4 * 3600000
}
