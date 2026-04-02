import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth-context'
import LoginPage      from './pages/LoginPage'
import DashboardLayout from './pages/DashboardLayout'
import DevicesPage    from './pages/DevicesPage'
import SessionsPage   from './pages/SessionsPage'
import CustomersPage  from './pages/CustomersPage'
import AnalyticsPage  from './pages/AnalyticsPage'
import ExpensesPage   from './pages/ExpensesPage'
import InventoryPage  from './pages/InventoryPage'
import ShiftsPage     from './pages/ShiftsPage'
import PackagesPage   from './pages/PackagesPage'

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ps-darker)' }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index              element={<DevicesPage />} />
        <Route path="sessions"   element={<SessionsPage />} />
        <Route path="inventory"  element={<InventoryPage />} />
        <Route path="shifts"     element={<ShiftsPage />} />
        <Route path="packages"   element={<PackagesPage />} />
        <Route path="customers"  element={<CustomersPage />} />
        <Route path="analytics"  element={<ProtectedRoute adminOnly><AnalyticsPage /></ProtectedRoute>} />
        <Route path="expenses"   element={<ProtectedRoute adminOnly><ExpensesPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
