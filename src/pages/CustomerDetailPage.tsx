import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Customer, CustomerAchievement, CustomerSubscription, Debt, Session } from '@/types'
import { ArrowRight, Clock, Wallet, Star, Trophy, Gamepad2, Loader2 } from 'lucide-react'
import CustomerRankBadge from '@/components/customers/CustomerRankBadge'
import CustomerAchievements from '@/components/customers/CustomerAchievements'
import CustomerSubscriptionCard from '@/components/customers/CustomerSubscriptionCard'
import { Link } from 'react-router'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [achievements, setAchievements] = useState<CustomerAchievement[]>([])
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (id) load(id) }, [id])

  const load = async (customerId: string) => {
    setLoading(true)
    const [{ data: c }, { data: ach }, { data: subs }, { data: d }, { data: sess }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single(),
      supabase.from('customer_achievements').select(`*,achievement:achievements(*)`).eq('customer_id', customerId),
      supabase.from('customer_subscriptions').select(`*,plan:subscription_plans(*)`).eq('customer_id', customerId).order('created_at', { ascending: false }),
      supabase.from('debts').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(10),
      supabase.from('sessions').select(`*,device:devices(*)`).eq('customer_id', customerId).not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(10),
    ])
    setCustomer(c); setAchievements(ach || []); setSubscriptions(subs || []); setDebts(d || []); setSessions(sess || [])
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--ps-blue-light)]" /></div>
  if (!customer) return <p className="text-center py-12 text-ps-muted">العميل غير موجود</p>

  const pendingDebts = debts.filter(d => d.status === 'pending' || d.status === 'partial')

  return (
    <div className="space-y-5 animate-fade-in">
      <Link to="/customers" className="text-sm text-ps-muted hover:text-ps-text flex items-center gap-1 mb-2"><ArrowRight size={14} />العودة للعملاء</Link>

      <div className="rounded-2xl p-5" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,rgba(0,87,255,0.2),rgba(155,109,255,0.2))', border: '1px solid rgba(0,87,255,0.3)', color: 'var(--ps-blue-light)' }}>{customer.name[0]}</div>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-xl font-bold">{customer.name}</h1><CustomerRankBadge rank={customer.rank || 'bronze'} /></div>
            {customer.phone && <p className="text-sm text-ps-muted font-mono" dir="ltr">{customer.phone}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--ps-surface)' }}>
            <Star size={16} className="mx-auto mb-1" style={{ color: 'var(--ps-gold)' }} />
            <p className="font-mono font-bold">{customer.points}</p>
            <p className="text-[10px] text-ps-muted">نقطة</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--ps-surface)' }}>
            <Wallet size={16} className="mx-auto mb-1" style={{ color: 'var(--ps-green)' }} />
            <p className="font-mono font-bold">{customer.total_spent?.toLocaleString()}</p>
            <p className="text-[10px] text-ps-muted">إجمالي الإنفاق</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--ps-surface)' }}>
            <Clock size={16} className="mx-auto mb-1" style={{ color: 'var(--ps-blue-light)' }} />
            <p className="font-mono font-bold">{customer.total_hours?.toFixed(1)}</p>
            <p className="text-[10px] text-ps-muted">ساعة لعب</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--ps-surface)' }}>
            <Trophy size={16} className="mx-auto mb-1" style={{ color: 'var(--ps-purple)' }} />
            <p className="font-mono font-bold">{customer.visit_count}</p>
            <p className="text-[10px] text-ps-muted">زيارة</p>
          </div>
        </div>
      </div>

      {pendingDebts.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,61,90,0.05)', border: '1px solid rgba(255,61,90,0.2)' }}>
          <h2 className="font-semibold text-sm mb-2" style={{ color: 'var(--ps-red)' }}>ديون مستحقة</h2>
          {pendingDebts.map(d => (
            <div key={d.id} className="flex justify-between text-sm"><span>{d.reason}</span><span className="font-mono">{(d.amount - d.amount_paid).toLocaleString()} ج</span></div>
          ))}
        </div>
      )}

      {subscriptions.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-ps-muted">الاشتراكات</h2>
          {subscriptions.map(s => <CustomerSubscriptionCard key={s.id} subscription={s} />)}
        </div>
      )}

      <CustomerAchievements achievements={achievements} />

      <div>
        <h2 className="font-semibold text-sm text-ps-muted mb-2">آخر الجلسات</h2>
        {sessions.length === 0 ? <p className="text-sm text-ps-muted">لا توجد جلسات</p> : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
                <Gamepad2 size={14} style={{ color: 'var(--ps-blue-light)' }} />
                <div className="flex-1"><p className="text-sm">{s.device?.name} · {s.mode === 'single' ? 'فردي' : 'زوجي'}</p></div>
                <p className="font-mono text-sm" style={{ color: 'var(--ps-green)' }}>{s.cost} ج</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
