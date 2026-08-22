import { useState, useEffect } from 'react'
import { addOrderToSession } from '@/lib/sessions'
import { Product } from '@/types'
import { supabase } from '@/lib/supabase'
import { X, Plus, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props { sessionId: string; onClose: () => void; onAdded: () => void }

export default function AddOrderToSessionModal({ sessionId, onClose, onAdded }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const handleAdd = async (productId: number) => {
    setAdding(productId)
    try {
      await addOrderToSession(sessionId, productId, 1)
      toast.success('تم إضافة الطلب')
      onAdded()
    } catch { toast.error('فشل إضافة الطلب') }
    setAdding(null)
  }

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 animate-slide-up" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', maxHeight: '80dvh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold">إضافة طلب</h2><button onClick={onClose} className="btn-ghost p-1.5"><X size={17} /></button></div>
        <div className="relative mb-4"><Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ps-muted)' }} /><input className="input pr-9 text-sm" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        {loading ? <Loader2 size={20} className="animate-spin" /> : (
          <div className="space-y-2">
            {filtered.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--ps-surface)' }}>
                <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-ps-muted">{p.sell_price} ج · {p.stock_qty} متوفر</p></div>
                <button onClick={() => handleAdd(p.id)} disabled={adding === p.id} className="btn-primary p-2">{adding === p.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
