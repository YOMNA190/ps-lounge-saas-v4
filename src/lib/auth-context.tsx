import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

export function requireAdmin(role: string | undefined | null)          { return role === 'admin' }
export function requireStaff(role: string | undefined | null)          { return role === 'admin' || role === 'staff' }
export function canAccessFinancialData(role: string | undefined | null){ return requireAdmin(role) }
export function canManageSessions(role: string | undefined | null)     { return requireStaff(role) }
export function canViewAuditLogs(role: string | undefined | null)      { return requireAdmin(role) }

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
  signIn:         (email: string, password: string)  => Promise<{ error: Error | null }>
  signUp:         (email: string, password: string, name: string) => Promise<{ error: Error | null }>
  signOut:        ()                                 => Promise<void>
  resetPassword:  (email: string)                    => Promise<{ error: Error | null }>
  updatePassword: (newPassword: string)              => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfile(null)
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      }
      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true)
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
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
      email, password,
      options: { data: { name } },
    })
    return { error }
  }

  const signOut = async () => { await supabase.auth.signOut() }

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

  const role = profile?.role
  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      isAdmin:            requireAdmin(role),
      isStaff:            requireStaff(role),
      canAccessFinancial: canAccessFinancialData(role),
      canManageSession:   canManageSessions(role),
      canViewAudit:       canViewAuditLogs(role),
      signIn, signUp, signOut, resetPassword, updatePassword,
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
