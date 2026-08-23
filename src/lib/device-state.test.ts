import { describe, expect, it } from 'vitest'
import { applyDeviceDelta, attachActiveSessions, replaceActiveSession } from './device-state'
import type { Device, Session } from '@/types'

const device = (id: number): Device => ({
  id, name: `PS ${id}`, type: 'PS5', is_active: true, price_single: 30, price_multi: 50,
  branch_id: 'branch-a', created_at: '2026-08-23T00:00:00.000Z', active_session: null,
})

const session = (deviceId: number): Session => ({
  id: `session-${deviceId}`, device_id: deviceId, customer_id: null, mode: 'single', game_played: null,
  started_at: '2026-08-23T00:00:00.000Z', ended_at: null, cost: null, staff_id: null, notes: null,
  branch_id: 'branch-a', created_at: '2026-08-23T00:00:00.000Z',
})

describe('device state helpers', () => {
  it('attaches only active sessions to their matching devices', () => {
    const state = attachActiveSessions([device(1), device(2)], [session(2)])
    expect(state[0].active_session).toBeNull()
    expect(state[1].active_session?.id).toBe('session-2')
  })

  it('replaces a single device session without changing the rest of the grid', () => {
    const unchanged = device(1)
    const state = replaceActiveSession([unchanged, device(2)], 2, session(2))
    expect(state[0]).toBe(unchanged)
    expect(state[1].active_session?.device_id).toBe(2)
  })

  it('handles device insert, update, and delete deltas deterministically', () => {
    const inserted = applyDeviceDelta([device(2)], 'INSERT', device(1))
    expect(inserted.map((item) => item.id)).toEqual([1, 2])
    const inactive = applyDeviceDelta(inserted, 'UPDATE', { ...device(1), is_active: false })
    expect(inactive.map((item) => item.id)).toEqual([2])
    expect(applyDeviceDelta(inactive, 'DELETE', device(2))).toHaveLength(0)
  })
})
