import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Link } from 'react-router'
import { Gamepad2, Mail, Lock, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = isSignUp ? await signUp(email, password, name) : await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--ps-darker)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(0,87,255,0.2),rgba(61,139,255,0.1))', border: '1px solid rgba(0,87,255,0.3)' }}>
            <Gamepad2 size={32} style={{ color: 'var(--ps-blue-light)' }} />
          </div>
          <h1 className="text-2xl font-bold text-ps-text tracking-tight">PS Lounge</h1>
          <p className="text-sm text-ps-muted">{isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && <div><label className="label">الاسم</label><input className="input" placeholder="اسمك" value={name} onChange={e => setName(e.target.value)} required /></div>}
          <div><label className="label">البريد</label><input className="input" type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" required /></div>
          <div><label className="label">كلمة المرور</label><input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" required minLength={6} /></div>
          {error && <p className="text-sm text-center" style={{ color: 'var(--ps-red)' }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? <Loader2 size={16} className="animate-spin" /> : isSignUp ? 'إنشاء' : 'دخول'}</button>
        </form>
        <div className="text-center text-sm">
          <button onClick={() => { setIsSignUp(!isSignUp); setError('') }} className="text-[var(--ps-blue-light)] hover:underline">{isSignUp ? 'لديك حساب؟' : 'ليس لديك حساب؟'}</button>
        </div>
        {!isSignUp && <div className="text-center text-xs"><Link to="/reset-password" className="text-ps-muted hover:text-ps-text">نسيت كلمة المرور؟</Link></div>}
      </div>
    </div>
  )
}
