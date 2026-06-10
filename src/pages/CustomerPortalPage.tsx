import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Customer, CustomerAchievement, CustomerSubscription } from '@/types'
import { Star, Trophy, Clock, Wallet, Gamepad2, Loader2 } from 'lucide-react'
import CustomerRankBadge from '@/components/customers/CustomerRankBadge'

export default function CustomerPortalPage() {
  const { customerPhone } = useParams<{ customerPhone: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [achievements, setAchievements] = useState<CustomerAchievement[]>([])
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerPhone) return
    load(customerPhone)
  }, [customerPhone])

  const load = async (phone: string) => {
    setLoading(true)
    const { data: c } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle()
    if (c) {
      const [{ data: ach }, { data: subs }] = await Promise.all([
        supabase.from('customer_achievements').select(`*,achievement:achievements(*)`).eq('customer_id', c.id),
        supabase.from('customer_subscriptions').select(`*,plan:subscription_plans(*)`).eq('customer_id', c.id).eq('is_active', true),
      ])
      setCustomer(c); setAchievements(ach || []); setSubscriptions(subs || [])
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={24} className="animate-spin text-[var(--ps-blue-light)]" /></div>
  if (!customer) return <div className="min-h-screen flex items-center justify-center text-ps-muted">العميل غير موجود</div>

  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--ps-darker)' }}>
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-3xl font-bold mb-3" style={{ background: 'linear-gradient(135deg,rgba(0,87,255,0.2),rgba(155,109,255,0.2))', border: '1px solid rgba(0,87,255,0.3)', color: 'var(--ps-blue-light)' }}>{customer.name[0]}</div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <CustomerRankBadge rank={customer.rank || 'bronze'} size="lg" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <Star size={20} className="mx-auto mb-1" style={{ color: 'var(--ps-gold)' }} />
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--ps-gold)' }}>{customer.points}</p>
            <p className="text-xs text-ps-muted">نقطة</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <Wallet size={20} className="mx-auto mb-1" style={{ color: 'var(--ps-green)' }} />
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--ps-green)' }}>{customer.total_spent?.toLocaleString()}</p>
            <p className="text-xs text-ps-muted">إجمالي الإنفاق</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <Clock size={20} className="mx-auto mb-1" style={{ color: 'var(--ps-blue-light)' }} />
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--ps-blue-light)' }}>{customer.total_hours?.toFixed(0)}</p>
            <p className="text-xs text-ps-muted">ساعة لعب</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <Gamepad2 size={20} className="mx-auto mb-1" style={{ color: 'var(--ps-purple)' }} />
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--ps-purple)' }}>{customer.visit_count}</p>
            <p className="text-xs text-ps-muted">زيارة</p>
          </div>
        </div>

        {achievements.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Trophy size={16} style={{ color: 'var(--ps-gold)' }} />الإنجازات</h2>
            <div className="flex flex-wrap gap-2">
              {achievements.map(a => (
                <div key={a.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                  <span>{a.achievement?.icon}</span><span>{a.achievement?.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {subscriptions.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <h2 className="font-semibold mb-3">الاشتراكات النشطة</h2>
            {subscriptions.map(s => (
              <div key={s.id} className="mb-2">
                <p className="text-sm">{s.custom_name || s.plan?.name} · {s.hours_used}/{s.total_hours} ساعة</p>
                <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--ps-surface)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(s.hours_used / s.total_hours) * 100}%`, background: 'var(--ps-blue)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
