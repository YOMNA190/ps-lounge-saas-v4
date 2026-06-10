import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Device, Session } from '@/types'
import { Gamepad2, Users, Clock, Zap } from 'lucide-react'

export default function PublicDisplayPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [waitlist, setWaitlist] = useState(0)
  const [happyHour, setHappyHour] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const load = async () => {
    const [{ data: devs }, { data: sess }, { count: wl }, { data: hh }] = await Promise.all([
      supabase.from('devices').select('*').eq('is_active', true),
      supabase.from('sessions').select('*').is('ended_at', null),
      supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
      supabase.rpc('check_happy_hour', { p_device_type: 'all' }),
    ])
    setDevices(devs || [])
    setSessions(sess || [])
    setWaitlist(wl || 0)
    setHappyHour((hh as { message?: string } | null)?.message || null)
    setLoading(false)
  }

  const activeDeviceIds = new Set(sessions.map(s => s.device_id))
  const freeDevices = devices.filter(d => !activeDeviceIds.has(d.id))
  const busyDevices = devices.filter(d => activeDeviceIds.has(d.id))

  if (loading) return <div className="min-h-screen flex items-center justify-center text-ps-muted">جاري التحميل...</div>

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--ps-darker)' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gamepad2 size={32} style={{ color: 'var(--ps-blue-light)' }} />
            <div><h1 className="text-3xl font-bold">PS Lounge</h1><p className="text-sm text-ps-muted">شاشة العرض العامة</p></div>
          </div>
          {happyHour && <div className="px-4 py-2 rounded-xl font-bold" style={{ background: 'rgba(255,200,67,0.15)', border: '1px solid rgba(255,200,67,0.3)', color: 'var(--ps-gold)' }}>{happyHour}</div>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)' }}>
            <Zap size={24} className="mx-auto mb-2" style={{ color: 'var(--ps-green)' }} />
            <p className="text-3xl font-bold font-mono" style={{ color: 'var(--ps-green)' }}>{freeDevices.length}</p>
            <p className="text-sm text-ps-muted">جهاز متاح</p>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,61,90,0.08)', border: '1px solid rgba(255,61,90,0.2)' }}>
            <Gamepad2 size={24} className="mx-auto mb-2" style={{ color: 'var(--ps-red)' }} />
            <p className="text-3xl font-bold font-mono" style={{ color: 'var(--ps-red)' }}>{busyDevices.length}</p>
            <p className="text-sm text-ps-muted">جهاز مشغول</p>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <Users size={24} className="mx-auto mb-2 text-ps-muted" />
            <p className="text-3xl font-bold font-mono">{waitlist}</p>
            <p className="text-sm text-ps-muted">في الانتظار</p>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <Clock size={24} className="mx-auto mb-2 text-ps-muted" />
            <p className="text-3xl font-bold font-mono">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-sm text-ps-muted">{new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">الأجهزة المتاحة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {freeDevices.map(d => (
              <div key={d.id} className="rounded-xl p-4 text-center" style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.25)' }}>
                <p className="font-bold text-lg">{d.name}</p>
                <p className="text-sm" style={{ color: 'var(--ps-green)' }}>متاح</p>
              </div>
            ))}
          </div>
        </div>

        {busyDevices.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-3">الأجهزة المشغولة</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {busyDevices.map(d => (
                <div key={d.id} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,61,90,0.08)', border: '1px solid rgba(255,61,90,0.25)' }}>
                  <p className="font-bold text-lg">{d.name}</p>
                  <p className="text-sm" style={{ color: 'var(--ps-red)' }}>مشغول</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
