import type { Device, Session } from '@/types'

export function attachActiveSessions(devices: Device[], sessions: Session[]): Device[] {
  const activeByDevice = new Map(sessions.map((session) => [session.device_id, session]))
  return devices.map((device) => ({ ...device, active_session: activeByDevice.get(device.id) ?? null }))
}

export function replaceActiveSession(devices: Device[], deviceId: number, session: Session | null): Device[] {
  return devices.map((device) => (
    device.id === deviceId ? { ...device, active_session: session } : device
  ))
}

export function applyDeviceDelta(devices: Device[], event: 'INSERT' | 'UPDATE' | 'DELETE', changed: Device): Device[] {
  if (event === 'DELETE') return devices.filter((device) => device.id !== changed.id)
  if (!changed.is_active) return devices.filter((device) => device.id !== changed.id)

  const previous = devices.find((device) => device.id === changed.id)
  const merged = { ...changed, active_session: previous?.active_session ?? null }
  return previous
    ? devices.map((device) => device.id === changed.id ? merged : device)
    : [...devices, merged].sort((a, b) => a.id - b.id)
}
