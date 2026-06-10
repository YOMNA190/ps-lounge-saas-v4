import { supabase } from '@/lib/supabase'
import { WaitlistEntry } from '@/types'

export async function getWaitlist(status?: string): Promise<WaitlistEntry[]> {
  let q = supabase.from('waitlist').select(`*,customer:customers(*)`).order('created_at', { ascending: true })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function addToWaitlist(entry: Omit<WaitlistEntry, 'id' | 'created_at' | 'notified_at'>): Promise<WaitlistEntry> {
  const { data, error } = await supabase.from('waitlist').insert(entry).select().single()
  if (error) throw error
  return data
}

export async function updateWaitlistEntry(id: string, updates: Partial<WaitlistEntry>): Promise<WaitlistEntry> {
  const { data, error } = await supabase.from('waitlist').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function removeFromWaitlist(id: string): Promise<void> {
  const { error } = await supabase.from('waitlist').delete().eq('id', id)
  if (error) throw error
}
