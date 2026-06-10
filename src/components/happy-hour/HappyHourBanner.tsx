import { useState, useEffect } from 'react'
import { checkHappyHour } from '@/lib/happy-hour'
import { HappyHourCheck } from '@/types'
import { Zap, X } from 'lucide-react'

export default function HappyHourBanner() {
  const [hh, setHh] = useState<HappyHourCheck | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    checkHappyHour('all').then(setHh)
    const interval = setInterval(() => checkHappyHour('all').then(setHh), 60000)
    return () => clearInterval(interval)
  }, [])

  if (!hh?.is_happy_hour || dismissed) return null

  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in" style={{ background: 'rgba(255,200,67,0.08)', border: '1px solid rgba(255,200,67,0.25)' }}>
      <Zap size={18} style={{ color: 'var(--ps-gold)' }} className="flex-shrink-0 animate-pulse" />
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--ps-gold)' }}>🔥 {hh.name}</p>
        <p className="text-xs" style={{ color: 'var(--ps-gold)', opacity: 0.8 }}>{hh.message} · حتى {hh.end_time?.slice(0, 5)}</p>
      </div>
      <button onClick={() => setDismissed(true)} className="btn-ghost p-1 flex-shrink-0"><X size={14} /></button>
    </div>
  )
}
