import React from 'react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,87,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,87,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '52px 52px',
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,87,255,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(155,109,255,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />

      <div className="relative w-full max-w-sm animate-fade-in">

        {/* Logo mark */}
        <div className="text-center mb-10">
          <div className="inline-block relative mb-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, rgba(0,87,255,0.15), rgba(61,139,255,0.08))',
                border: '1px solid rgba(0,87,255,0.3)',
                boxShadow: '0 0 40px rgba(0,87,255,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {/* PS logo shape */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M8 28 L8 12 L18 12 Q26 12 26 18 Q26 22 22 23 L26 28" stroke="#3d8bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M14 28 Q14 32 20 32 Q32 32 32 24 Q32 20 26 20" stroke="#9b6dff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7"/>
              </svg>
            </div>
          </div>
          <h1 className="font-display text-5xl tracking-[0.12em] text-ps-text mb-1">PS LOUNGE</h1>
          <p className="text-ps-muted text-sm font-light tracking-wider">نظام إدارة قاعة البلايستيشن</p>
        </div>

        {/* Form */}
        <div className="card p-8"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)' }}
        >
          <h2 className="text-lg font-semibold mb-6 text-ps-text">تسجيل الدخول</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input
                type="email" className="input" placeholder="admin@lounge.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required dir="ltr"
              />
            </div>

            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input" placeholder="••••••••"
                  style={{ paddingLeft: '2.8rem' }}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required dir="ltr"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ps-muted hover:text-ps-text transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm animate-slide-up"
                style={{ background: 'rgba(255,61,90,0.08)', border: '1px solid rgba(255,61,90,0.2)', color: 'var(--ps-red)' }}
              >
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full h-11 mt-2 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  جاري الدخول...
                </span>
              ) : 'دخول'}
            </button>
          </form>
        </div>

        <p className="text-center text-ps-muted text-xs mt-5 font-mono tracking-wider opacity-50">
          PS LOUNGE v2.0 · POWERED BY SUPABASE
        </p>
      </div>
    </div>
  )
}
