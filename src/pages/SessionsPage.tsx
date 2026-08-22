import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Session } from '@/types'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { User, Gamepad2, Loader2 } from 'lucide-react'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sessions').select(`*,device:devices(*),customer:customers(*)`).not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(100)
    setSessions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ps-text">الجلسات</h1>
        <p className="text-ps-muted text-sm">سجل الجلسات المكتملة</p>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--ps-blue-light)]" /></div> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          {sessions.length === 0 ? <p className="text-center py-12 text-ps-muted">لا توجد جلسات</p> : (
            <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
              {sessions.map(s => (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.device?.type === 'PS5' ? 'rgba(0,87,255,0.1)' : 'rgba(155,109,255,0.1)' }}>
                    <Gamepad2 size={18} style={{ color: s.device?.type === 'PS5' ? 'var(--ps-blue-light)' : 'var(--ps-purple)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.device?.name} · {s.mode === 'single' ? 'فردي' : 'زوجي'}</p>
                    <div className="flex items-center gap-2 text-xs text-ps-muted">
                      {s.customer && <span className="flex items-center gap-1"><User size={10} />{s.customer.name}</span>}
                      {s.game_played && <span>🎮 {s.game_played}</span>}
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="font-mono font-bold text-sm" style={{ color: 'var(--ps-green)' }}>{s.cost?.toLocaleString()} ج</p>
                    <p className="text-[10px] text-ps-muted">{s.ended_at ? format(new Date(s.ended_at), 'dd/MM HH:mm', { locale: ar }) : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
