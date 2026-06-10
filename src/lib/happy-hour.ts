import { supabase } from '@/lib/supabase'
import { HappyHour, HappyHourCheck } from '@/types'

export async function getHappyHours(): Promise<HappyHour[]> {
  const { data, error } = await supabase.from('happy_hours').select('*').order('day_of_week')
  if (error) throw error
  return data || []
}

export async function createHappyHour(entry: Omit<HappyHour, 'id' | 'created_at'>): Promise<HappyHour> {
  const { data, error } = await supabase.from('happy_hours').insert(entry).select().single()
  if (error) throw error
  return data
}

export async function updateHappyHour(id: number, updates: Partial<HappyHour>): Promise<HappyHour> {
  const { data, error } = await supabase.from('happy_hours').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteHappyHour(id: number): Promise<void> {
  const { error } = await supabase.from('happy_hours').delete().eq('id', id)
  if (error) throw error
}

export async function checkHappyHour(deviceType: string): Promise<HappyHourCheck> {
  const { data, error } = await supabase.rpc('check_happy_hour', { p_device_type: deviceType })
  if (error) throw error
  return data as unknown as HappyHourCheck
}
