import { useState, useEffect } from 'react'
import { SubscriptionPlan, Customer } from '@/types'
import { createSubscription } from '@/lib/subscriptions'
import { supabase } from '@/lib/supabase'
import { CreditCard, X, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props { onClose: () => void; onCreated: () => void; plans: SubscriptionPlan[] }

export default function CreateSubscriptionModal({ onClose, onCreated, plans }: Props) {
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<number | ''>('')
  const [customHours, setCustomHours] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customName, setCustomName] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('*').ilike('name', `%${customerSearch}%`).limit(5)
      setCustomers(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  const handleCreate = async () => {
    if (!selectedCustomer) { toast.error('اختر عميل'); return }
    setLoading(true)
    try {
      await createSubscription(
        selectedCustomer.id,
        isCustom ? undefined : (selectedPlan as number) || undefined,
        isCustom ? Number(customHours) || undefined : undefined,
        isCustom ? Number(customPrice) || undefined : undefined,
        isCustom ? customName || undefined : undefined
      )
      toast.success('تم إنشاء الاشتراك')
      onCreated()
    } catch { toast.error('فشل الإنشاء'); setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', maxHeight: '90dvh', overflow: 'auto' }}>
        <div className="flex items-center justify-between"><h2 className="font-bold flex items-center gap-2"><CreditCard size={16} />اشتراك جديد</h2><button onClick={onClose} className="btn-ghost p-1"><X size={17} /></button></div>

        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} />
          <input className="input pr-9 text-sm" placeholder="بحث عن عميل..." value={selectedCustomer ? selectedCustomer.name : customerSearch} onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }} />
          {customers.length > 0 && !selectedCustomer && (
            <div className="absolute top-full mt-1 w-full rounded-xl overflow-hidden z-10 shadow-2xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              {customers.map(c => <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomers([]) }} className="w-full text-right px-4 py-2.5 text-sm hover:bg-[var(--ps-surface)]">{c.name}</button>)}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setIsCustom(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${!isCustom ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={!isCustom ? { background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.2)' } : {}}>باقة</button>
          <button onClick={() => setIsCustom(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${isCustom ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={isCustom ? { background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.2)' } : {}}>مخصص</button>
        </div>

        {!isCustom ? (
          <div className="space-y-2">
            {plans.map(p => (
              <button key={p.id} onClick={() => setSelectedPlan(p.id)} className="w-full text-right p-3 rounded-xl transition-all" style={selectedPlan === p.id ? { background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.3)' } : { background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
                <p className="font-medium text-sm">{p.name}</p><p className="text-xs text-ps-muted">{p.total_hours} ساعة · {p.price} ج</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <input className="input" placeholder="الاسم" value={customName} onChange={e => setCustomName(e.target.value)} />
            <input className="input" type="number" placeholder="عدد الساعات" value={customHours} onChange={e => setCustomHours(e.target.value)} />
            <input className="input" type="number" placeholder="السعر" value={customPrice} onChange={e => setCustomPrice(e.target.value)} />
          </div>
        )}

        <div className="flex gap-3"><button onClick={onClose} className="btn-ghost flex-1">إلغاء</button><button onClick={handleCreate} disabled={loading} className="btn-primary flex-1">{loading ? <Loader2 size={16} className="animate-spin" /> : 'إنشاء'}</button></div>
      </div>
    </div>
  )
}
