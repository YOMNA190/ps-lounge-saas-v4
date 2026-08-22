import { useState, useEffect } from 'react'
import { getDeviceRevenue, getTopCustomers, getTopGames } from '@/lib/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart3, Trophy, Gamepad2, Clock, Loader2 } from 'lucide-react'

const COLORS = ['#0057ff','#9b6dff','#00e5a0','#ffc843','#ff3d5a','#00c8e0','#3d8bff','#c084fc','#34d399','#fb923c']

export default function AnalyticsPage() {
  const [devRevenue, setDevRevenue] = useState<{ name: string; revenue: number; sessions: number }[]>([])
  const [topCustomers, setTopCustomers] = useState<{ id: string; name: string; total_hours: number; session_count: number; total_spent: number }[]>([])
  const [topGames, setTopGames] = useState<{ game_played: string; play_count: number }[]>([])
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getDeviceRevenue(days), getTopCustomers(10), getTopGames(10)])
      .then(([dr, tc, tg]) => {
        const summary: Record<string, { name: string; revenue: number; sessions: number }> = {}
        dr.forEach(r => {
          if (!summary[r.device_name]) summary[r.device_name] = { name: r.device_name, revenue: 0, sessions: 0 }
          summary[r.device_name].revenue += Number(r.total_revenue)
          summary[r.device_name].sessions += Number(r.session_count)
        })
        setDevRevenue(Object.values(summary).sort((a, b) => b.revenue - a.revenue))
        setTopCustomers(tc); setTopGames(tg)
      })
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--ps-blue-light)]" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-ps-text">التحليلات</h1><p className="text-ps-muted text-sm">تقارير الأداء</p></div>
        <div className="flex gap-1.5">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all ${days === d ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={days === d ? { background: 'rgba(0,87,255,0.12)', border: '1px solid rgba(0,87,255,0.3)' } : { background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>{d}ي</button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <div className="flex items-center gap-2 mb-4"><BarChart3 size={16} style={{ color: 'var(--ps-blue-light)' }} /><h2 className="font-semibold text-sm">إيرادات الأجهزة</h2></div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={devRevenue}><CartesianGrid strokeDasharray="3 3" stroke="#1a1a30" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#52527a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#52527a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #24244a' }} />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>{devRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="flex items-center gap-2 mb-3"><Trophy size={15} style={{ color: 'var(--ps-gold)' }} /><h2 className="font-semibold text-sm">أكثر العملاء</h2></div>
          {topCustomers.slice(0, 5).map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--ps-surface)' }}>
              <span className="font-mono text-xs w-5 text-center" style={{ color: COLORS[i] }}>{i + 1}</span>
              <div className="flex-1 min-w-0"><p className="text-sm truncate">{c.name}</p><p className="text-[10px] text-ps-muted flex items-center gap-1"><Clock size={8} />{c.total_hours}س · {c.session_count} جلسة</p></div>
              <span className="font-mono text-sm" style={{ color: 'var(--ps-gold)' }}>{c.total_spent}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="flex items-center gap-2 mb-3"><Gamepad2 size={15} style={{ color: 'var(--ps-green)' }} /><h2 className="font-semibold text-sm">أكثر الألعاب</h2></div>
          {topGames.slice(0, 6).map((g, i) => (
            <div key={g.game_played} className="mb-2">
              <div className="flex justify-between text-sm mb-1"><span>{g.game_played}</span><span className="text-ps-muted font-mono text-xs">{g.play_count}×</span></div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ps-surface)' }}><div className="h-full rounded-full" style={{ width: `${Math.min((g.play_count / (topGames[0]?.play_count || 1)) * 100, 100)}%`, background: COLORS[i % COLORS.length] }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
