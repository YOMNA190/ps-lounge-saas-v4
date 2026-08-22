import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, X } from 'lucide-react'

export default function AlertsBell() {
  const [alerts, setAlerts] = useState<{ id: number; title: string; message: string; is_read: boolean }[]>([])
  const [show, setShow] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('alerts').select('*').eq('is_read', false).order('created_at', { ascending: false }).limit(10)
    setAlerts(data || [])
  }

  useEffect(() => {
    void load()
    const sub = supabase.channel('alerts').on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, load).subscribe()
    return () => { void sub.unsubscribe() }
  }, [])

  const markRead = async (id: number) => {
    await supabase.from('alerts').update({ is_read: true }).eq('id', id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="relative">
      <button onClick={() => setShow(!show)} className="btn-ghost p-2 relative">
        <Bell size={18} />
        {alerts.length > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{alerts.length}</span>}
      </button>
      {show && (
        <div className="absolute top-full left-0 mt-2 w-72 rounded-xl shadow-2xl z-50" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
          {alerts.length === 0 ? <p className="text-center py-4 text-sm text-ps-muted">لا توجد تنبيهات</p> : (
            <div className="divide-y" style={{ borderColor: 'var(--ps-border)' }}>
              {alerts.map(a => (
                <div key={a.id} className="flex items-start gap-2 p-3">
                  <div className="flex-1"><p className="text-xs font-semibold">{a.title}</p><p className="text-[10px] text-ps-muted">{a.message}</p></div>
                  <button onClick={() => markRead(a.id)} className="btn-ghost p-0.5 flex-shrink-0"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
