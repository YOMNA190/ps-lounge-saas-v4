export type DeviceSlot = { branchId: string; deviceId: number; startAt: Date; endAt: Date };

export function hasDeviceBookingConflict(existing: DeviceSlot[], candidate: DeviceSlot) {
  if (candidate.startAt >= candidate.endAt) return true;
  return existing.some((slot) =>
    slot.branchId === candidate.branchId &&
    slot.deviceId === candidate.deviceId &&
    candidate.startAt < slot.endAt &&
    slot.startAt < candidate.endAt,
  );
}

export function calculateSessionCharge(durationSeconds: number, hourlyRate: number) {
  const safeDuration = Math.max(0, durationSeconds);
  const safeRate = Math.max(0, hourlyRate);
  const minutes = Math.max(Math.ceil(safeDuration / 60), 1);
  return Math.round((minutes / 60) * safeRate * 100) / 100;
}

export function calculateSessionBill(input: { durationSeconds: number; hourlyRate: number; ordersTotal: number; discount: number }) {
  const sessionCost = calculateSessionCharge(input.durationSeconds, input.hourlyRate);
  const ordersTotal = Math.max(0, input.ordersTotal);
  const grossTotal = Math.round((sessionCost + ordersTotal) * 100) / 100;
  const discount = Math.min(Math.max(0, input.discount), grossTotal);
  return { sessionCost, ordersTotal, discount, grandTotal: Math.round((grossTotal - discount) * 100) / 100 };
}

export function reconcileShiftCash(input: { openingCash: number; cashSales: number; cashTaken: number; cashLeft: number }) {
  const expectedCash = Math.max(0, input.openingCash) + Math.max(0, input.cashSales) - Math.max(0, input.cashTaken);
  return { expectedCash, variance: Math.round((input.cashLeft - expectedCash) * 100) / 100, balanced: Math.abs(input.cashLeft - expectedCash) < 0.01 };
}
