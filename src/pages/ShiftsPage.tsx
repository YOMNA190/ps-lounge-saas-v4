import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Shift } from '@/types'
import { Clock, Play, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

export default function ShiftsPage() {
  const { profile } = useAuth()
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [openingCash, setOpeningCash] = useState('')
  const [pin, setPin] = useState('')
  const [closingCash, setClosingCash] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: active }, { data: past }] = await Promise.all([
      supabase.from('shifts').select(`*,staff:profiles(*)`).is('ended_at', null).maybeSingle(),
      supabase.from('shifts').select(`*,staff:profiles(*)`).not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(20),
    ])
    setActiveShift(active)
    setShifts(past || [])
    setLoading(false)
  }

  const startShift = async () => {
    const { error } = await supabase.from('shifts').insert({ opening_cash: Number(openingCash) || 0, staff_id: profile?.id })
    if (error) toast.error('فشل بدء الشيفت')
    else { toast.success('بدأ الشيفت'); setOpeningCash(''); load() }
  }

  const endShift = async () => {
    if (!activeShift) return
    try {
      const { error } = await supabase.rpc('end_shift', {
        p_shift_id: activeShift.id, p_pin: pin, p_closing_cash: Number(closingCash) || 0,
        p_cash_taken: 0, p_cash_left: Number(closingCash) || 0
      })
      if (error) throw error
      toast.success('تم إنهاء الشيفت')
      setPin(''); setClosingCash(''); load()
    } catch {
      toast.error('PIN غير صحيح أو خطأ آخر')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-ps-text">الشيفتات</h1>

      {!activeShift ? (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <p className="text-ps-muted text-sm">لا يوجد شيفت نشط</p>
          <div className="flex gap-3">
            <input className="input flex-1" placeholder="الكاش الافتتاحي" type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} />
            <button onClick={startShift} className="btn-primary"><Play size={14} />بدء شيفت</button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--ps-card)', border: '1px solid rgba(0,229,160,0.2)' }}>
          <div className="flex items-center gap-2"><Clock size={16} style={{ color: 'var(--ps-green)' }} /><span className="font-semibold" style={{ color: 'var(--ps-green)' }}>شيفت نشط</span></div>
          <p className="text-sm text-ps-muted">بدأ: {new Date(activeShift.started_at).toLocaleString('ar-EG')}</p>
          <div className="flex gap-3">
            <input className="input flex-1" placeholder="PIN" type="password" value={pin} onChange={e => setPin(e.target.value)} dir="ltr" />
            <input className="input flex-1" placeholder="الكاش النهائي" type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} />
            <button onClick={endShift} className="btn-danger"><Square size={14} />إنهاء</button>
          </div>
        </div>
      )}

      <h2 className="font-semibold text-sm text-ps-muted">الشيفتات السابقة</h2>
      {loading ? <Loader2 size={20} className="animate-spin" /> : shifts.map(s => (
        <div key={s.id} className="rounded-xl p-3" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <div className="flex justify-between text-sm">
            <span>{s.staff?.name}</span>
            <span className="font-mono" style={{ color: 'var(--ps-green)' }}>{s.total_revenue?.toLocaleString()} ج</span>
          </div>
          <p className="text-xs text-ps-muted">{s.started_at ? new Date(s.started_at).toLocaleDateString('ar-EG') : ''} → {s.ended_at ? new Date(s.ended_at).toLocaleDateString('ar-EG') : ''}</p>
        </div>
      ))}
    </div>
  )
}
