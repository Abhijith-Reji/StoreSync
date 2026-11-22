import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';
import { UserRole } from '../../config/constants';
import { ThemeToggle } from '../../shared/components/ThemeToggle';
import logoImg from '../../assets/storesync-logo.png';

export const LoginView: React.FC = () => {
  const [username, setUsername] = useState('cashier1');
  const [password, setPassword] = useState('Cashier@123');
  const [counterId, setCounterId] = useState('COUNTER-01');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(username, password, counterId);
      // Automatic role-based routing
      if (user.role === UserRole.OWNER || user.role === UserRole.MANAGER) {
        navigate('/dashboard');
      } else {
        navigate('/pos');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.response?.data?.error || err.message || 'Invalid username or password';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-between bg-slate-50 p-6 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 select-none">
      {/* Top Bar with Theme Switcher */}
      <div className="flex w-full max-w-5xl justify-end">
        <ThemeToggle />
      </div>

      {/* Main Login Card Container */}
      <div className="flex w-full max-w-md flex-col items-center">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logoImg}
            alt="StoreSync Logo"
            className="h-20 w-20 object-contain drop-shadow-md mb-3"
          />
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Store<span className="text-emerald-600 dark:text-emerald-500">Sync</span>
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">
            INVENTORY • POINT OF SALE • ALWAYS IN SYNC
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-[#111827] dark:shadow-none">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sign in with your credentials to access the POS terminal.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. cashier1 or owner"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Counter ID
              </label>
              <input
                type="text"
                required
                value={counterId}
                onChange={(e) => setCounterId(e.target.value)}
                placeholder="COUNTER-01"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500">
        StoreSync • Retail operations, always in sync.
      </div>
    </div>
  );
};
