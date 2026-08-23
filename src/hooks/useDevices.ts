import { useDeviceState } from '@/lib/device-state-context'

export function useDevices() {
  const { devices, loading, refreshAll, refreshDevice } = useDeviceState()
  return { devices, loading, refetch: refreshAll, refreshDevice }
}

export function isGhostRisk(startedAt: string, now = Date.now()): boolean {
  return now - new Date(startedAt).getTime() > 4 * 3600000
}
