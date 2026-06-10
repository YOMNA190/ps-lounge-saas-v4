import { useState, useEffect } from 'react'
import { Device } from '@/types'
import { stopSession, calculateSessionPrice } from '@/lib/sessions'
import { sanitizeError } from '@/lib/errors'
import { isGhostRisk } from '@/hooks/useDevices'
import { Gamepad2, Clock, User, Play, Users } from 'lucide-react'
import { toast } from 'sonner'
import StartSessionModal from './StartSessionModal'
import SessionBillModal from '../bills/SessionBillModal'
import AddOrderToSessionModal from '../bills/AddOrderToSessionModal'

function useElapsedTime(startedAt: string | undefined) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!startedAt) { setElapsed(''); return }
    const update = () => {
      const diff = Date.now() - new Date(startedAt).getTime()
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`)
    }
    update(); const id = setInterval(update, 1000); return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

interface Props { device: Device; onUpdate: () => void }

export default function DeviceCard({ device, onUpdate }: Props) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showStart, setShowStart] = useState(false)
  const [showBill, setShowBill] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [estimatedPrice, setEstimatedPrice] = useState(0)

  const isActive = !!device.active_session
  const session = device.active_session
  const elapsed = useElapsedTime(session?.started_at)
  const ghostRisk = session ? isGhostRisk(session.started_at) : false

  useEffect(() => {
    if (!session) { setEstimatedPrice(0); return }
    const update = () => {
      const durationSeconds = (Date.now() - new Date(session.started_at).getTime()) / 1000
      setEstimatedPrice(calculateSessionPrice(durationSeconds, device.price_single || 0))
    }
    update(); const interval = setInterval(update, 1000); return () => clearInterval(interval)
  }, [session, device.price_single])

  const handleEnd = async () => {
    if (!session || isProcessing) return
    setIsProcessing(true)
    try {
      await stopSession(session.id)
      toast.success(`تمت الجلسة`)
      onUpdate()
    } catch (error) {
      toast.error(sanitizeError(error).message)
    } finally { setIsProcessing(false) }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl transition-all duration-300 select-none" style={{
        background: isActive ? 'linear-gradient(135deg, rgba(0,229,160,0.05), rgba(17,17,32,1) 50%)' : 'var(--ps-card)',
        border: isActive ? '1px solid rgba(0,229,160,0.25)' : '1px solid var(--ps-border)',
        boxShadow: isActive ? '0 0 24px rgba(0,229,160,0.08)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {isActive && <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,160,0.8), transparent)' }} />}
        <div className="p-4 relative">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-sm text-ps-text leading-none mb-1.5">{device.name}</p>
              <span className="inline-flex items-center text-xs font-mono font-bold px-2 py-0.5 rounded-md" style={{
                background: device.type === 'PS5' ? 'rgba(0,87,255,0.1)' : 'rgba(155,109,255,0.1)',
                border: `1px solid ${device.type === 'PS5' ? 'rgba(0,87,255,0.2)' : 'rgba(155,109,255,0.2)'}`,
                color: device.type === 'PS5' ? 'var(--ps-blue-light)' : 'var(--ps-purple)'
              }}>{device.type}</span>
            </div>
            <div className={`badge ${isActive ? 'badge-active' : 'badge-idle'}`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
              {isActive ? 'نشط' : 'فارغ'}
            </div>
          </div>

          {isActive && session ? (
            <div className="space-y-2 mb-3">
              <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,229,160,0.1)' }}>
                <div className="flex items-center gap-1.5 text-ps-muted text-xs"><Clock size={12} /><span>وقت اللعب</span></div>
                <span className="font-mono font-bold text-sm" style={{ color: 'var(--ps-green)', letterSpacing: '0.05em' }}>{elapsed}</span>
              </div>
              <div className="flex gap-1.5">
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ps-muted flex-1" style={{ background: 'rgba(0,0,0,0.25)' }}><Users size={11} />{session.mode === 'single' ? 'فردي' : 'زوجي'}</div>
                {session.customer && <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ps-muted flex-1 overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)' }}><User size={11} /><span className="truncate">{session.customer.name}</span></div>}
              </div>
              {session.game_played && <p className="text-xs text-ps-muted px-2.5 py-1.5 rounded-lg truncate" style={{ background: 'rgba(0,0,0,0.25)' }}>🎮 {session.game_played}</p>}
              {ghostRisk && <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', color: '#d97706' }}>⚠️ جلسة طويلة</div>}

              <div className="font-mono text-sm font-bold text-center py-1" style={{ color: 'var(--ps-gold)' }}>{estimatedPrice.toLocaleString()} ج</div>

              <div className="flex gap-2">
                <button onClick={() => setShowAddOrder(true)} disabled={isProcessing} className="btn-outline flex-1 text-xs py-2">طلب</button>
                <button onClick={() => setShowBill(true)} disabled={isProcessing} className="btn-primary flex-1 text-xs py-2">إنهاء</button>
              </div>
            </div>
          ) : (
            <div className="py-5 flex flex-col items-center justify-center gap-1 mb-3">
              <Gamepad2 size={24} style={{ color: 'var(--ps-border-hi)', opacity: 0.5 }} />
              <p className="text-xs text-ps-muted mt-1">{device.price_single} / {device.price_multi} ج/س</p>
            </div>
          )}

          {!isActive && <button onClick={() => setShowStart(true)} disabled={isProcessing} className="btn-primary w-full py-2.5 text-sm"><Play size={14} />بدء جلسة</button>}
        </div>
      </div>

      {showStart && <StartSessionModal device={device} onClose={() => setShowStart(false)} onSuccess={() => { setShowStart(false); onUpdate() }} />}
      {showBill && session && <SessionBillModal sessionId={session.id} deviceName={device.name} onClose={() => setShowBill(false)} onStopped={() => { setShowBill(false); onUpdate() }} />}
      {showAddOrder && session && <AddOrderToSessionModal sessionId={session.id} onClose={() => setShowAddOrder(false)} onAdded={() => { setShowAddOrder(false); toast.success('تم إضافة الطلب') }} />}
    </>
  )
}
