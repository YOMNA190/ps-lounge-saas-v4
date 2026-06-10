import { useState, useEffect, useCallback } from 'react'
import { Tournament, TournamentParticipant, TournamentMatch } from '@/types'
import { getTournaments, getTournamentParticipants, getTournamentMatches } from '@/lib/tournaments'

export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const data = await getTournaments()
    setTournaments(data); setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { tournaments, loading, refetch: fetch }
}

export function useTournamentDetail(tournamentId: string) {
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [p, m] = await Promise.all([getTournamentParticipants(tournamentId), getTournamentMatches(tournamentId)])
    setParticipants(p); setMatches(m); setLoading(false)
  }, [tournamentId])

  useEffect(() => { fetch() }, [fetch])

  return { participants, matches, loading, refetch: fetch }
}
