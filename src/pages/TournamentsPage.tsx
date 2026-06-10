import { useState } from 'react'
import { useTournaments } from '@/hooks/useTournaments'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Tournament } from '@/types'
import { Trophy, Plus, Calendar, Users, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { useBranch } from '@/lib/branch-context'

export default function TournamentsPage() {
  const { tournaments, loading, refetch } = useTournaments()
  const { isAdmin } = useAuth()
  const { branchId } = useBranch()
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [game, setGame] = useState('FIFA 26')
  const [startDate, setStartDate] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('16')

  const handleCreate = async () => {
    if (!branchId) return
    const { error } = await supabase.from('tournaments').insert({
      name, game, start_date: startDate || new Date().toISOString(), max_players: Number(maxPlayers), branch_id: branchId
    })
    if (error) toast.error('فشل الإنشاء')
    else { toast.success('تم إنشاء البطولة'); setShowAdd(false); refetch() }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-ps-text flex items-center gap-2"><Trophy size={22} />البطولات</h1></div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} />جديدة</button>
      </div>

      {loading ? <Loader2 size={20} className="animate-spin" /> : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <div key={t.id} className="rounded-xl p-4 cursor-pointer card-hover" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }} onClick={() => navigate(`/tournaments/${t.id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-ps-muted">{t.game}</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-md font-semibold" style={{ background: t.status === 'in_progress' ? 'rgba(0,229,160,0.1)' : 'var(--ps-surface)', color: t.status === 'in_progress' ? 'var(--ps-green)' : 'var(--ps-muted)' }}>{t.status}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-ps-muted">
                <span className="flex items-center gap-1"><Calendar size={10} />{new Date(t.start_date).toLocaleDateString('ar-EG')}</span>
                <span className="flex items-center gap-1"><Users size={10} />{t.current_players}/{t.max_players}</span>
                <span>{t.prize_pool} ج</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <h2 className="font-bold">بطولة جديدة</h2>
            <input className="input" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="اللعبة" value={game} onChange={e => setGame(e.target.value)} />
            <input className="input" type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <input className="input" type="number" placeholder="الحد الأقصى للاعبين" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} />
            <div className="flex gap-3"><button onClick={() => setShowAdd(false)} className="btn-ghost flex-1">إلغاء</button><button onClick={handleCreate} className="btn-primary flex-1">إنشاء</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
