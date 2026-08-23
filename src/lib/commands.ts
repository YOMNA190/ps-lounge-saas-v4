import { supabase } from '@/lib/supabase'
import { sanitizeError } from '@/lib/errors'

type CommandPayload = Record<string, unknown> & { action: string; requestId?: string }

export async function invokeCommand<T>(payload: CommandPayload): Promise<T> {
  const requestId = payload.requestId ?? crypto.randomUUID()
  const { data, error } = await supabase.functions.invoke('command-api', {
    body: { ...payload, requestId },
  })

  if (error) throw new Error(sanitizeError(error).message)
  if (!data?.data) throw new Error(data?.code ?? 'COMMAND_FAILED')
  return data.data as T
}

export function recordPosSale(input: {
  branchId: string
  customerId?: string | null
  items: Array<{ productId: number; quantity: number }>
  paymentMethod?: 'cash' | 'vodafone_cash' | 'instapay' | 'debt' | 'subscription'
  notes?: string
  requestId?: string
}) {
  return invokeCommand<{ sale: { id: string; total: number }; payment_id: string }>({
    action: 'recordPosSale',
    branchId: input.branchId,
    customerId: input.customerId ?? null,
    items: input.items,
    paymentMethod: input.paymentMethod ?? 'cash',
    notes: input.notes,
    requestId: input.requestId,
  })
}

export function startSessionCommand(input: {
  branchId: string
  deviceId: number
  customerId?: string | null
  mode?: 'single' | 'multi'
  gamePlayed?: string
  requestId?: string
}) {
  return invokeCommand({
    action: 'startSession', branchId: input.branchId, deviceId: input.deviceId,
    customerId: input.customerId ?? null, mode: input.mode ?? 'single', gamePlayed: input.gamePlayed,
    requestId: input.requestId,
  })
}

export function createCustomerCommand(input: {
  branchId: string
  name: string
  phone?: string
  requestId?: string
}) {
  return invokeCommand<{ customer: { id: string; name: string; phone: string | null } }>({
    action: 'createCustomer', branchId: input.branchId, name: input.name, phone: input.phone,
    requestId: input.requestId,
  })
}

export function addOrderLineCommand(input: {
  branchId: string
  sessionId: string
  productId: number
  quantity: number
  notes?: string
  requestId?: string
}) {
  return invokeCommand({
    action: 'addOrderLine', branchId: input.branchId, sessionId: input.sessionId,
    productId: input.productId, quantity: input.quantity, notes: input.notes, requestId: input.requestId,
  })
}

export function closeSessionCommand(input: {
  branchId: string
  sessionId: string
  discountAmount?: number
  discountReason?: string
  paymentMethod?: 'cash' | 'vodafone_cash' | 'instapay' | 'debt' | 'subscription'
  requestId?: string
}) {
  return invokeCommand<{ grand_total: number; session_cost: number; orders_total: number }>({
    action: 'closeSession', branchId: input.branchId, sessionId: input.sessionId,
    discountAmount: input.discountAmount ?? 0, discountReason: input.discountReason,
    paymentMethod: input.paymentMethod ?? 'cash', requestId: input.requestId,
  })
}

export function updateExpenseCommand(input: {
  branchId: string
  expenseId: number
  amount: number
  name?: string
  requestId?: string
}) {
  return invokeCommand({
    action: 'updateExpense', branchId: input.branchId, expenseId: input.expenseId,
    amount: input.amount, name: input.name, requestId: input.requestId,
  })
}
