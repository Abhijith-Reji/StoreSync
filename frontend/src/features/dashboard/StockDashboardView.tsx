import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  CircleDollarSign,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { DesktopShell } from '../../layouts/DesktopShell';
import { StatCard } from '../../shared/components/StatCard';
import { Badge } from '../../shared/components/Badge';
import { formatINR, formatQuantity } from '../../shared/utils/currency';
import { apiClient } from '../../core/api/client';
import { useAuth } from '../../core/auth/useAuth';

interface DashboardSummary {
  totalProducts: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  potentialProfit: number;
  profitMarginPercent: number;
  lowStockCount: number;
  outOfStockCount: number;
  adjustmentsTodayCount: number;
}

interface LowStockAlert {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  categoryName: string;
  stockQuantity: number;
  minStockAlert: number;
  deficit: number;
  urgencyRatio: number;
}

interface StockMovementItem {
  reasonCode: string;
  entryCount: number;
  totalQuantity: number;
  netUnits: number;
}

interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  productCount: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  lowStockCount: number;
}

export const StockDashboardView: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [movement, setMovement] = useState<StockMovementItem[]>([]);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [categories, setCategories] = useState<CategoryBreakdownItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    try {
      const [sumRes, alertsRes, moveRes, catRes] = await Promise.all([
        apiClient.get('/inventory/dashboard/summary'),
        apiClient.get('/inventory/dashboard/low-stock?limit=10'),
        apiClient.get(`/inventory/dashboard/movement?timeframe=${timeframe}`),
        apiClient.get('/inventory/dashboard/category-breakdown'),
      ]);

      setSummary(sumRes.data.summary);
      setLowStockAlerts(alertsRes.data.alerts || []);
      setMovement(moveRes.data.movement || []);
      setCategories(catRes.data.breakdown || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const totalUnitsAcrossCats = categories.reduce((acc, c) => acc + c.totalStockUnits, 0);

  return (
    <DesktopShell title="Inventory Overview">
      {/* Scrollable Container inside full-height viewport */}
      <div className="h-full w-full overflow-y-auto px-8 py-6">
        {/* Header Title Section */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              {user?.role === 'OWNER' ? 'Owner view' : 'Manager view'}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Inventory overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your store at a glance. Real-time valuation and stock movement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh data</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-96 w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. 5 KPI Stat Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                title="Total SKUs"
                value={formatQuantity(summary?.totalProducts || 0)}
                subtitle="Across active categories"
                icon={<Package className="h-5 w-5" />}
                iconBgColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              />
              <StatCard
                title="Total stock units"
                value={formatQuantity(summary?.totalStockUnits || 0)}
                subtitle="On hand today"
                icon={<Layers className="h-5 w-5" />}
                iconBgColor="bg-sky-500/10 text-sky-600 dark:text-sky-400"
              />
              <StatCard
                title="Cost valuation"
                value={formatINR(summary?.totalCostValue || 0)}
                subtitle="+4.8% this month"
                icon={<CircleDollarSign className="h-5 w-5" />}
                iconBgColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
              <StatCard
                title="Retail valuation"
                value={formatINR(summary?.totalRetailValue || 0)}
                subtitle="At current shelf price"
                icon={<ShoppingBag className="h-5 w-5" />}
                iconBgColor="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              />
              <StatCard
                title="Potential profit margin"
                value={`${summary?.profitMarginPercent || 0}%`}
                trend={{ value: '▲ +1.2 pts', positive: true }}
                subtitle="this quarter"
                icon={<TrendingUp className="h-5 w-5" />}
                iconBgColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              />
            </div>

            {/* 2. Middle Row: Priority Low Stock + Stock Movement Chart */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Priority Low Stock Table (7 Cols) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#111827] lg:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800/80">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Priority low stock
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Items at or below their minimum alert threshold
                      </p>
                    </div>
                    <Badge variant="amber">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{lowStockAlerts.length} alerts</span>
                    </Badge>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400 dark:border-slate-800 dark:text-slate-500">
                          <th className="py-2.5 font-medium">Product</th>
                          <th className="py-2.5 text-center font-medium">On Hand</th>
                          <th className="py-2.5 text-center font-medium">Minimum</th>
                          <th className="py-2.5 text-right font-medium">Urgency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {lowStockAlerts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400">
                              ✓ All product stocks are healthy above alert thresholds.
                            </td>
                          </tr>
                        ) : (
                          lowStockAlerts.map((item) => {
                            const percent = Math.min(
                              100,
                              Math.round(
                                (item.stockQuantity / Math.max(1, item.minStockAlert)) * 100
                              )
                            );
                            return (
                              <tr
                                key={item.id}
                                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                              >
                                <td className="py-3 pr-2">
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {item.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {item.sku} • {item.categoryName}
                                  </div>
                                </td>
                                <td className="py-3 text-center font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                  {item.stockQuantity}
                                </td>
                                <td className="py-3 text-center tabular-nums text-slate-400">
                                  {item.minStockAlert}
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                      <div
                                        className={`h-full rounded-full ${
                                          percent <= 30
                                            ? 'bg-rose-500'
                                            : percent <= 60
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${percent}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-mono text-[11px] text-slate-500">
                                      {percent}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Stock Movement Chart (5 Cols) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#111827] lg:col-span-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800/80">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Stock movement
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Units moved by reason code
                      </p>
                    </div>

                    {/* Timeframe Toggle */}
                    <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                      {(['day', 'week', 'month'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`rounded-md px-2.5 py-1 capitalize transition-all ${
                            timeframe === t
                              ? 'bg-white font-semibold text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visual Bar Breakdown */}
                  <div className="mt-6 space-y-4">
                    {movement.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No movement recorded for this timeframe.
                      </div>
                    ) : (
                      movement.map((m) => {
                        const colors: Record<string, { bg: string; fill: string }> = {
                          RESTOCK: { bg: 'bg-emerald-500/15', fill: 'bg-emerald-500' },
                          SALE: { bg: 'bg-sky-500/15', fill: 'bg-sky-500' },
                          DAMAGE: { bg: 'bg-rose-500/15', fill: 'bg-rose-500' },
                          WASTAGE: { bg: 'bg-amber-500/15', fill: 'bg-amber-500' },
                          RETURN: { bg: 'bg-indigo-500/15', fill: 'bg-indigo-500' },
                          AUDIT_ADJUSTMENT: { bg: 'bg-purple-500/15', fill: 'bg-purple-500' },
                        };
                        const c = colors[m.reasonCode] || { bg: 'bg-slate-500/15', fill: 'bg-slate-500' };

                        const maxQty = Math.max(...movement.map((x) => x.totalQuantity), 1);
                        const barWidth = Math.min(100, Math.round((m.totalQuantity / maxQty) * 100));

                        return (
                          <div key={m.reasonCode} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                                {m.reasonCode.toLowerCase().replace('_', ' ')}
                              </span>
                              <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                {formatQuantity(m.totalQuantity)} units ({m.entryCount} entries)
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className={`h-full rounded-full ${c.fill} transition-all duration-300`}
                                style={{ width: `${barWidth}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span>Restock</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                    <span>Sale</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    <span>Damage</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    <span>Wastage</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Bottom Row: Category Breakdown Table */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#111827]">
              <div className="border-b border-slate-100 pb-4 dark:border-slate-800/80">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Category breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Stock distribution and inventory valuation across active categories
                </p>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400 dark:border-slate-800 dark:text-slate-500">
                      <th className="py-2.5 font-medium">Category</th>
                      <th className="py-2.5 text-center font-medium">SKUs</th>
                      <th className="py-2.5 text-center font-medium">Stock Units</th>
                      <th className="py-2.5 text-right font-medium">Retail Valuation</th>
                      <th className="py-2.5 text-right font-medium">Share of Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {categories.map((cat) => {
                      const share =
                        totalUnitsAcrossCats > 0
                          ? Math.round((cat.totalStockUnits / totalUnitsAcrossCats) * 100)
                          : 0;

                      return (
                        <tr
                          key={cat.categoryId}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 font-semibold text-slate-900 dark:text-white">
                            {cat.categoryName}{' '}
                            <span className="font-mono text-[10px] text-slate-400">
                              ({cat.categoryCode})
                            </span>
                          </td>
                          <td className="py-3 text-center tabular-nums text-slate-600 dark:text-slate-300">
                            {cat.productCount}
                          </td>
                          <td className="py-3 text-center tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                            {formatQuantity(cat.totalStockUnits)}
                          </td>
                          <td className="py-3 text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                            {formatINR(cat.totalRetailValue)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${share}%` }}
                                ></div>
                              </div>
                              <span className="font-mono text-[11px] text-slate-500">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </DesktopShell>
  );
};
