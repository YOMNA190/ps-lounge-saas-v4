import { useState, useEffect } from 'react'
import { useSubscriptions } from '@/hooks/useSubscriptions'
import { supabase } from '@/lib/supabase'
import { Customer } from '@/types'
import { CreditCard, Plus, Search, Loader2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import CreateSubscriptionModal from '@/components/subscriptions/CreateSubscriptionModal'
import CustomerSubscriptionCard from '@/components/customers/CustomerSubscriptionCard'

export default function SubscriptionsPage() {
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const { subscriptions, plans, loading, refetch } = useSubscriptions(selectedCustomer?.id)

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('*').ilike('name', `%${customerSearch}%`).limit(5)
      setCustomers(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text flex items-center gap-2"><CreditCard size={22} />الاشتراكات</h1></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} />جديد</button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} />
        <input className="input pr-10" placeholder="بحث عن عميل..." value={selectedCustomer ? selectedCustomer.name : customerSearch} onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }} />
        {customers.length > 0 && !selectedCustomer && (
          <div className="absolute top-full mt-1 w-full rounded-xl overflow-hidden z-10 shadow-2xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            {customers.map(c => <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomers([]) }} className="w-full text-right px-4 py-2.5 text-sm hover:bg-[var(--ps-surface)] transition-colors">{c.name}</button>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {plans.map(p => (
          <div key={p.id} className="rounded-xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <p className="font-semibold">{p.name}</p>
            <p className="text-2xl font-bold font-mono my-2" style={{ color: 'var(--ps-gold)' }}>{p.price} ج</p>
            <p className="text-xs text-ps-muted flex items-center justify-center gap-1"><Clock size={10} />{p.total_hours} ساعة / {p.validity_days} يوم</p>
          </div>
        ))}
      </div>

      {loading ? <Loader2 size={20} className="animate-spin" /> : subscriptions.length > 0 ? (
        <div className="space-y-2">{subscriptions.map(s => <CustomerSubscriptionCard key={s.id} subscription={s} />)}</div>
      ) : <p className="text-center text-ps-muted py-8">لا توجد اشتراكات</p>}

      {showCreate && <CreateSubscriptionModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch() }} plans={plans} />}
    </div>
  )
}
