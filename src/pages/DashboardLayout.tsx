import { useState } from 'react'
import { Outlet, NavLink } from 'react-router'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutGrid, ClipboardList, Package, Clock, Tag, Wifi, Users,
  BarChart3, Receipt, LogOut, Menu, X, ShieldCheck, Settings2,
  BookOpen, Trophy, ListOrdered, Bell, CreditCard, MonitorPlay
} from 'lucide-react'
import { toast } from 'sonner'

const navItems = [
  { to: '/', label: 'الأجهزة', icon: LayoutGrid, end: true },
  { to: '/sessions', label: 'الجلسات', icon: ClipboardList },
  { to: '/inventory', label: 'البضاعة', icon: Package },
  { to: '/shifts', label: 'الشيفتات', icon: Clock },
  { to: '/packages', label: 'الباقات', icon: Tag },
  { to: '/cards', label: 'كروت النت', icon: Wifi },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/waitlist', label: 'قائمة الانتظار', icon: ListOrdered },
  { to: '/subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { to: '/tournaments', label: 'البطولات', icon: Trophy },
  { to: '/debts', label: 'الديون', icon: BookOpen },
  { to: '/analytics', label: 'التحليلات', icon: BarChart3, adminOnly: true },
  { to: '/expenses', label: 'المصاريف', icon: Receipt, adminOnly: true },
  { to: '/audit-log', label: 'سجل التدقيق', icon: Bell, adminOnly: true },
  { to: '/settings', label: 'الإعدادات', icon: Settings2, adminOnly: true },
]

export default function DashboardLayout() {
  const { profile, isAdmin, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const visibleNav = navItems.filter(item => !item.adminOnly || isAdmin)

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--ps-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(0,87,255,0.2),rgba(61,139,255,0.1))', border: '1px solid rgba(0,87,255,0.3)' }}>
            <MonitorPlay size={18} style={{ color: 'var(--ps-blue-light)' }} />
          </div>
          <div>
            <p className="font-bold text-lg text-ps-text leading-none">PS Lounge</p>
            <p className="text-[10px] text-ps-muted font-mono">MANAGER v4</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'text-[var(--ps-blue-light)]' : 'text-ps-muted hover:text-ps-text'}`
            }
            style={({ isActive }) => isActive ? {
              background: 'rgba(0,87,255,0.1)', border: '1px solid rgba(0,87,255,0.18)'
            } : { background: 'transparent', border: '1px solid transparent' }}>
            <item.icon size={17} />
            <span className="flex-1">{item.label}</span>
            {item.adminOnly && <ShieldCheck size={12} style={{ color: 'var(--ps-gold)', opacity: 0.7 }} />}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--ps-border)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,rgba(0,87,255,0.2),rgba(155,109,255,0.2))', border: '1px solid rgba(0,87,255,0.3)', color: 'var(--ps-blue-light)' }}>
            {(profile?.name || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ps-text truncate leading-none">{profile?.name || 'مستخدم'}</p>
            <p className="text-[10px] text-ps-muted font-mono">{isAdmin ? '◆ ADMIN' : '◈ STAFF'}</p>
          </div>
        </div>
        <button onClick={() => { signOut(); toast.success('تم تسجيل الخروج') }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-ps-muted hover:text-[var(--ps-red)] transition-all hover:bg-red-500/5">
          <LogOut size={15} />تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ps-darker)' }}>
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0" style={{ background: 'var(--ps-card)', borderLeft: '1px solid var(--ps-border)' }}>
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col animate-slide-up mr-auto" style={{ background: 'var(--ps-card)', borderLeft: '1px solid var(--ps-border)' }}>
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 left-4 btn-ghost p-1.5 z-10"><X size={18} /></button>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--ps-card)', borderColor: 'var(--ps-border)' }}>
          <div className="flex items-center gap-2">
            <MonitorPlay size={18} style={{ color: 'var(--ps-blue-light)' }} />
            <span className="font-bold tracking-wide">PS Lounge</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2"><Menu size={20} /></button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
