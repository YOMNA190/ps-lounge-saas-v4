import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useBranch } from '@/lib/branch-context'
import type { Device, Session } from '@/types'
import { applyDeviceDelta, attachActiveSessions, replaceActiveSession } from '@/lib/device-state'

type DeviceState = {
  devices: Device[]
  loading: boolean
  refreshAll: () => Promise<void>
  refreshDevice: (deviceId: number) => Promise<void>
}

const DeviceStateContext = createContext<DeviceState | null>(null)

export function DeviceStateProvider({ children }: { children: ReactNode }) {
  const { branchId } = useBranch()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const pendingDeviceIds = useRef(new Set<number>())
  const flushTimer = useRef<number | null>(null)

  const refreshAll = useCallback(async () => {
    if (!branchId) {
      setDevices([])
      setLoading(false)
      return
    }

    setLoading(true)
    const [{ data: devicesData, error }, { data: sessionsData }] = await Promise.all([
      supabase.from('devices').select('*').eq('branch_id', branchId).eq('is_active', true).order('id'),
      supabase.from('sessions').select('*,customer:customers(*)').is('ended_at', null).eq('branch_id', branchId),
    ])

    if (!error) setDevices(attachActiveSessions((devicesData ?? []) as Device[], (sessionsData ?? []) as Session[]))
    setLoading(false)
  }, [branchId])

  const refreshDevice = useCallback(async (deviceId: number) => {
    if (!branchId) return
    const { data, error } = await supabase
      .from('sessions')
      .select('*,customer:customers(*)')
      .eq('branch_id', branchId)
      .eq('device_id', deviceId)
      .is('ended_at', null)
      .maybeSingle()

    if (!error) setDevices((current) => replaceActiveSession(current, deviceId, (data as Session | null) ?? null))
  }, [branchId])

  const queueSessionRefresh = useCallback((deviceId: number) => {
    pendingDeviceIds.current.add(deviceId)
    if (flushTimer.current !== null) return
    flushTimer.current = window.setTimeout(() => {
      const deviceIds = [...pendingDeviceIds.current]
      pendingDeviceIds.current.clear()
      flushTimer.current = null
      void Promise.all(deviceIds.map(refreshDevice))
    }, 100)
  }, [refreshDevice])

  useEffect(() => { void refreshAll() }, [refreshAll])

  useEffect(() => {
    if (!branchId) return
    const channel = supabase
      .channel(`device-state-${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `branch_id=eq.${branchId}` }, (payload) => {
        const before = payload.old as Partial<Session>
        const after = payload.new as Partial<Session>
        for (const deviceId of new Set([before.device_id, after.device_id])) {
          if (typeof deviceId === 'number') queueSessionRefresh(deviceId)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices', filter: `branch_id=eq.${branchId}` }, (payload) => {
        const changed = (payload.new ?? payload.old) as Device
        if (changed?.id) setDevices((current) => applyDeviceDelta(current, payload.eventType, changed))
      })
      .subscribe()

    return () => {
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current)
      flushTimer.current = null
      pendingDeviceIds.current.clear()
      void supabase.removeChannel(channel)
    }
  }, [branchId, queueSessionRefresh])

  return <DeviceStateContext.Provider value={{ devices, loading, refreshAll, refreshDevice }}>{children}</DeviceStateContext.Provider>
}

export function useDeviceState() {
  const state = useContext(DeviceStateContext)
  if (!state) throw new Error('useDeviceState must be used within DeviceStateProvider')
  return state
}
