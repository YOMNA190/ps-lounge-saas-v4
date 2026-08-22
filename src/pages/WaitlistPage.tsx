import { useState } from 'react'
import { useWaitlist } from '@/hooks/useWaitlist'
import { ListOrdered, Plus, Loader2, Check, X, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import AddToWaitlistModal from '@/components/waitlist/AddToWaitlistModal'

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  waiting: { color: 'var(--ps-gold)', label: 'في الانتظار' },
  notified: { color: 'var(--ps-blue-light)', label: 'تم الإشعار' },
  seated: { color: 'var(--ps-green)', label: 'تم الجلوس' },
  cancelled: { color: 'var(--ps-red)', label: 'ملغي' },
}

export default function WaitlistPage() {
  const { entries, loading, refetch } = useWaitlist()
  const [showAdd, setShowAdd] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id)
    await supabase.from('waitlist').update({ status }).eq('id', id)
    toast.success('تم التحديث')
    refetch(); setUpdating(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text flex items-center gap-2"><ListOrdered size={22} />قائمة الانتظار</h1></div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} />إضافة</button>
      </div>

      {loading ? <Loader2 size={20} className="animate-spin" /> : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="rounded-xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.2)', color: 'var(--ps-blue-light)' }}>{e.customer_name[0]}</div>
                  <div>
                    <p className="font-medium text-sm">{e.customer_name}</p>
                    <div className="flex items-center gap-2 text-xs text-ps-muted">
                      {e.customer_phone && <span className="flex items-center gap-1"><Phone size={9} />{e.customer_phone}</span>}
                      <span>{e.device_type} · {e.mode === 'single' ? 'فردي' : 'زوجي'}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-md font-semibold flex-shrink-0" style={{ background: STATUS_STYLES[e.status].color + '15', color: STATUS_STYLES[e.status].color }}>{STATUS_STYLES[e.status].label}</span>
              </div>
              {e.status === 'waiting' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => updateStatus(e.id, 'notified')} disabled={updating === e.id} className="btn-primary flex-1 text-xs py-2"><Check size={12} />إشعار</button>
                  <button onClick={() => updateStatus(e.id, 'cancelled')} disabled={updating === e.id} className="btn-danger text-xs py-2 px-3"><X size={12} />إلغاء</button>
                </div>
              )}
            </div>
          ))}
          {entries.length === 0 && <p className="text-center text-ps-muted py-12">قائمة الانتظار فارغة</p>}
        </div>
      )}

      {showAdd && <AddToWaitlistModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); refetch() }} />}
    </div>
  )
}
