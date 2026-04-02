import { supabase } from '@/lib/supabase'
import { DailyDeviceRevenue, TopCustomer, TopGame, DashboardSummary, TOTAL_FIXED_EXPENSES } from '@/types'

export async function getDeviceRevenue(days = 7): Promise<DailyDeviceRevenue[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('daily_device_revenue')
    .select('*')
    .gte('day', since.toISOString().split('T')[0])
    .order('day', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getTopCustomers(limit = 3): Promise<TopCustomer[]> {
  const { data, error } = await supabase
    .from('top_customers_monthly')
    .select('*')
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getTopGames(limit = 5): Promise<TopGame[]> {
  const { data, error } = await supabase
    .from('top_games_monthly')
    .select('*')
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Today's completed sessions revenue
  const { data: todayData } = await supabase
    .from('sessions')
    .select('cost')
    .gte('ended_at', today.toISOString())
    .not('cost', 'is', null)

  // Monthly revenue (for net profit calc)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const { data: monthData } = await supabase
    .from('sessions')
    .select('cost')
    .gte('ended_at', monthStart.toISOString())
    .not('cost', 'is', null)

  // Active sessions count
  const { count: activeCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .is('ended_at', null)

  const revenueToday   = (todayData || []).reduce((s, r) => s + (r.cost || 0), 0)
  const grossRevenue   = (monthData || []).reduce((s, r) => s + (r.cost || 0), 0)
  const netProfit      = grossRevenue - TOTAL_FIXED_EXPENSES

  return {
    gross_revenue:        Math.round(grossRevenue * 100) / 100,
    total_expenses:       TOTAL_FIXED_EXPENSES,
    net_profit:           Math.round(netProfit * 100) / 100,
    active_sessions:      activeCount || 0,
    total_sessions_today: todayData?.length || 0,
    revenue_today:        Math.round(revenueToday * 100) / 100,
  }
}
