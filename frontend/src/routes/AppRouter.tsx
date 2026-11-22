import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginView } from '../features/auth/LoginView';
import { StockDashboardView } from '../features/dashboard/StockDashboardView';
import { PosWorkstationView } from '../features/pos/PosWorkstationView';
import { PlaceholderView } from '../features/placeholders/PlaceholderView';
import { RoleRoute } from './RoleRoute';
import { UserRole } from '../config/constants';
import { useAuth } from '../core/auth/useAuth';

export const AppRouter: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  // Root redirect based on active user role
  const getDefaultRoute = () => {
    if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
    if (user.role === UserRole.SALESPERSON) return <Navigate to="/pos" replace />;
    return <Navigate to="/dashboard" replace />;
  };

  return (
    <HashRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginView />} />

        {/* Root Redirect */}
        <Route path="/" element={getDefaultRoute()} />

        {/* Owner & Manager Stock Dashboard */}
        <Route
          path="/dashboard"
          element={
            <RoleRoute allowedRoles={[UserRole.OWNER, UserRole.MANAGER]}>
              <StockDashboardView />
            </RoleRoute>
          }
        />

        {/* POS Workstation (Cashiers, Managers, Owners) */}
        <Route
          path="/pos"
          element={
            <RoleRoute allowedRoles={[UserRole.OWNER, UserRole.MANAGER, UserRole.SALESPERSON]}>
              <PosWorkstationView />
            </RoleRoute>
          }
        />

        {/* Phase 2 Modules (Placeholders) */}
        <Route
          path="/products"
          element={
            <RoleRoute allowedRoles={[UserRole.OWNER, UserRole.MANAGER]}>
              <PlaceholderView
                title="Products & Inventory"
                moduleName="Product Catalog & Stock Management"
                description="Comprehensive SKU management, barcode assignment, cost/selling price adjustments, and multi-product bulk restock."
              />
            </RoleRoute>
          }
        />

        <Route
          path="/categories"
          element={
            <RoleRoute allowedRoles={[UserRole.OWNER, UserRole.MANAGER]}>
              <PlaceholderView
                title="Category Management"
                moduleName="Store Department & Categories"
                description="Manage supermarket aisle taxonomy, assign product categories, and inspect department unit valuations."
              />
            </RoleRoute>
          }
        />

        <Route
          path="/staff"
          element={
            <RoleRoute allowedRoles={[UserRole.OWNER]}>
              <PlaceholderView
                title="Staff Management"
                moduleName="User Accounts & RBAC Provisioning"
                description="Create manager and cashier accounts, assign counter devices, and manage instant security access revocation."
              />
            </RoleRoute>
          }
        />

        <Route
          path="/sales"
          element={
            <RoleRoute allowedRoles={[UserRole.SALESPERSON]}>
              <PlaceholderView
                title="Today's Sales"
                moduleName="Counter Sales Journal"
                description="Review transactions, tender totals, and receipts processed on this terminal during the active shift."
              />
            </RoleRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};
