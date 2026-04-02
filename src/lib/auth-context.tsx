import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

// ─────────────────────────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL HELPERS
// Use these instead of loose string comparisons like role === 'admin'
// ─────────────────────────────────────────────────────────────

/**
 * Type guard: Check if user has admin role
 */
export function requireAdmin(role: string | undefined | null): boolean {
  return role === 'admin'
}

/**
 * Type guard: Check if user has staff or admin role
 */
export function requireStaff(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'staff'
}

/**
 * Type guard: Check if user can access financial data
 * Only admins can view financial reports and audit logs
 */
export function canAccessFinancialData(role: string | undefined | null): boolean {
  return requireAdmin(role)
}

/**
 * Type guard: Check if user can start/stop sessions
 * Staff and admins can manage sessions
 */
export function canManageSessions(role: string | undefined | null): boolean {
  return requireStaff(role)
}

/**
 * Type guard: Check if user can view audit logs
 * Only admins can access audit trails for fraud detection
 */
export function canViewAuditLogs(role: string | undefined | null): boolean {
  return requireAdmin(role)
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  isStaff: boolean
  canAccessFinancial: boolean
  canManageSession: boolean
  canViewAudit: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const role = profile?.role

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      isAdmin: requireAdmin(role),
      isStaff: requireStaff(role),
      canAccessFinancial: canAccessFinancialData(role),
      canManageSession: canManageSessions(role),
      canViewAudit: canViewAuditLogs(role),
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
