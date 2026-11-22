import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Users,
  Calendar,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useAuth } from '../core/auth/useAuth';
import { useOnlineStatus } from '../shared/hooks/useOnlineStatus';
import { ThemeToggle } from '../shared/components/ThemeToggle';
import { UserRole } from '../config/constants';
import logoImg from '../assets/storesync-logo.png';

interface DesktopShellProps {
  children: React.ReactNode;
  title: string;
}

export const DesktopShell: React.FC<DesktopShellProps> = ({ children, title }) => {
  const { user, logout, counterId } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  // Role-filtered navigation definition
  const allNavItems = [
    {
      label: 'Stock Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: [UserRole.OWNER, UserRole.MANAGER],
    },
    {
      label: 'POS Counter',
      path: '/pos',
      icon: ShoppingCart,
      roles: [UserRole.OWNER, UserRole.MANAGER, UserRole.SALESPERSON],
    },
    {
      label: 'Products & Stock',
      path: '/products',
      icon: Package,
      roles: [UserRole.OWNER, UserRole.MANAGER],
    },
    {
      label: 'Categories',
      path: '/categories',
      icon: Layers,
      roles: [UserRole.OWNER, UserRole.MANAGER],
    },
    {
      label: 'Staff Management',
      path: '/staff',
      icon: Users,
      roles: [UserRole.OWNER],
    },
    {
      label: "Today's Sales",
      path: '/sales',
      icon: Calendar,
      roles: [UserRole.SALESPERSON],
    },
  ];

  const userRole = user?.role || UserRole.SALESPERSON;
  const navItems = allNavItems.filter((item) => item.roles.includes(userRole));

  // Dynamic counter label
  const activeCounter = user?.counterId || counterId || 'COUNTER-01';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 antialiased dark:bg-[#0B0F19] dark:text-slate-100 select-none">
      {/* 1. Fixed Collapsible Left Sidebar */}
      <aside
        className={`flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827] transition-all duration-200 z-20 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Top: Logo & App Title */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src={logoImg}
              alt="StoreSync Logo"
              className="h-9 w-9 min-w-9 object-contain"
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-none">
                  Store<span className="text-emerald-600 dark:text-emerald-500">Sync</span>
                </span>
                <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                  POS & Inventory
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                to={item.path}
                key={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-5 w-5 min-w-5" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom: User Profile & Logout */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            {!collapsed ? (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-9 w-9 min-w-9 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {user?.fullName || 'Active Staff'}
                  </span>
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {user?.role || 'User'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            )}

            <button
              onClick={handleSignOut}
              title="Sign out of StoreSync"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content & App Frame */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Compact Top Bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-[#111827] z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Dynamic Counter Pill */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{activeCounter.replace('-', ' ')}</span>
            </div>

            {/* Local DB Sync Indicator */}
            <div
              title="Local SQLite & Postgres Sync Active"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400"
            >
              <Database className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-medium">Local DB</span>
            </div>

            {/* Light / Dark Mode Toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* 
          Main Viewport Content Area
          Set to flex-1 overflow-hidden so Dashboard can scroll internally
          while POS two-pane layout pins cleanly at 100% height!
        */}
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>

        {/* Thin Bottom Status Bar */}
        <footer className="flex h-7 items-center justify-between border-t border-slate-200 bg-white px-4 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-[#111827] dark:text-slate-400 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'
                }`}
              ></span>
              <span className="font-medium">
                {isOnline ? 'API Connected (localhost:3000)' : 'API Offline (Local Buffer)'}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Active Counter: <strong className="text-slate-700 dark:text-slate-300">{activeCounter}</strong></span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline">
              <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[10px] font-mono dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                F2
              </kbd>{' '}
              Scan Barcode
            </span>
            <span className="hidden md:inline">
              <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[10px] font-mono dark:border-slate-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                F8
              </kbd>{' '}
              Complete Sale
            </span>
            <span className="text-slate-400 dark:text-slate-600 font-mono text-[10px]">v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
