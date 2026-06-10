import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSearchParams, useNavigate } from 'react-router'
import { KeyRound, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const { resetPassword, updatePassword } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [newPass, setNewPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const isRecovery = searchParams.has('type') || searchParams.has('access_token')

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    const { error } = await resetPassword(email)
    setMessage(error ? error.message : 'تم إرسال الرابط')
    setLoading(false)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    const { error } = await updatePassword(newPass)
    setMessage(error ? error.message : 'تم التغيير')
    if (!error) setTimeout(() => navigate('/login'), 1500)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--ps-darker)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center"><KeyRound size={32} className="mx-auto" style={{ color: 'var(--ps-blue-light)' }} /><h1 className="text-xl font-bold mt-2">{isRecovery ? 'كلمة مرور جديدة' : 'نسيت كلمة المرور'}</h1></div>
        <form onSubmit={isRecovery ? handleUpdate : handleSend} className="space-y-4">
          {isRecovery ? <input className="input" type="password" placeholder="كلمة المرور الجديدة" value={newPass} onChange={e => setNewPass(e.target.value)} minLength={6} required dir="ltr" /> : <input className="input" type="email" placeholder="البريد" value={email} onChange={e => setEmail(e.target.value)} required dir="ltr" />}
          {message && <p className="text-sm text-center" style={{ color: message.includes('خطأ') ? 'var(--ps-red)' : 'var(--ps-green)' }}>{message}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? <Loader2 size={16} className="animate-spin" /> : isRecovery ? 'تحديث' : 'إرسال'}</button>
        </form>
      </div>
    </div>
  )
}
