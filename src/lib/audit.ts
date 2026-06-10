import { supabase } from '@/lib/supabase'
import { AuditLogEntry } from '@/types'

export async function getAuditLog(filters?: { action?: string; staffId?: string; fromDate?: string; toDate?: string }): Promise<AuditLogEntry[]> {
  let q = supabase.from('audit_log').select(`*, staff:profiles(name)`).order('created_at', { ascending: false })

  if (filters?.action) q = q.eq('action', filters.action)
  if (filters?.staffId) q = q.eq('staff_id', filters.staffId)
  if (filters?.fromDate) q = q.gte('created_at', filters.fromDate)
  if (filters?.toDate) q = q.lte('created_at', filters.toDate + 'T23:59:59')

  const { data, error } = await q.limit(500)
  if (error) throw error

  return (data || []).map((row: unknown) => {
    const r = row as Record<string, unknown>
    return {
      ...(r as unknown as AuditLogEntry),
      staff_name: (r.staff as { name?: string } | null)?.name ?? '—',
    }
  })
}

export async function getStaffList(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('profiles').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export function exportAuditLogToCSV(entries: AuditLogEntry[]): string {
  const headers = ['Date', 'Staff', 'Action', 'Table', 'Record ID', 'Notes']
  const rows = entries.map(e => [
    new Date(e.created_at).toLocaleString('ar-EG'),
    e.staff_name ?? '—',
    e.action,
    e.table_name,
    e.record_id,
    e.notes ?? '',
  ])
  return [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
}
