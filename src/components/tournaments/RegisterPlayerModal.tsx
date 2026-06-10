import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Customer } from '@/types'
import { Users, X, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props { tournamentId: string; onClose: () => void; onRegistered: () => void }

export default function RegisterPlayerModal({ tournamentId, onClose, onRegistered }: Props) {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selected, setSelected] = useState<Customer | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [isManual, setIsManual] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setCustomers([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('customers').select('*').ilike('name', `%${search}%`).limit(5)
      setCustomers(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleRegister = async () => {
    setLoading(true)
    try {
      await supabase.from('tournament_participants').insert({
        tournament_id: tournamentId,
        customer_id: selected?.id || null,
        player_name: selected?.name || manualName,
        player_phone: selected?.phone || manualPhone || null,
      })
      toast.success('تم التسجيل')
      onRegistered()
    } catch { toast.error('فشل التسجيل'); setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <div className="flex items-center justify-between"><h2 className="font-bold flex items-center gap-2"><Users size={16} />تسجيل لاعب</h2><button onClick={onClose} className="btn-ghost p-1"><X size={17} /></button></div>
        <div className="flex gap-2">
          <button onClick={() => setIsManual(false)} className={`flex-1 py-2 rounded-lg text-sm ${!isManual ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={!isManual ? { background: 'rgba(0,87,255,0.1)' } : {}}>عميل</button>
          <button onClick={() => setIsManual(true)} className={`flex-1 py-2 rounded-lg text-sm ${isManual ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={isManual ? { background: 'rgba(0,87,255,0.1)' } : {}}>يدوي</button>
        </div>
        {!isManual ? (
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} />
            <input className="input pr-9 text-sm" placeholder="بحث..." value={selected ? selected.name : search} onChange={e => { setSearch(e.target.value); setSelected(null) }} />
            {customers.length > 0 && !selected && (
              <div className="absolute top-full mt-1 w-full rounded-xl overflow-hidden z-10 shadow-2xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
                {customers.map(c => <button key={c.id} onClick={() => { setSelected(c); setCustomers([]) }} className="w-full text-right px-4 py-2.5 text-sm hover:bg-[var(--ps-surface)]">{c.name}</button>)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input className="input" placeholder="الاسم *" value={manualName} onChange={e => setManualName(e.target.value)} />
            <input className="input" placeholder="الموبايل" value={manualPhone} onChange={e => setManualPhone(e.target.value)} dir="ltr" />
          </div>
        )}
        <div className="flex gap-3"><button onClick={onClose} className="btn-ghost flex-1">إلغاء</button><button onClick={handleRegister} disabled={loading} className="btn-primary flex-1">{loading ? <Loader2 size={16} className="animate-spin" /> : 'تسجيل'}</button></div>
      </div>
    </div>
  )
}
