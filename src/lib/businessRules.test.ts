import { describe, expect, it } from 'vitest'
import { calculateSessionBill, hasDeviceBookingConflict, reconcileShiftCash } from './businessRules'

describe('PS Lounge business rules', () => {
  it('blocks only overlapping bookings for the same device within the same branch', () => {
    const existing = [{ branchId: 'riyadh', deviceId: 7, startAt: new Date('2026-08-23T10:00:00Z'), endAt: new Date('2026-08-23T11:00:00Z') }]
    expect(hasDeviceBookingConflict(existing, { branchId: 'riyadh', deviceId: 7, startAt: new Date('2026-08-23T10:30:00Z'), endAt: new Date('2026-08-23T11:30:00Z') })).toBe(true)
    expect(hasDeviceBookingConflict(existing, { branchId: 'jeddah', deviceId: 7, startAt: new Date('2026-08-23T10:30:00Z'), endAt: new Date('2026-08-23T11:30:00Z') })).toBe(false)
    expect(hasDeviceBookingConflict(existing, { branchId: 'riyadh', deviceId: 7, startAt: new Date('2026-08-23T11:00:00Z'), endAt: new Date('2026-08-23T12:00:00Z') })).toBe(false)
  })

  it('caps discount at the combined session and order total', () => {
    expect(calculateSessionBill({ durationSeconds: 90 * 60, hourlyRate: 40, ordersTotal: 35, discount: 200 })).toEqual({ sessionCost: 60, ordersTotal: 35, discount: 95, grandTotal: 0 })
  })

  it('reports an explicit cash variance when a shift does not reconcile', () => {
    expect(reconcileShiftCash({ openingCash: 100, cashSales: 250, cashTaken: 50, cashLeft: 290 })).toEqual({ expectedCash: 300, variance: -10, balanced: false })
  })
})
