import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Branch } from '@/types'
import { useAuth } from '@/lib/auth-context'

interface BranchContextValue {
  branch: Branch | null
  branchId: string | null
  loading: boolean
  refetch: () => void
}

const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading } = useAuth()
  const [branch, setBranch]   = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchBranch = async (branchId: string) => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single()
    setBranch(data)
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    const branchId = (profile as { branch_id?: string | null })?.branch_id
    if (branchId) {
      fetchBranch(branchId)
    } else {
      setLoading(false)
    }
  }, [profile, authLoading])

  return (
    <BranchContext.Provider value={{
      branch,
      branchId: (profile as { branch_id?: string | null })?.branch_id ?? null,
      loading,
      refetch: () => {
        const branchId = (profile as { branch_id?: string | null })?.branch_id
        if (branchId) fetchBranch(branchId)
      },
    }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch must be inside BranchProvider')
  return ctx
}
