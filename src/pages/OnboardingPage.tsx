import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'

export default function OnboardingPage({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      const { error } = await supabase.rpc('setup_new_branch', { p_user_id: user.id, p_branch_name: name.trim(), p_address: address.trim() || null, p_phone: phone.trim() || null })
      if (error) throw error
      toast.success('تم الإعداد!')
      onDone()
    } catch (err) { toast.error('فشل: ' + String(err)) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--ps-darker)' }}>
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center"><Building2 size={40} className="mx-auto" style={{ color: 'var(--ps-blue-light)' }} /><h1 className="text-2xl font-bold mt-2">أهلاً بيك!</h1><p className="text-sm text-ps-muted">أدخل بيانات المحل</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" placeholder="اسم المحل *" value={name} onChange={e => setName(e.target.value)} required />
          <input className="input" placeholder="العنوان" value={address} onChange={e => setAddress(e.target.value)} />
          <input className="input" placeholder="التليفون" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" />
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? <Loader2 size={16} className="animate-spin" /> : 'ابدأ'}</button>
        </form>
      </div>
    </div>
  )
}
