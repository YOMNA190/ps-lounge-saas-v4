import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Customer } from '@/types'
import { ListOrdered, X, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useBranch } from '@/lib/branch-context'

interface Props { onClose: () => void; onAdded: () => void }

export default function AddToWaitlistModal({ onClose, onAdded }: Props) {
  const { branchId } = useBranch()
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selected, setSelected] = useState<Customer | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [deviceType, setDeviceType] = useState<'PS4' | 'PS5' | 'any'>('any')
  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setCustomers([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('*').ilike('name', `%${search}%`).limit(5)
      setCustomers(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleAdd = async () => {
    if (!branchId) return
    if (!name.trim() && !selected) { toast.error('أدخل اسم'); return }
    setLoading(true)
    try {
      await supabase.from('waitlist').insert({
        customer_id: selected?.id || null,
        customer_name: selected?.name || name,
        customer_phone: selected?.phone || phone || null,
        device_type: deviceType,
        mode,
        branch_id: branchId,
      })
      toast.success('تم الإضافة')
      onAdded()
    } catch { toast.error('فشل الإضافة'); setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <div className="flex items-center justify-between"><h2 className="font-bold flex items-center gap-2"><ListOrdered size={16} />إضافة للانتظار</h2><button onClick={onClose} className="btn-ghost p-1"><X size={17} /></button></div>
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} />
          <input className="input pr-9 text-sm" placeholder="بحث عن عميل..." value={selected ? selected.name : search} onChange={e => { setSearch(e.target.value); setSelected(null) }} />
          {customers.length > 0 && !selected && (
            <div className="absolute top-full mt-1 w-full rounded-xl overflow-hidden z-10" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              {customers.map(c => <button key={c.id} onClick={() => { setSelected(c); setCustomers([]) }} className="w-full text-right px-4 py-2.5 text-sm hover:bg-[var(--ps-surface)]">{c.name}</button>)}
            </div>
          )}
        </div>
        {!selected && <input className="input text-sm" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} />}
        <div className="flex gap-2">
          {(['any', 'PS5', 'PS4'] as const).map(t => <button key={t} onClick={() => setDeviceType(t)} className={`flex-1 py-2 rounded-lg text-sm ${deviceType === t ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={deviceType === t ? { background: 'rgba(0,87,255,0.1)' } : {}}>{t === 'any' ? 'أي' : t}</button>)}
        </div>
        <div className="flex gap-2">
          {(['single', 'multi'] as const).map(m => <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg text-sm ${mode === m ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={mode === m ? { background: 'rgba(0,87,255,0.1)' } : {}}>{m === 'single' ? 'فردي' : 'زوجي'}</button>)}
        </div>
        <div className="flex gap-3"><button onClick={onClose} className="btn-ghost flex-1">إلغاء</button><button onClick={handleAdd} disabled={loading} className="btn-primary flex-1">{loading ? <Loader2 size={16} className="animate-spin" /> : 'إضافة'}</button></div>
      </div>
    </div>
  )
}
