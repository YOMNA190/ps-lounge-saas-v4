import { useState } from 'react'
import { useAuditLog } from '@/hooks/useAuditLog'
import { AuditAction } from '@/types'
import { Bell, Download, Loader2 } from 'lucide-react'
import { exportAuditLogToCSV } from '@/lib/audit'
import AuditLogTable from '@/components/audit/AuditLogTable'

const ACTIONS: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'الكل' }, { value: 'session_start', label: 'بدء جلسة' }, { value: 'session_stop', label: 'إنهاء جلسة' },
  { value: 'discount_applied', label: 'خصم' }, { value: 'debt_created', label: 'إنشاء دين' },
  { value: 'subscription_created', label: 'اشتراك' }, { value: 'inventory_restock', label: 'تخزين' },
]

export default function AuditLogPage() {
  const [action, setAction] = useState<AuditAction | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const { entries, loading } = useAuditLog({ action: action || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined })

  const handleExport = () => {
    const csv = exportAuditLogToCSV(entries)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text flex items-center gap-2"><Bell size={22} />سجل التدقيق</h1></div>
        <button onClick={handleExport} className="btn-outline text-xs"><Download size={14} />تصدير CSV</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input text-sm w-auto" value={action} onChange={e => setAction(e.target.value as AuditAction | '')}>
          {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <input className="input text-sm w-auto" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <input className="input text-sm w-auto" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>

      {loading ? <Loader2 size={20} className="animate-spin" /> : <AuditLogTable entries={entries} />}
    </div>
  )
}
