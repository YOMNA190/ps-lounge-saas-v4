import { describe, expect, it } from 'vitest'
import { calculateSessionBill, calculateShiftCloseout, hasDeviceBookingConflict, reconcileShiftCash } from './businessRules'

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

  it('combines session and POS revenue for a closeout recommendation', () => {
    expect(calculateShiftCloseout({ openingCash: 100, sessionsRevenue: 150.5, salesRevenue: 49.5, closingCash: 300 })).toEqual({ totalRevenue: 200, expectedCash: 300, variance: 0, balanced: true, recommendedCashTaken: 200, recommendedCashLeft: 100 })
  })

  it('keeps closeout recommendations non-negative when the counted cash is short', () => {
    expect(calculateShiftCloseout({ openingCash: 100, sessionsRevenue: 120, salesRevenue: 30, closingCash: 210 })).toMatchObject({ expectedCash: 250, variance: -40, balanced: false, recommendedCashTaken: 110, recommendedCashLeft: 100 })
  })
})
