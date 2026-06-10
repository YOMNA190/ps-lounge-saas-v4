import { supabase } from '@/lib/supabase'
import { DailyDeviceRevenue, TopCustomer, TopGame, DashboardSummary } from '@/types'

export async function getDeviceRevenue(days = 7): Promise<DailyDeviceRevenue[]> {
  const { data, error } = await supabase.from('daily_device_revenue').select('*').gte('day', new Date(Date.now() - days * 86400000).toISOString().split('T')[0])
  if (error) throw error
  return data || []
}

export async function getTopCustomers(limit = 10): Promise<TopCustomer[]> {
  const { data, error } = await supabase.from('top_customers_monthly').select('*').limit(limit)
  if (error) throw error
  return data || []
}

export async function getTopGames(limit = 10): Promise<TopGame[]> {
  const { data, error } = await supabase.from('top_games_monthly').select('*').limit(limit)
  if (error) throw error
  return data || []
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const { data: sessionsData } = await supabase.from('sessions').select('cost').gte('started_at', monthStart.toISOString()).not('ended_at', 'is', null)
  const { data: todaySessions } = await supabase.from('sessions').select('cost').gte('started_at', today.toISOString()).not('ended_at', 'is', null)
  const { data: activeSessions } = await supabase.from('sessions').select('id').is('ended_at', null)
  const { data: expensesData } = await supabase.from('expenses').select('amount').eq('is_active', true)

  const grossRevenue = sessionsData?.reduce((s, r) => s + (r.cost || 0), 0) || 0
  const totalExpenses = expensesData?.reduce((s, r) => s + (r.amount || 0), 0) || 0
  const revenueToday = todaySessions?.reduce((s, r) => s + (r.cost || 0), 0) || 0

  return {
    gross_revenue: grossRevenue,
    total_expenses: totalExpenses,
    net_profit: grossRevenue - totalExpenses,
    active_sessions: activeSessions?.length || 0,
    total_sessions_today: todaySessions?.length || 0,
    revenue_today: revenueToday,
  }
}
