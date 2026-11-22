import React from 'react';
import { Construction } from 'lucide-react';
import { DesktopShell } from '../../layouts/DesktopShell';

interface PlaceholderViewProps {
  title: string;
  moduleName: string;
  description: string;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  title,
  moduleName,
  description,
}) => {
  return (
    <DesktopShell title={title}>
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center rounded-2xl border border-dashed border-slate-300 bg-white/50 p-10 dark:border-slate-800 dark:bg-slate-900/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
            <Construction className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{moduleName}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          <div className="mt-6 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Scheduled for Phase 2 Implementation
          </div>
        </div>
      </div>
    </DesktopShell>
  );
};
