import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Package } from '@/types'
import { Tag, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('60')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('packages').select('*').eq('is_active', true).order('price')
    setPackages(data || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const handleAdd = async () => {
    const { error } = await supabase.from('packages').insert({ name, price: Number(price), duration_mins: Number(duration) })
    if (error) toast.error('فشل الإضافة')
    else { toast.success('تم الإضافة'); setShowAdd(false); setName(''); setPrice(''); setDuration('60'); load() }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text">الباقات</h1><p className="text-ps-muted text-sm">باقات الأسعار</p></div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} />جديد</button>
      </div>

      {loading ? <Loader2 size={20} className="animate-spin" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map(p => (
            <div key={p.id} className="rounded-xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <Tag size={16} style={{ color: 'var(--ps-purple)' }} className="mb-2" />
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-ps-muted">{p.duration_mins} دقيقة</p>
              <p className="font-mono font-bold mt-2" style={{ color: 'var(--ps-gold)' }}>{p.price} ج</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <h2 className="font-bold">باقة جديدة</h2>
            <input className="input" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="السعر" type="number" value={price} onChange={e => setPrice(e.target.value)} />
            <input className="input" placeholder="المدة (دقيقة)" type="number" value={duration} onChange={e => setDuration(e.target.value)} />
            <div className="flex gap-3"><button onClick={() => setShowAdd(false)} className="btn-ghost flex-1">إلغاء</button><button onClick={handleAdd} className="btn-primary flex-1">حفظ</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
