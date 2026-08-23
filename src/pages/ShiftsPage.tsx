import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Shift } from '@/types'
import { Clock, Play, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { useBranch } from '@/lib/branch-context'
import { calculateShiftCloseout } from '@/lib/businessRules'
import { invokeCommand } from '@/lib/commands'

type ShiftPreview = { sessionsRevenue: number; salesRevenue: number }

export default function ShiftsPage() {
  const { profile } = useAuth()
  const { branchId } = useBranch()
  const profileId = profile?.id
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [openingCash, setOpeningCash] = useState('')
  const [pin, setPin] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [preview, setPreview] = useState<ShiftPreview | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: active }, { data: past }] = await Promise.all([
      supabase.from('shifts').select(`*,staff:profiles(*)`).is('ended_at', null).maybeSingle(),
      supabase.from('shifts').select(`*,staff:profiles(*)`).not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(20),
    ])
    setActiveShift(active)
    setShifts(past || [])
    if (active && profileId) {
      const [sessions, sales] = await Promise.all([
        supabase.from('sessions').select('cost').eq('staff_id', profileId).gte('started_at', active.started_at).not('ended_at', 'is', null),
        supabase.from('sales').select('total').eq('staff_id', profileId).gte('created_at', active.started_at),
      ])
      setPreview({
        sessionsRevenue: (sessions.data || []).reduce((sum, row) => sum + Number(row.cost || 0), 0),
        salesRevenue: (sales.data || []).reduce((sum, row) => sum + Number(row.total || 0), 0),
      })
    } else {
      setPreview(null)
    }
    setLoading(false)
  }, [profileId])

  useEffect(() => { void load() }, [load])

  const closeout = activeShift && preview
    ? calculateShiftCloseout({ openingCash: Number(activeShift.opening_cash) || 0, sessionsRevenue: preview.sessionsRevenue, salesRevenue: preview.salesRevenue, closingCash: Number(closingCash) || 0 })
    : null

  const startShift = async () => {
    if (!branchId) { toast.error('تعذر تحديد الفرع'); return }
    try {
      await invokeCommand({ action: 'openShift', branchId, openingCash: Number(openingCash) || 0 })
      toast.success('بدأ الشيفت'); setOpeningCash(''); load()
    } catch { toast.error('فشل بدء الشيفت') }
  }

  const endShift = async () => {
    if (!activeShift) return
    if (!branchId) { toast.error('تعذر تحديد الفرع'); return }
    if (!closingCash) { toast.error('أدخل الكاش النهائي بعد العد'); return }
    try {
      await invokeCommand({
        action: 'closeShift', branchId, shiftId: activeShift.id, pin,
        closingCash: Number(closingCash) || 0,
        cashTaken: closeout?.recommendedCashTaken || 0,
        cashLeft: closeout?.recommendedCashLeft || 0,
      })
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
          {preview && closeout && <div className="grid grid-cols-2 gap-3 rounded-xl p-3 text-sm" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}><div><p className="text-ps-muted">المتوقع</p><p className="font-mono font-bold">{closeout.expectedCash.toLocaleString()} ج</p></div><div><p className="text-ps-muted">الفرق الحالي</p><p className="font-mono font-bold" style={{ color: closeout.balanced ? 'var(--ps-green)' : closeout.variance < 0 ? 'var(--ps-red)' : 'var(--ps-gold)' }}>{closeout.variance.toLocaleString()} ج</p></div><p className="col-span-2 text-xs text-ps-muted">جلسات {preview.sessionsRevenue.toLocaleString()} ج + مبيعات {preview.salesRevenue.toLocaleString()} ج. يتم تمرير توزيع الكاش المقترح إلى إغلاق الوردية.</p></div>}
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
