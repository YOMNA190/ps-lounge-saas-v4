import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

type Json = Record<string, unknown>

const uuid = z.string().uuid()
const nullableUuid = uuid.nullable().optional()

const commandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('provisionBranch'),
    requestId: uuid,
    branchName: z.string().trim().min(2).max(120),
    address: z.string().trim().max(300).optional(),
    phone: z.string().trim().max(32).optional(),
  }),
  z.object({
    action: z.literal('startSession'),
    requestId: uuid,
    branchId: uuid,
    deviceId: z.number().int().positive(),
    customerId: nullableUuid,
    mode: z.enum(['single', 'multi']).default('single'),
    gamePlayed: z.string().trim().max(120).optional(),
  }),
  z.object({
    action: z.literal('createCustomer'),
    requestId: uuid,
    branchId: uuid,
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(32).optional(),
  }),
  z.object({
    action: z.literal('addOrderLine'),
    requestId: uuid,
    branchId: uuid,
    sessionId: uuid,
    productId: z.number().int().positive(),
    quantity: z.number().int().positive().max(100),
    notes: z.string().trim().max(240).optional(),
  }),
  z.object({
    action: z.literal('recordPosSale'),
    requestId: uuid,
    branchId: uuid,
    customerId: nullableUuid,
    items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive().max(100) })).min(1).max(50),
    paymentMethod: z.enum(['cash', 'vodafone_cash', 'instapay', 'debt', 'subscription']),
    notes: z.string().trim().max(240).optional(),
  }),
  z.object({
    action: z.literal('closeSession'),
    requestId: uuid,
    branchId: uuid,
    sessionId: uuid,
    discountAmount: z.number().nonnegative().max(10000).default(0),
    discountReason: z.string().trim().max(240).optional(),
    paymentMethod: z.enum(['cash', 'vodafone_cash', 'instapay', 'debt', 'subscription']).default('cash'),
  }),
  z.object({
    action: z.literal('openShift'),
    requestId: uuid,
    branchId: uuid,
    openingCash: z.number().nonnegative().max(1_000_000).default(0),
  }),
  z.object({
    action: z.literal('closeShift'),
    requestId: uuid,
    branchId: uuid,
    shiftId: uuid,
    pin: z.string().max(64).optional(),
    closingCash: z.number().nonnegative().max(1_000_000),
    cashTaken: z.number().nonnegative().max(1_000_000).default(0),
    cashLeft: z.number().nonnegative().max(1_000_000).default(0),
  }),
  z.object({
    action: z.literal('updateExpense'),
    requestId: uuid,
    branchId: uuid,
    expenseId: z.number().int().positive(),
    amount: z.number().nonnegative().max(1_000_000),
    name: z.string().trim().min(1).max(120).optional(),
  }),
  z.object({
    action: z.literal('queueDeviceCommand'),
    requestId: uuid,
    branchId: uuid,
    deviceId: z.number().int().positive(),
    type: z.enum(['power_on', 'power_off', 'relay_on', 'relay_off', 'health_probe']),
    payload: z.record(z.unknown()).default({}),
  }),
])

function getKey(name: 'publishable' | 'secret'): string {
  const modern = Deno.env.get(name === 'secret' ? 'SUPABASE_SECRET_KEYS' : 'SUPABASE_PUBLISHABLE_KEYS')
  if (modern) {
    const keys = JSON.parse(modern) as Record<string, string>
    if (keys.default) return keys.default
  }
  const legacy = Deno.env.get(name === 'secret' ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY')
  if (!legacy) throw new Error(`Missing Supabase ${name} key`)
  return legacy
}

function cors(origin: string | null) {
  const configured = (Deno.env.get('COMMAND_API_ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  const isAllowed = origin && (configured.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || /^http:\/\/localhost(:\d+)?$/i.test(origin))
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  }
}

function json(body: Json, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get('Origin'))
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405, headers)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ code: 'UNAUTHORIZED' }, 401, headers)

  const url = Deno.env.get('SUPABASE_URL')
  if (!url) return json({ code: 'SERVER_CONFIGURATION_ERROR' }, 500, headers)

  const userClient = createClient(url, getKey('publishable'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ code: 'UNAUTHORIZED' }, 401, headers)

  let parsed: z.infer<typeof commandSchema>
  try {
    parsed = commandSchema.parse(await request.json())
  } catch (error) {
    const details = error instanceof z.ZodError ? error.flatten() : undefined
    return json({ code: 'INVALID_COMMAND', details }, 400, headers)
  }

  const admin = createClient(url, getKey('secret'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const actorId = authData.user.id

  let rpcName: string
  let rpcInput: Json
  switch (parsed.action) {
    case 'provisionBranch':
      rpcName = 'command_provision_branch'
      rpcInput = { p_actor_id: actorId, p_request_id: parsed.requestId, p_branch_name: parsed.branchName, p_address: parsed.address ?? null, p_phone: parsed.phone ?? null }
      break
    case 'createCustomer':
      rpcName = 'command_create_customer'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_name: parsed.name, p_phone: parsed.phone ?? null }
      break
    case 'startSession':
      rpcName = 'command_start_session'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_device_id: parsed.deviceId, p_customer_id: parsed.customerId ?? null, p_mode: parsed.mode, p_game_played: parsed.gamePlayed ?? null }
      break
    case 'addOrderLine':
      rpcName = 'command_add_order_line'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_session_id: parsed.sessionId, p_product_id: parsed.productId, p_qty: parsed.quantity, p_notes: parsed.notes ?? null }
      break
    case 'recordPosSale':
      rpcName = 'command_record_pos_sale'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_customer_id: parsed.customerId ?? null, p_items: parsed.items.map((item) => ({ product_id: item.productId, qty: item.quantity })), p_payment_method: parsed.paymentMethod, p_notes: parsed.notes ?? null }
      break
    case 'closeSession':
      rpcName = 'command_close_session'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_session_id: parsed.sessionId, p_discount_amount: parsed.discountAmount, p_discount_reason: parsed.discountReason ?? null, p_payment_method: parsed.paymentMethod }
      break
    case 'openShift':
      rpcName = 'command_open_shift'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_opening_cash: parsed.openingCash }
      break
    case 'closeShift':
      rpcName = 'command_close_shift'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_shift_id: parsed.shiftId, p_pin: parsed.pin ?? null, p_closing_cash: parsed.closingCash, p_cash_taken: parsed.cashTaken, p_cash_left: parsed.cashLeft }
      break
    case 'updateExpense':
      rpcName = 'command_update_expense'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_expense_id: parsed.expenseId, p_amount: parsed.amount, p_name: parsed.name ?? null }
      break
    case 'queueDeviceCommand':
      rpcName = 'command_queue_device_command'
      rpcInput = { p_actor_id: actorId, p_branch_id: parsed.branchId, p_request_id: parsed.requestId, p_device_id: parsed.deviceId, p_type: parsed.type, p_payload: parsed.payload }
      break
  }
  const { data, error } = await admin.rpc(rpcName, rpcInput)
  if (error) {
    const code = error.message.includes('FORBIDDEN') ? 'FORBIDDEN' : 'COMMAND_REJECTED'
    return json({ code, message: error.message }, code === 'FORBIDDEN' ? 403 : 409, headers)
  }

  return json({ data, requestId: parsed.requestId }, 200, headers)
})
