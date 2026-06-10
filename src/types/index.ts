// ============================================================
// PS Lounge Manager v4 — Complete TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'staff';
export type DeviceType = 'PS4' | 'PS5';
export type SessionMode = 'single' | 'multi';
export type PaymentMethod = 'cash' | 'vodafone_cash' | 'instapay' | 'debt' | 'subscription';
export type DebtStatus = 'pending' | 'partial' | 'paid' | 'waived';
export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'cancelled';
export type TournamentStatus = 'upcoming' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type CustomerRank = 'bronze' | 'silver' | 'gold' | 'champion';
export type AchievementConditionType = 'hours' | 'spent' | 'visits' | 'streak';
export type BranchPlan = 'trial' | 'basic' | 'pro';
export type CardStatus = 'available' | 'sold' | 'void';
export type CardPaymentMethod = 'vodafone_cash' | 'instapay' | 'cash';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// ── Core ──
export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  branch_id: string | null;
  shift_pin?: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  owner_id: string;
  address: string | null;
  phone: string | null;
  plan: BranchPlan;
  plan_expires_at: string | null;
  is_active: boolean;
  onboarding_done: boolean;
  currency: string;
  timezone: string;
  loyalty_limit: number;
  created_at: string;
}

export interface Device {
  id: number;
  name: string;
  type: DeviceType;
  is_active: boolean;
  price_single: number;
  price_multi: number;
  branch_id: string;
  created_at: string;
  active_session?: Session | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  points: number;
  rank?: CustomerRank;
  total_hours?: number;
  total_spent?: number;
  visit_count?: number;
  branch_id: string;
  created_at: string;
}

export interface Session {
  id: string;
  device_id: number;
  customer_id: string | null;
  mode: SessionMode;
  game_played: string | null;
  started_at: string;
  ended_at: string | null;
  cost: number | null;
  is_paid?: boolean;
  payment_method?: PaymentMethod;
  discount_amount?: number;
  discount_reason?: string | null;
  staff_id: string | null;
  notes: string | null;
  branch_id: string;
  created_at: string;
  device?: Device;
  customer?: Customer;
  staff?: Profile;
}

// ── Inventory / POS ──
export interface InventoryCategory {
  id: number;
  name: string;
  icon: string;
  branch_id: string;
  created_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  barcode: string | null;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  min_stock_qty: number;
  unit: string;
  is_active: boolean;
  branch_id: string;
  created_at: string;
  updated_at: string;
  category?: InventoryCategory;
}

export interface SaleItem {
  id?: number;
  sale_id?: string;
  product_id: number;
  qty: number;
  unit_price: number;
  unit_cost: number;
  subtotal?: number;
  product?: Product;
}

export interface Sale {
  id: string;
  session_id: string | null;
  customer_id: string | null;
  staff_id: string | null;
  total: number;
  is_paid?: boolean;
  notes: string | null;
  branch_id: string;
  created_at: string;
  items?: SaleItem[];
  customer?: Customer;
}

// ── Shifts ──
export interface Shift {
  id: string;
  staff_id: string;
  started_at: string;
  ended_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  cash_taken: number;
  cash_left: number;
  sessions_revenue: number;
  sales_revenue: number;
  total_revenue: number;
  notes: string | null;
  branch_id: string;
  created_at: string;
  staff?: Profile;
}

// ── Packages / Reservations ──
export interface Package {
  id: number;
  name: string;
  description: string | null;
  device_type: string | null;
  mode: 'single' | 'multi' | 'both';
  duration_mins: number;
  price: number;
  is_active: boolean;
  valid_days: string[];
  branch_id: string;
  created_at: string;
}

export interface Reservation {
  id: string;
  device_id: number;
  customer_id: string | null;
  package_id: number | null;
  reserved_at: string;
  duration_mins: number;
  mode: SessionMode;
  status: ReservationStatus;
  notes: string | null;
  branch_id: string;
  created_at: string;
  device?: Device;
  customer?: Customer;
  package?: Package;
}

// ── Expenses / Alerts ──
export interface Expense {
  id: number;
  branch_id: string;
  name: string;
  amount: number;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: number;
  type: 'low_stock' | 'long_session' | 'shift_reminder';
  title: string;
  message: string;
  entity_id: string | null;
  is_read: boolean;
  branch_id: string;
  created_at: string;
}

// ── Internet Cards ──
export interface CardType {
  id: number;
  name: string;
  provider: string;
  data_amount: string;
  validity_days: number;
  cost_price: number;
  sell_price: number;
  low_stock_alert: number;
  is_active: boolean;
  branch_id: string;
  created_at: string;
}
export interface CardInventorySummary extends CardType {
  margin: number;
  available_count: number;
  sold_count: number;
  void_count: number;
  is_low_stock: boolean;
}


export interface Card {
  id: string;
  type_id: number;
  serial_code: string | null;
  status: CardStatus;
  sold_at: string | null;
  sold_to: string | null;
  sold_by: string | null;
  sale_price: number | null;
  payment_method: CardPaymentMethod | null;
  payment_ref: string | null;
  notes: string | null;
  branch_id: string;
  created_at: string;
  card_type?: CardType;
  customer?: Customer;
}

// ── Analytics ──
export interface DailyDeviceRevenue {
  device_id: number;
  device_name: string;
  device_type: DeviceType;
  day: string;
  session_count: number;
  total_revenue: number;
  avg_session_cost: number;
  total_hours: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  phone: string | null;
  points: number;
  session_count: number;
  total_hours: number;
  total_spent: number;
  month: string;
}

export interface TopGame {
  game_played: string;
  play_count: number;
  total_hours: number;
}

export interface DashboardSummary {
  gross_revenue: number;
  total_expenses: number;
  net_profit: number;
  active_sessions: number;
  total_sessions_today: number;
  revenue_today: number;
}

export interface CustomerMonthlySpending {
  id: string;
  name: string;
  phone: string | null;
  points: number;
  monthly_spend_limit: number;
  reward_earned_months: string[];
  current_month: string;
  sessions_spend: number;
  products_spend: number;
  total_spend: number;
  limit_remaining: number;
  limit_exceeded: boolean;
  reward_claimed_this_month: boolean;
  total_hours_this_month: number;
}

// ── PHASE 1: Audit Log ──
export interface AuditLogEntry {
  id: string;
  branch_id: string;
  staff_id: string | null;
  staff_name?: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  created_at: string;
}

export type AuditAction =
  | 'session_start' | 'session_stop' | 'price_change' | 'manual_override'
  | 'refund' | 'discount_applied' | 'debt_created' | 'subscription_created'
  | 'inventory_restock' | 'expense_update' | 'order_added_to_session'
  | 'achievement_unlocked' | 'debt_payment' | 'debt_waived'
  | 'bracket_generated';

// ── PHASE 2: Unified Bill ──
export interface SessionBill {
  session_id: string;
  device_name: string;
  customer_name: string | null;
  started_at: string;
  ended_at: string | null;
  mode: SessionMode;
  session_cost: number;
  orders: BillOrderItem[];
  orders_total: number;
  discount: number;
  discount_reason: string | null;
  grand_total: number;
  payment_method: PaymentMethod;
  is_paid: boolean;
}

export interface BillOrderItem {
  product_name: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

// ── PHASE 3: Loyalty ──
export interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  condition_type: AchievementConditionType;
  condition_value: number;
  reward_points: number;
  created_at: string;
}

export interface CustomerAchievement {
  id: string;
  customer_id: string;
  achievement_id: number;
  achievement?: Achievement;
  unlocked_at: string;
}

// ── PHASE 4: Debts ──
export interface Debt {
  id: string;
  customer_id: string;
  customer?: Customer;
  session_id: string | null;
  sale_id: string | null;
  amount: number;
  reason: string;
  status: DebtStatus;
  amount_paid: number;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  branch_id: string;
  created_at: string;
}

export interface CustomerDebtSummary {
  customer_id: string;
  name: string;
  phone: string | null;
  pending_debts: number;
  total_pending: number;
  total_debt_history: number;
  total_paid: number;
}

// ── PHASE 5: Happy Hour ──
export interface HappyHour {
  id: number;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  discount_percent: number;
  device_type: 'PS4' | 'PS5' | 'all';
  is_active: boolean;
  branch_id: string;
  created_at: string;
}

export interface HappyHourCheck {
  is_happy_hour: boolean;
  name?: string;
  discount_percent?: number;
  end_time?: string;
  message?: string;
}

// ── PHASE 6: Waitlist ──
export interface WaitlistEntry {
  id: string;
  customer_id: string | null;
  customer?: Customer;
  customer_name: string;
  customer_phone: string | null;
  device_type: 'PS4' | 'PS5' | 'any';
  mode: SessionMode;
  preferred_time: string | null;
  estimated_wait_minutes: number;
  status: WaitlistStatus;
  notified_at: string | null;
  branch_id: string;
  created_at: string;
}

// ── PHASE 7: Subscriptions ──
export interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  total_hours: number;
  price: number;
  validity_days: number;
  is_active: boolean;
  branch_id: string | null;
  created_at: string;
}

export interface CustomerSubscription {
  id: string;
  customer_id: string;
  plan_id: number | null;
  plan?: SubscriptionPlan;
  custom_name: string | null;
  total_hours: number;
  hours_used: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  created_by: string | null;
  branch_id: string;
  created_at: string;
}

// ── PHASE 8: Tournaments ──
export interface Tournament {
  id: string;
  name: string;
  game: string;
  start_date: string;
  entry_fee: number;
  prize_pool: number;
  max_players: number;
  current_players: number;
  status: TournamentStatus;
  format: TournamentFormat;
  branch_id: string;
  created_by: string | null;
  created_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  customer_id: string | null;
  customer?: Customer;
  player_name: string;
  player_phone: string | null;
  seed: number | null;
  is_paid: boolean;
  registered_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player1?: TournamentParticipant;
  player2_id: string | null;
  player2?: TournamentParticipant;
  winner_id: string | null;
  winner?: TournamentParticipant;
  player1_score: number | null;
  player2_score: number | null;
  status: 'pending' | 'in_progress' | 'completed';
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

// ── Constants ──
export const POPULAR_GAMES = [
  'FIFA 26', 'FC 25', 'eFootball / PES', 'Call of Duty',
  'GTA V', 'Red Dead Redemption 2', 'Mortal Kombat 1',
  'WWE 2K24', 'Tekken 8', 'Fortnite', 'Apex Legends',
  'God of War', 'Spider-Man 2', 'NBA 2K25', 'أخرى',
] as const;

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: '💵 كاش',
  vodafone_cash: '📱 فودافون كاش',
  instapay: '💳 إنستاباي',
  debt: '📝 دين',
  subscription: '🎫 اشتراك',
};

export const RANK_CONFIG: Record<CustomerRank, { label: string; color: string; bg: string; icon: string }> = {
  bronze: { label: 'برونزي', color: '#cd7f32', bg: 'rgba(205,127,50,0.1)', icon: '🥉' },
  silver: { label: 'فضي', color: '#c0c0c0', bg: 'rgba(192,192,192,0.1)', icon: '🥈' },
  gold: { label: 'ذهبي', color: '#ffc843', bg: 'rgba(255,200,67,0.1)', icon: '🥇' },
  champion: { label: 'بطل', color: '#9b6dff', bg: 'rgba(155,109,255,0.1)', icon: '👑' },
};

export const DAYS_OF_WEEK = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;

export const CARD_PROVIDERS = ['WE', 'فودافون', 'اتصالات', 'أورانج'] as const;

export const FIXED_EXPENSES = [
  { name: 'إيجار المحل', amount: 21800 },
  { name: 'بضاعة / مستلزمات', amount: 17000 },
  { name: 'صيانة', amount: 2200 },
  { name: 'إنترنت', amount: 1500 },
  { name: 'جمعية', amount: 4000 },
  { name: 'مرتبات', amount: 3500 },
  { name: 'كهرباء', amount: 4000 },
] as const;

export const TOTAL_FIXED_EXPENSES = FIXED_EXPENSES.reduce((sum, e) => sum + e.amount, 0);

export interface StartSessionPayload {
  device_id: number;
  mode: SessionMode;
  game_played?: string;
  customer_id?: string;
  notes?: string;
}
