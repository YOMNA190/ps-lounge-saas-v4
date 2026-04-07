import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

export function requireAdmin(role: string | undefined | null)           { return role === 'admin' }
export function requireStaff(role: string | undefined | null)           { return role === 'admin' || role === 'staff' }
export function canAccessFinancialData(role: string | undefined | null) { return requireAdmin(role) }
export function canManageSessions(role: string | undefined | null)      { return requireStaff(role) }
export function canViewAuditLogs(role: string | undefined | null)       { return requireAdmin(role) }

interface AuthContextValue {
  user:               User | null
  profile:            Profile | null
  session:            Session | null
  loading:            boolean
  isAdmin:            boolean
  isStaff:            boolean
  canAccessFinancial: boolean
  canManageSession:   boolean
  canViewAudit:       boolean
  signIn:         (email: string, password: string)              => Promise<{ error: AuthError | null }>
  signUp:         (email: string, password: string, name: string)=> Promise<{ error: AuthError | null }>
  signOut:        ()                                             => Promise<void>
  resetPassword:  (email: string)                                => Promise<{ error: AuthError | null }>
  updatePassword: (newPassword: string)                          => Promise<{ error: AuthError | null }>
  refreshProfile: ()                                             => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Retry fetch — handles race condition after signUp trigger
  const fetchProfile = async (userId: string, retries = 5): Promise<void> => {
    for (let i = 0; i < retries; i++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data) {
        setProfile(data as Profile)
        return
      }

      // Profile not yet created by trigger → wait and retry
      if (error?.code === 'PGRST116' && i < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)))
        continue
      }
      break
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        // PASSWORD_RECOVERY event — just set user, don't fetch profile yet
        if (event === 'PASSWORD_RECOVERY') {
          setLoading(false)
          return
        }
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        // Email confirm URL — change to your domain in production
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    return { error }
  }

  const signOut = async () => {
    setProfile(null)
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  const role = profile?.role
  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      isAdmin:            requireAdmin(role),
      isStaff:            requireStaff(role),
      canAccessFinancial: canAccessFinancialData(role),
      canManageSession:   canManageSessions(role),
      canViewAudit:       canViewAuditLogs(role),
      signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
