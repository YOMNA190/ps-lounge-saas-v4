import { CustomerSubscription } from '@/types'
import { Clock } from 'lucide-react'

interface Props { subscription: CustomerSubscription }

export default function CustomerSubscriptionCard({ subscription }: Props) {
  const pct = Math.min((subscription.hours_used / subscription.total_hours) * 100, 100)
  const isExpired = new Date(subscription.expires_at) < new Date()
  const isLow = pct > 80

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--ps-card)', border: `1px solid ${isExpired ? 'rgba(255,61,90,0.3)' : isLow ? 'rgba(255,200,67,0.3)' : 'var(--ps-border)'}` }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{subscription.custom_name || subscription.plan?.name}</p>
          <p className="text-xs text-ps-muted flex items-center gap-1"><Clock size={10} />{subscription.hours_used.toFixed(1)} / {subscription.total_hours} ساعة</p>
        </div>
        {isExpired && <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,61,90,0.15)', color: 'var(--ps-red)' }}>منتهي</span>}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--ps-surface)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isExpired ? 'var(--ps-red)' : isLow ? 'var(--ps-gold)' : 'var(--ps-blue)' }} />
      </div>
    </div>
  )
}
