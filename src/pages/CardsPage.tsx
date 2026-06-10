import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CardType, CardInventorySummary } from '@/types'
import { Wifi, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CardsPage() {
  const [types, setTypes] = useState<CardType[]>([])
  const [inventory, setInventory] = useState<CardInventorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [restockQty, setRestockQty] = useState<Record<number, string>>({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: t }, { data: inv }] = await Promise.all([
      supabase.from('card_types').select('*').eq('is_active', true).order('name'),
      supabase.from('card_inventory_summary').select('*'),
    ])
    setTypes(t || [])
    setInventory(inv || [])
    setLoading(false)
  }

  const handleRestock = async (typeId: number) => {
    const qty = Number(restockQty[typeId])
    if (!qty || qty < 1) return
    const { error } = await supabase.rpc('restock_cards', { p_type_id: typeId, p_quantity: qty })
    if (error) toast.error('فشل التخزين')
    else { toast.success(`تم إضافة ${qty} كارت`); setRestockQty(prev => ({ ...prev, [typeId]: '' })); load() }
  }

  const handleSell = async (typeId: number) => {
    try {
      const { data, error } = await supabase.rpc('sell_card', { p_type_id: typeId })
      if (error) throw error
      toast.success('تم البيع بنجاح')
      load()
    } catch (err) {
      toast.error('لا توجد كروت متاحة')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div><h1 className="text-2xl font-bold text-ps-text">كروت النت</h1><p className="text-ps-muted text-sm">إدارة كروت الإنترنت</p></div>
      {loading ? <Loader2 size={20} className="animate-spin" /> : (
        <div className="space-y-3">
          {inventory.map(c => (
            <div key={c.id} className="rounded-xl p-4" style={{ background: 'var(--ps-card)', border: `1px solid ${c.is_low_stock ? 'rgba(255,61,90,0.3)' : 'var(--ps-border)'}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wifi size={16} style={{ color: c.is_low_stock ? 'var(--ps-red)' : 'var(--ps-blue-light)' }} />
                  <div>
                    <p className="font-semibold text-sm">{c.name} · {c.provider}</p>
                    <p className="text-xs text-ps-muted">{c.data_amount} · {c.validity_days} يوم</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-mono font-bold text-sm" style={{ color: 'var(--ps-green)' }}>{c.sell_price} ج</p>
                  <p className="text-xs text-ps-muted">{c.available_count} متوفر</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <input className="input flex-1 text-sm" placeholder="كمية التخزين" type="number" value={restockQty[c.id] || ''} onChange={e => setRestockQty(prev => ({ ...prev, [c.id]: e.target.value }))} />
                <button onClick={() => handleRestock(c.id)} className="btn-outline"><Plus size={14} />تخزين</button>
                <button onClick={() => handleSell(c.id)} className="btn-primary">بيع</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
