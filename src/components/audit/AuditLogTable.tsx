import { AuditLogEntry } from '@/types'


interface Props { entries: AuditLogEntry[] }

const ACTION_LABELS: Record<string, string> = {
  session_start: 'بدء جلسة', session_stop: 'إنهاء جلسة', discount_applied: 'خصم',
  debt_created: 'إنشاء دين', debt_payment: 'سداد دين', debt_waived: 'إعفاء دين',
  subscription_created: 'اشتراك جديد', inventory_restock: 'تخزين', order_added_to_session: 'طلب',
  achievement_unlocked: 'إنجاز', bracket_generated: 'بطولة',
}

export default function AuditLogTable({ entries }: Props) {
  if (entries.length === 0) return <p className="text-center py-12 text-ps-muted">لا توجد سجلات</p>

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b" style={{ borderColor: 'var(--ps-border)' }}>
            <th className="px-4 py-3 text-right text-xs text-ps-muted font-semibold">التاريخ</th>
            <th className="px-4 py-3 text-right text-xs text-ps-muted font-semibold">الموظف</th>
            <th className="px-4 py-3 text-right text-xs text-ps-muted font-semibold">الإجراء</th>
            <th className="px-4 py-3 text-right text-xs text-ps-muted font-semibold hidden sm:table-cell">التفاصيل</th>
          </tr></thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
            {entries.map(e => (
              <tr key={e.id} className="hover:bg-[var(--ps-surface)] transition-colors">
                <td className="px-4 py-3 text-xs font-mono">{new Date(e.created_at).toLocaleString('ar-EG')}</td>
                <td className="px-4 py-3 text-xs">{e.staff_name || '—'}</td>
                <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: 'rgba(0,87,255,0.1)', color: 'var(--ps-blue-light)' }}>{ACTION_LABELS[e.action] || e.action}</span></td>
                <td className="px-4 py-3 text-xs text-ps-muted hidden sm:table-cell max-w-[200px] truncate">{e.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
