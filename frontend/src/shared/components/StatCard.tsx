import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string; // e.g. "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  trend?: {
    value: string;
    positive?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  trend,
}) => {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-150 hover:border-slate-300 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-slate-700">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBgColor}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
          {value}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {trend && (
            <span
              className={`font-semibold ${
                trend.positive !== false
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      </div>
    </div>
  );
};
