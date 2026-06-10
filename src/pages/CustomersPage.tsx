import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Customer } from '@/types'
import { useNavigate } from 'react-router'
import { Users, Search, Plus, Phone, Star, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import CustomerRankBadge from '@/components/customers/CustomerRankBadge'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(200)
    setCustomers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))

  const handleAdd = async () => {
    if (!newName.trim()) return
    const { error } = await supabase.from('customers').insert({ name: newName.trim(), phone: newPhone.trim() || null })
    if (error) toast.error(error.message.includes('unique') ? 'رقم الموبايل موجود' : 'فشل الإضافة')
    else { toast.success('تم الإضافة'); setNewName(''); setNewPhone(''); setShowAdd(false); load() }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text">العملاء</h1><p className="text-ps-muted text-sm">{customers.length} عميل</p></div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} /><span className="hidden sm:inline">عميل جديد</span></button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} />
        <input className="input pr-10" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--ps-blue-light)]" /></div> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          {filtered.length === 0 ? <div className="flex flex-col items-center py-16 text-ps-muted"><Users size={36} style={{ opacity: 0.2 }} /><p>لا يوجد عملاء</p></div> : (
            <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
              {filtered.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[var(--ps-surface)] transition-colors" onClick={() => navigate(`/customers/${c.id}`)}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.2)', color: 'var(--ps-blue-light)' }}>{c.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-ps-text">{c.name}</p>
                      <CustomerRankBadge rank={c.rank || 'bronze'} size="sm" />
                    </div>
                    {c.phone && <p className="text-xs text-ps-muted font-mono" dir="ltr"><Phone size={9} className="inline" /> {c.phone}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0"><Star size={13} style={{ color: 'var(--ps-gold)' }} /><span className="font-mono font-bold text-sm" style={{ color: 'var(--ps-gold)' }}>{c.points}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <div className="flex justify-between"><h2 className="font-bold">عميل جديد</h2><button onClick={() => setShowAdd(false)} className="btn-ghost p-1"><X size={17} /></button></div>
            <input className="input" placeholder="الاسم *" value={newName} onChange={e => setNewName(e.target.value)} />
            <input className="input" placeholder="الموبايل" value={newPhone} onChange={e => setNewPhone(e.target.value)} dir="ltr" />
            <div className="flex gap-3"><button onClick={() => setShowAdd(false)} className="btn-ghost flex-1">إلغاء</button><button onClick={handleAdd} className="btn-primary flex-1">إضافة</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
