import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense, FIXED_EXPENSES, TOTAL_FIXED_EXPENSES, DashboardSummary } from '@/types'
import { getDashboardSummary } from '@/lib/analytics'
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary]   = useState<DashboardSummary | null>(null)
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    setLoading(true)
    const [expRes, sum] = await Promise.all([
      supabase.from('expenses').select('*').order('id'),
      getDashboardSummary(),
    ])
    setExpenses(expRes.data || [])
    setSummary(sum)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const gross   = summary?.gross_revenue   ?? 0
  const net     = summary?.net_profit      ?? 0
  const isProfit = net >= 0
  const profitPct = gross > 0 ? Math.abs(Math.round((net / gross) * 100)) : 0
  const expensesPct = gross > 0 ? Math.min(Math.round((TOTAL_FIXED_EXPENSES / gross) * 100), 100) : 0

  const displayExpenses = expenses.length > 0 ? expenses : FIXED_EXPENSES

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ps-text">المصاريف الشهرية</h1>
          <p className="text-ps-muted text-sm mt-0.5">المصاريف الثابتة وصافي الربح</p>
        </div>
        <button onClick={load} className="btn-ghost p-2.5" style={{ border: '1px solid var(--ps-border)' }}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* P&L big cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Gross revenue */}
        <div className="stat-card" style={{ border: '1px solid rgba(0,87,255,0.2)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.2)' }}
            >
              <ArrowUpRight size={18} style={{ color: 'var(--ps-blue-light)' }} />
            </div>
            <span className="text-xs text-ps-muted font-mono uppercase tracking-wider">إيرادات الشهر</span>
          </div>
          <p className="text-3xl font-bold font-mono" style={{ color: 'var(--ps-blue-light)' }}>
            {gross.toLocaleString()}
          </p>
          <p className="text-ps-muted text-sm mt-1">جنيه مصري</p>
          <div className="absolute bottom-0 inset-x-0 h-px"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(0,87,255,0.4),transparent)' }}
          />
        </div>

        {/* Expenses */}
        <div className="stat-card" style={{ border: '1px solid rgba(255,61,90,0.2)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,61,90,0.08)', border: '1px solid rgba(255,61,90,0.2)' }}
            >
              <ArrowDownRight size={18} style={{ color: 'var(--ps-red)' }} />
            </div>
            <span className="text-xs text-ps-muted font-mono uppercase tracking-wider">إجمالي المصاريف</span>
          </div>
          <p className="text-3xl font-bold font-mono" style={{ color: 'var(--ps-red)' }}>
            {TOTAL_FIXED_EXPENSES.toLocaleString()}
          </p>
          <p className="text-ps-muted text-sm mt-1">جنيه مصري</p>
          <div className="absolute bottom-0 inset-x-0 h-px"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(255,61,90,0.4),transparent)' }}
          />
        </div>

        {/* Net profit */}
        <div className="stat-card" style={{
          border: `1px solid ${isProfit ? 'rgba(0,229,160,0.2)' : 'rgba(255,61,90,0.2)'}`,
        }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: isProfit ? 'rgba(0,229,160,0.08)' : 'rgba(255,61,90,0.08)',
                border: `1px solid ${isProfit ? 'rgba(0,229,160,0.2)' : 'rgba(255,61,90,0.2)'}`,
              }}
            >
              {isProfit
                ? <TrendingUp size={18} style={{ color: 'var(--ps-green)' }} />
                : <TrendingDown size={18} style={{ color: 'var(--ps-red)' }} />
              }
            </div>
            <span className="text-xs text-ps-muted font-mono uppercase tracking-wider">صافي الربح</span>
          </div>
          <p className="text-3xl font-bold font-mono" style={{ color: isProfit ? 'var(--ps-green)' : 'var(--ps-red)' }}>
            {isProfit ? '+' : '-'}{Math.abs(net).toLocaleString()}
          </p>
          <p className="text-ps-muted text-sm mt-1">
            {isProfit ? `▲ ${profitPct}% من الإيرادات` : `▼ خسارة ${profitPct}%`}
          </p>
          <div className="absolute bottom-0 inset-x-0 h-px"
            style={{ background: `linear-gradient(90deg,transparent,${isProfit ? 'rgba(0,229,160,0.4)' : 'rgba(255,61,90,0.4)'},transparent)` }}
          />
        </div>
      </div>

      {/* Revenue breakdown bar */}
      {gross > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="flex justify-between text-xs text-ps-muted mb-3 font-mono">
            <span>توزيع الإيرادات</span>
            <span>{gross.toLocaleString()} جنيه</span>
          </div>
          <div className="h-5 rounded-full overflow-hidden flex gap-0.5"
            style={{ background: 'var(--ps-surface)' }}
          >
            <div className="h-full rounded-r-full transition-all duration-1000"
              style={{ width: `${expensesPct}%`, background: 'linear-gradient(90deg, var(--ps-red), rgba(255,61,90,0.7))' }}
            />
            {isProfit && (
              <div className="h-full rounded-l-full transition-all duration-1000"
                style={{ width: `${profitPct}%`, background: 'linear-gradient(90deg, rgba(0,229,160,0.7), var(--ps-green))' }}
              />
            )}
          </div>
          <div className="flex gap-5 mt-3 text-xs">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--ps-red)' }} />
              <span className="text-ps-muted">مصاريف ({expensesPct}%)</span>
            </span>
            {isProfit && (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--ps-green)' }} />
                <span className="text-ps-muted">ربح صافي ({profitPct}%)</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expenses table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--ps-border)' }}>
          <h2 className="font-semibold text-sm text-ps-text">تفاصيل المصاريف الثابتة</h2>
          <span className="text-xs text-ps-muted font-mono">شهرياً</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><span className="spinner" style={{ width: 24, height: 24 }} /></div>
        ) : (
          <>
            <div className="divide-y" style={{ divideColor: 'var(--ps-border)' }}>
              {displayExpenses.map((e, i) => {
                const pct = Math.round((Number(e.amount) / TOTAL_FIXED_EXPENSES) * 100)
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 transition-colors"
                    style={{ borderColor: 'var(--ps-border)' }}
                    onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = 'var(--ps-surface)' }}
                    onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm text-ps-text">{e.name}</span>
                        <span className="font-mono font-semibold text-sm text-ps-text">
                          {Number(e.amount).toLocaleString()} <span className="text-ps-muted text-xs">جنيه</span>
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--ps-surface)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: `hsl(${220 + i * 25}, 80%, 60%)` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-ps-muted font-mono w-8 text-left">{pct}%</span>
                  </div>
                )
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-5 py-4 border-t"
              style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,0.2)' }}
            >
              <span className="font-bold text-ps-text">الإجمالي الشهري</span>
              <span className="font-mono font-bold text-xl" style={{ color: 'var(--ps-red)' }}>
                {TOTAL_FIXED_EXPENSES.toLocaleString()} <span className="text-sm opacity-70">جنيه</span>
              </span>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-ps-muted text-xs opacity-50 font-mono">
        * المصاريف الثابتة تُخصم تلقائياً من الإيرادات الشهرية
      </p>
    </div>
  )
}
