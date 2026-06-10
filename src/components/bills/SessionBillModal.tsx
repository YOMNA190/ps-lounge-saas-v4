import { useState, useEffect } from 'react'
import { getSessionBill, stopSessionWithBill } from '@/lib/sessions'
import { SessionBill, PAYMENT_METHODS } from '@/types'
import { X, Receipt, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props { sessionId: string; deviceName: string; onClose: () => void; onStopped: () => void }

export default function SessionBillModal({ sessionId, deviceName, onClose, onStopped }: Props) {
  const [bill, setBill] = useState<SessionBill | null>(null)
  const [discount, setDiscount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<keyof typeof PAYMENT_METHODS>('cash')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    getSessionBill(sessionId).then(b => { setBill(b); setLoading(false) }).catch(() => setLoading(false))
  }, [sessionId])

  const handleStop = async () => {
    setProcessing(true)
    try {
      const result = await stopSessionWithBill(sessionId, Number(discount) || 0, discountReason || undefined, paymentMethod)
      toast.success(`تم الإنهاء! الإجمالي: ${result.grand_total.toLocaleString()} ج`)
      onStopped()
    } catch (err) {
      toast.error('فشل إنهاء الجلسة')
      onClose()
    }
    setProcessing(false)
  }

  if (loading) return <div className="fixed inset-0 z-50 flex items-center justify-center"><Loader2 size={24} className="animate-spin" /></div>
  if (!bill) return null

  const grandTotal = bill.session_cost + bill.orders_total - (Number(discount) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-up" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)', maxHeight: '95dvh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--ps-border)' }}>
          <div className="flex items-center gap-2"><Receipt size={18} style={{ color: 'var(--ps-gold)' }} /><p className="font-bold">فاتورة الجلسة</p></div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={17} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(95dvh - 180px)' }}>
          <div className="rounded-xl p-3" style={{ background: 'var(--ps-surface)' }}>
            <div className="flex justify-between text-sm mb-1"><span className="text-ps-muted">{deviceName}</span><span className="font-mono">{bill.session_cost.toLocaleString()} ج</span></div>
            <div className="flex justify-between text-sm mb-1"><span className="text-ps-muted">الطلبات</span><span className="font-mono">{bill.orders_total.toLocaleString()} ج</span></div>
            {bill.orders.length > 0 && bill.orders.map((o, i) => (
              <div key={i} className="flex justify-between text-xs text-ps-muted px-2"><span>{o.product_name} ×{o.qty}</span><span>{o.subtotal.toLocaleString()} ج</span></div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-bold" style={{ borderColor: 'var(--ps-border)' }}>
              <span>الإجمالي</span><span className="font-mono" style={{ color: 'var(--ps-gold)' }}>{grandTotal.toLocaleString()} ج</span>
            </div>
          </div>

          <div>
            <label className="label">الخصم (اختياري)</label>
            <input className="input" type="number" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
            <input className="input mt-2 text-sm" placeholder="سبب الخصم" value={discountReason} onChange={e => setDiscountReason(e.target.value)} />
          </div>

          <div>
            <label className="label">طريقة الدفع</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <button key={key} onClick={() => setPaymentMethod(key as keyof typeof PAYMENT_METHODS)} className="py-2.5 px-3 rounded-xl border text-sm transition-all" style={paymentMethod === key ? {
                  background: 'rgba(0,87,255,0.12)', border: '1px solid rgba(0,87,255,0.35)', color: 'var(--ps-blue-light)'
                } : { background: 'var(--ps-surface)', border: '1px solid var(--ps-border)', color: 'var(--ps-muted)' }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--ps-border)', background: 'rgba(0,0,0,0.2)' }}>
          <button onClick={handleStop} disabled={processing} className="btn-danger w-full py-3">{processing ? <Loader2 size={16} className="animate-spin" /> : `إنهاء وتحصيل ${grandTotal.toLocaleString()} ج`}</button>
        </div>
      </div>
    </div>
  )
}
