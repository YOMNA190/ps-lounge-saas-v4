import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { Receipt, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').eq('is_active', true).order('sort_order')
    setExpenses(data || [])
    setLoading(false)
  }

  const updateAmount = (id: number, amount: string) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, amount: Number(amount) || 0 } : e))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const e of expenses) {
        await supabase.rpc('update_expense', { p_expense_id: e.id, p_amount: e.amount, p_name: e.name })
      }
      toast.success('تم الحفظ')
    } catch {
      toast.error('فشل الحفظ')
    }
    setSaving(false)
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text">المصاريف</h1><p className="text-ps-muted text-sm">إدارة المصاريف الشهرية</p></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary"><Save size={14} />{saving ? 'جاري...' : 'حفظ'}</button>
      </div>

      <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <p className="text-sm text-ps-muted">إجمالي المصاريف</p>
        <p className="text-3xl font-bold font-mono mt-1" style={{ color: 'var(--ps-red)' }}>{total.toLocaleString()} ج</p>
      </div>

      {loading ? <Loader2 size={20} className="animate-spin" /> : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
              <Receipt size={14} style={{ color: 'var(--ps-muted)' }} />
              <span className="flex-1 text-sm">{e.name}</span>
              <input className="input w-28 text-sm text-left" type="number" value={e.amount} onChange={ev => updateAmount(e.id, ev.target.value)} dir="ltr" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
