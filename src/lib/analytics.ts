import { supabase } from '@/lib/supabase'
import { DailyDeviceRevenue, TopCustomer, TopGame, DashboardSummary } from '@/types'

export async function getDeviceRevenue(days = 7): Promise<DailyDeviceRevenue[]> {
  const { data: profile } = await supabase.from('profiles').select('branch_id').single();
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('daily_device_revenue')
    .select('*')
    .eq('branch_id', profile?.branch_id)
    .gte('day', since.toISOString().split('T')[0])
    .order('day', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTopCustomers(limit = 3): Promise<TopCustomer[]> {
  const { data: profile } = await supabase.from('profiles').select('branch_id').single();
  const { data, error } = await supabase
    .from('top_customers_monthly')
    .select('*')
    .eq('branch_id', profile?.branch_id)
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getTopGames(limit = 5): Promise<TopGame[]> {
  const { data: profile } = await supabase.from('profiles').select('branch_id').single();
  const { data, error } = await supabase
    .from('top_games_monthly')
    .select('*')
    .eq('branch_id', profile?.branch_id)
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  // Get current user's branch_id
  const { data: profile } = await supabase.from('profiles').select('branch_id').single();
  const branchId = profile?.branch_id;

  // Run all queries in parallel
  const [todayData, monthData, activeCount, expensesData] = await Promise.all([
    // Today revenue
    supabase.from('sessions').select('cost')
      .eq('branch_id', branchId)
      .gte('ended_at', today.toISOString()).not('cost', 'is', null),
    // Monthly revenue
    supabase.from('sessions').select('cost')
      .eq('branch_id', branchId)
      .gte('ended_at', monthStart.toISOString()).not('cost', 'is', null),
    // Active sessions
    supabase.from('sessions').select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .is('ended_at', null),
    // ✅ Branch expenses from DB (not hardcoded)
    supabase.from('expenses').select('amount')
      .eq('branch_id', branchId)
      .eq('is_active', true),
  ])

  const revenueToday  = (todayData.data  || []).reduce((s, r) => s + (r.cost   || 0), 0)
  const grossRevenue  = (monthData.data  || []).reduce((s, r) => s + (r.cost   || 0), 0)
  const totalExpenses = (expensesData.data || []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const netProfit     = grossRevenue - totalExpenses

  return {
    gross_revenue:        Math.round(grossRevenue  * 100) / 100,
    total_expenses:       Math.round(totalExpenses * 100) / 100,
    net_profit:           Math.round(netProfit     * 100) / 100,
    active_sessions:      activeCount.count || 0,
    total_sessions_today: todayData.data?.length || 0,
    revenue_today:        Math.round(revenueToday  * 100) / 100,
  }
}
