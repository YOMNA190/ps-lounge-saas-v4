import { supabase } from '@/lib/supabase'
import { Tournament, TournamentParticipant, TournamentMatch } from '@/types'
import { sanitizeError } from '@/lib/errors'

export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createTournament(t: Omit<Tournament, 'id' | 'created_at' | 'current_players'>): Promise<Tournament> {
  const { data, error } = await supabase.from('tournaments').insert(t).select().single()
  if (error) throw error
  return data
}

export async function getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const { data, error } = await supabase.from('tournament_participants').select(`*,customer:customers(*)`).eq('tournament_id', tournamentId).order('registered_at')
  if (error) throw error
  return data || []
}

export async function registerParticipant(p: Omit<TournamentParticipant, 'id' | 'registered_at'>): Promise<TournamentParticipant> {
  const { data, error } = await supabase.from('tournament_participants').insert(p).select().single()
  if (error) throw error
  return data
}

export async function getTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const { data, error } = await supabase.from('tournament_matches').select(`*,player1:tournament_participants(*),player2:tournament_participants(*),winner:tournament_participants(*)`).eq('tournament_id', tournamentId).order('round').order('match_number')
  if (error) throw error
  return data || []
}

export async function generateBracket(tournamentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('generate_bracket', { p_tournament_id: tournamentId })
  if (error) throw new Error(sanitizeError(error).message)
  return data as number
}

export async function updateMatch(matchId: string, updates: Partial<TournamentMatch>): Promise<TournamentMatch> {
  const { data, error } = await supabase.from('tournament_matches').update(updates).eq('id', matchId).select().single()
  if (error) throw error
  return data
}
