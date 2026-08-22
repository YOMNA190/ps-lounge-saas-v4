import { Routes, Route, Navigate } from 'react-router'
import { useAuth } from './lib/auth-context'
import { useBranch } from './lib/branch-context'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardLayout from './pages/DashboardLayout'
import DevicesPage from './pages/DevicesPage'
import SessionsPage from './pages/SessionsPage'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ExpensesPage from './pages/ExpensesPage'
import InventoryPage from './pages/InventoryPage'
import ShiftsPage from './pages/ShiftsPage'
import PackagesPage from './pages/PackagesPage'
import CardsPage from './pages/CardsPage'
import SettingsPage from './pages/SettingsPage'
import DebtsPage from './pages/DebtsPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import TournamentsPage from './pages/TournamentsPage'
import TournamentDetailPage from './pages/TournamentDetailPage'
import WaitlistPage from './pages/WaitlistPage'
import AuditLogPage from './pages/AuditLogPage'
import CustomerPortalPage from './pages/CustomerPortalPage'
import PublicDisplayPage from './pages/PublicDisplayPage'
import CaseStudyPage from './pages/CaseStudyPage'
import { Suspense } from 'react'

function Spinner() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--ps-darker)' }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
      <p style={{ color: 'var(--ps-muted)', fontSize: 12, fontFamily: 'monospace', marginTop: 16 }}>PS LOUNGE</p>
    </div>
  )
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, loading: authLoading } = useAuth()
  const { loading: branchLoading } = useBranch()

  if (authLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Spinner />
  if (branchLoading) return <Spinner />
  if (!profile.branch_id) return <OnboardingPage onDone={() => window.location.reload()} />
  if (adminOnly && profile.role !== 'admin') return <Navigate to="/" replace />

  return <Suspense fallback={<Spinner />}>{children}</Suspense>
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />

  return (
    <Routes>
      {/* Public - no auth */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/portal/:customerPhone" element={<CustomerPortalPage />} />
      <Route path="/display" element={<PublicDisplayPage />} />
      <Route path="/case-study" element={<CaseStudyPage />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<DevicesPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="cards" element={<CardsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="debts" element={<DebtsPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="waitlist" element={<WaitlistPage />} />
        <Route path="tournaments" element={<TournamentsPage />} />
        <Route path="tournaments/:id" element={<TournamentDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="analytics" element={<ProtectedRoute adminOnly><AnalyticsPage /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute adminOnly><ExpensesPage /></ProtectedRoute>} />
        <Route path="audit-log" element={<ProtectedRoute adminOnly><AuditLogPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
