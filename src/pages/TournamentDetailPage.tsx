import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useTournamentDetail } from '@/hooks/useTournaments'
import { supabase } from '@/lib/supabase'
import { TournamentParticipant, TournamentMatch } from '@/types'
import { Trophy, ArrowRight, Users, Play, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import RegisterPlayerModal from '@/components/tournaments/RegisterPlayerModal'

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { participants, matches, loading, refetch } = useTournamentDetail(id!)
  const [showRegister, setShowRegister] = useState(false)
  const [activeMatch, setActiveMatch] = useState<TournamentMatch | null>(null)
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--ps-blue-light)]" /></div>

  const groupedMatches = matches.reduce<Record<number, TournamentMatch[]>>((acc, m) => {
    if (!acc[m.round]) acc[m.round] = []
    acc[m.round].push(m)
    return acc
  }, {})

  const handleSetWinner = async (matchId: string, winnerId: string) => {
    await supabase.from('tournament_matches').update({ winner_id: winnerId, status: 'completed', completed_at: new Date().toISOString() }).eq('id', matchId)
    refetch()
  }

  const handleScore = async () => {
    if (!activeMatch) return
    await supabase.from('tournament_matches').update({ player1_score: Number(s1), player2_score: Number(s2), status: 'completed' }).eq('id', activeMatch.id)
    setActiveMatch(null); setS1(''); setS2('')
    refetch()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Link to="/tournaments" className="text-sm text-ps-muted hover:text-ps-text flex items-center gap-1"><ArrowRight size={14} />البطولات</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Trophy size={20} style={{ color: 'var(--ps-gold)' }} />تفاصيل البطولة</h1>
        <button onClick={() => setShowRegister(true)} className="btn-primary text-xs"><Users size={12} />تسجيل لاعب</button>
      </div>

      <div className="flex items-center gap-2 text-sm text-ps-muted">
        <span>{participants.length} لاعب</span>
        <button onClick={async () => { await supabase.rpc('generate_bracket', { p_tournament_id: id }); toast.success('تم توليد المباريات'); refetch() }} className="btn-outline text-xs py-1 px-2"><Play size={10} />بدء البطولة</button>
      </div>

      {Object.entries(groupedMatches).sort(([a], [b]) => Number(a) - Number(b)).map(([round, ms]) => (
        <div key={round}>
          <h3 className="text-sm font-semibold text-ps-muted mb-2">الجولة {round}</h3>
          <div className="space-y-2">
            {ms.map(m => (
              <div key={m.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
                <div className="flex-1 flex items-center justify-between">
                  <span className={`text-sm ${m.winner_id === m.player1_id ? 'font-bold text-[var(--ps-green)]' : ''}`}>{m.player1?.player_name || '—'}</span>
                  <span className="font-mono text-xs mx-2">{m.player1_score ?? '-'} : {m.player2_score ?? '-'}</span>
                  <span className={`text-sm ${m.winner_id === m.player2_id ? 'font-bold text-[var(--ps-green)]' : ''}`}>{m.player2?.player_name || '—'}</span>
                </div>
                {m.status === 'pending' && m.player1_id && m.player2_id && (
                  <button onClick={() => setActiveMatch(m)} className="btn-outline text-xs py-1 px-2">نتيجة</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {showRegister && <RegisterPlayerModal tournamentId={id!} onClose={() => setShowRegister(false)} onRegistered={() => { setShowRegister(false); refetch() }} />}

      {activeMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setActiveMatch(null)} />
          <div className="relative w-full max-w-sm rounded-2xl p-5 space-y-4 animate-scale-in" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
            <h3 className="font-bold text-center">تسجيل النتيجة</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center"><p className="text-sm mb-1">{activeMatch.player1?.player_name}</p><input className="input text-center" type="number" value={s1} onChange={e => setS1(e.target.value)} /></div>
              <span className="text-ps-muted">VS</span>
              <div className="flex-1 text-center"><p className="text-sm mb-1">{activeMatch.player2?.player_name}</p><input className="input text-center" type="number" value={s2} onChange={e => setS2(e.target.value)} /></div>
            </div>
            <div className="flex gap-3"><button onClick={() => setActiveMatch(null)} className="btn-ghost flex-1">إلغاء</button><button onClick={handleScore} className="btn-primary flex-1">حفظ</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
