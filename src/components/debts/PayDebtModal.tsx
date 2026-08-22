import { useState } from 'react'
import { Debt, PAYMENT_METHODS } from '@/types'
import { payDebt } from '@/lib/debts'
import { CreditCard, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props { debt: Debt; onClose: () => void; onPaid: () => void }

export default function PayDebtModal({ debt, onClose, onPaid }: Props) {
  const [amount, setAmount] = useState(String(debt.amount - debt.amount_paid))
  const [paymentMethod, setPaymentMethod] = useState<keyof typeof PAYMENT_METHODS>('cash')
  const [loading, setLoading] = useState(false)

  const remaining = debt.amount - debt.amount_paid

  const handlePay = async () => {
    setLoading(true)
    try {
      await payDebt(debt.id, Number(amount), paymentMethod)
      toast.success('تم السداد بنجاح')
      onPaid()
    } catch {
      toast.error('فشل السداد')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <div className="flex items-center justify-between"><h2 className="font-bold flex items-center gap-2"><CreditCard size={16} />سداد دين</h2><button onClick={onClose} className="btn-ghost p-1"><X size={17} /></button></div>
        <p className="text-sm text-ps-muted">{debt.reason}</p>
        <p className="text-sm">المتبقي: <span className="font-mono font-bold" style={{ color: 'var(--ps-red)' }}>{remaining.toLocaleString()} ج</span></p>
        <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} max={remaining} />
        <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as keyof typeof PAYMENT_METHODS)}>
          {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-3"><button onClick={onClose} className="btn-ghost flex-1">إلغاء</button><button onClick={handlePay} disabled={loading} className="btn-primary flex-1">{loading ? <Loader2 size={16} className="animate-spin" /> : 'سداد'}</button></div>
      </div>
    </div>
  )
}
