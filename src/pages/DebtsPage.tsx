import { useState } from 'react'
import { useDebts } from '@/hooks/useDebts'
import { waiveDebt } from '@/lib/debts'
import { Debt, DebtStatus } from '@/types'
import { BookOpen, CreditCard, Trash2, Loader2, Wallet, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import PayDebtModal from '@/components/debts/PayDebtModal'

const STATUS_COLORS: Record<DebtStatus, string> = {
  pending: 'var(--ps-red)', partial: 'var(--ps-gold)', paid: 'var(--ps-green)', waived: 'var(--ps-muted)'
}
const STATUS_LABELS: Record<DebtStatus, string> = {
  pending: 'مستحق', partial: 'جزئي', paid: 'مسدد', waived: 'معفى'
}

export default function DebtsPage() {
  const { isAdmin } = useAuth()
  const { debts, summaries, loading, refetch } = useDebts()
  const [statusFilter, setStatusFilter] = useState<DebtStatus | ''>('')
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null)

  const filtered = statusFilter ? debts.filter(d => d.status === statusFilter) : debts
  const pendingTotal = summaries.reduce((s, c) => s + Number(c.total_pending), 0)
  const totalHistory = summaries.reduce((s, c) => s + Number(c.total_debt_history), 0)
  const totalPaid = summaries.reduce((s, c) => s + Number(c.total_paid), 0)

  const handleWaive = async (debt: Debt) => {
    if (!confirm(`تأكيد إعفاء الدين: ${debt.reason}؟`)) return
    try { await waiveDebt(debt.id, 'إعفاء إداري'); toast.success('تم الإعفاء'); refetch() }
    catch { toast.error('فشل الإعفاء') }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text flex items-center gap-2"><BookOpen size={22} />الديون</h1></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,61,90,0.08)', border: '1px solid rgba(255,61,90,0.2)' }}>
          <AlertCircle size={16} className="mx-auto mb-1" style={{ color: 'var(--ps-red)' }} />
          <p className="font-mono font-bold" style={{ color: 'var(--ps-red)' }}>{pendingTotal.toLocaleString()} ج</p>
          <p className="text-[10px] text-ps-muted">مستحق</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.2)' }}>
          <Wallet size={16} className="mx-auto mb-1" style={{ color: 'var(--ps-green)' }} />
          <p className="font-mono font-bold" style={{ color: 'var(--ps-green)' }}>{totalPaid.toLocaleString()} ج</p>
          <p className="text-[10px] text-ps-muted">تم سداده</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          <CreditCard size={16} className="mx-auto mb-1 text-ps-muted" />
          <p className="font-mono font-bold">{totalHistory.toLocaleString()} ج</p>
          <p className="text-[10px] text-ps-muted">إجمالي</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
        {[{ k: '', l: 'الكل' }, { k: 'pending', l: 'مستحق' }, { k: 'partial', l: 'جزئي' }, { k: 'paid', l: 'مسدد' }].map(s => (
          <button key={s.k} onClick={() => setStatusFilter(s.k as DebtStatus | '')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s.k ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted'}`} style={statusFilter === s.k ? { background: 'var(--ps-card)', border: '1px solid var(--ps-border)' } : {}}>{s.l}</button>
        ))}
      </div>

      {loading ? <Loader2 size={20} className="animate-spin" /> : (
        <div className="space-y-2">
          {filtered.map(d => (
            <div key={d.id} className="rounded-xl p-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{d.customer?.name || '—'}</p>
                  <p className="text-xs text-ps-muted">{d.reason}</p>
                </div>
                <div className="text-left">
                  <p className="font-mono font-bold">{d.amount.toLocaleString()} ج</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: STATUS_COLORS[d.status] + '15', color: STATUS_COLORS[d.status], border: `1px solid ${STATUS_COLORS[d.status]}30` }}>{STATUS_LABELS[d.status]}</span>
                </div>
              </div>
              {(d.status === 'pending' || d.status === 'partial') && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setPayingDebt(d)} className="btn-primary flex-1 text-xs py-2"><CreditCard size={12} />سداد</button>
                  {isAdmin && <button onClick={() => handleWaive(d)} className="btn-danger text-xs py-2 px-3"><Trash2 size={12} />إعفاء</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {payingDebt && <PayDebtModal debt={payingDebt} onClose={() => setPayingDebt(null)} onPaid={() => { setPayingDebt(null); refetch() }} />}
    </div>
  )
}
