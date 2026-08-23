import { useState, useEffect, useCallback } from 'react'
import { Device, Session } from '@/types'
import { supabase } from '@/lib/supabase'
import { useBranch } from '@/lib/branch-context'

export function useDevices() {
  const { branchId } = useBranch()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDevices = useCallback(async () => {
    if (!branchId) {
      setDevices([])
      setLoading(false)
      return
    }
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

  const refreshDeviceSession = useCallback(async (deviceId: number) => {
    if (!branchId) return
    const { data, error } = await supabase
      .from('sessions')
      .select('*,customer:customers(*)')
      .eq('branch_id', branchId)
      .eq('device_id', deviceId)
      .is('ended_at', null)
      .maybeSingle()

    if (error) return
    setDevices((current) => current.map((device) => (
      device.id === deviceId ? { ...device, active_session: (data as Session | null) } : device
    )))
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    const channel = supabase
      .channel(`device-session-deltas-${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `branch_id=eq.${branchId}` }, (payload) => {
        const changed = (payload.new as Partial<Session>)?.device_id ?? (payload.old as Partial<Session>)?.device_id
        if (typeof changed === 'number') void refreshDeviceSession(changed)
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [branchId, refreshDeviceSession])

  return { devices, loading, refetch: fetchDevices }
}

export function isGhostRisk(startedAt: string, now = Date.now()): boolean {
  return now - new Date(startedAt).getTime() > 4 * 3600000
}
