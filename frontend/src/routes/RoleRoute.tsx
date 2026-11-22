import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/auth/useAuth';
import { UserRole } from '../config/constants';
import { Loader2 } from 'lucide-react';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-[#0B0F19]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If salesperson tries to open owner/manager view, redirect to POS
    if (user.role === UserRole.SALESPERSON) {
      return <Navigate to="/pos" replace />;
    }
    // If owner/manager tries to access a restricted view, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
