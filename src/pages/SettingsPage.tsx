import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useBranch } from '@/lib/branch-context'
import { Settings2, Save } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { profile } = useAuth()
  const { branch, refetch } = useBranch()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (branch) { setName(branch.name); setAddress(branch.address || ''); setPhone(branch.phone || '') }
  }, [branch])

  const handleSave = async () => {
    if (!branch) return
    setSaving(true)
    const { error } = await supabase.from('branches').update({ name, address, phone }).eq('id', branch.id)
    if (error) toast.error('فشل الحفظ')
    else { toast.success('تم الحفظ'); refetch() }
    setSaving(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2"><Settings2 size={20} style={{ color: 'var(--ps-blue-light)' }} /><h1 className="text-2xl font-bold">الإعدادات</h1></div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <h2 className="font-semibold">بيانات المحل</h2>
        <div><label className="label">الاسم</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="label">العنوان</label><input className="input" value={address} onChange={e => setAddress(e.target.value)} /></div>
        <div><label className="label">التليفون</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" /></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary"><Save size={14} />{saving ? 'جاري...' : 'حفظ'}</button>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--ps-card)', border: '1px solid var(--ps-border)' }}>
        <h2 className="font-semibold mb-2">الحساب</h2>
        <p className="text-sm text-ps-muted">{profile?.name}</p>
        <p className="text-sm text-ps-muted font-mono">{profile?.role === 'admin' ? 'مدير' : 'موظف'}</p>
      </div>
    </div>
  )
}
