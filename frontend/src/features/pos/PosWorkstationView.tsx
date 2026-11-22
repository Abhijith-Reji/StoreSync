import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  Package,
  ShoppingBag,
  Printer,
  Loader2,
  Coffee,
  Milk,
  Wine,
  Cookie,
  Sparkles,
} from 'lucide-react';
import { DesktopShell } from '../../layouts/DesktopShell';
import { Modal } from '../../shared/components/Modal';
import { formatINR } from '../../shared/utils/currency';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';
import { apiClient } from '../../core/api/client';
import { useAuth } from '../../core/auth/useAuth';
import { PaymentMethod } from '../../config/constants';

interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  costPrice: number;
  sellingPrice: number;
  gstRate: number;
  stockQuantity: number;
  minStockAlert: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const PosWorkstationView: React.FC = () => {
  const { user, counterId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedTx, setCompletedTx] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut handlers (F2: barcode search, F8: complete sale)
  useKeyboardShortcuts({
    onF2: () => barcodeInputRef.current?.focus(),
    onF8: () => handleCheckout(),
    onEscape: () => setIsReceiptModalOpen(false),
  });

  // Fetch product catalog & categories on mount
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          apiClient.get('/products'),
          apiClient.get('/categories'),
        ]);
        setProducts(prodRes.data.products || []);
        setCategories(catRes.data.categories || []);
      } catch (err) {
        console.error('Failed to load products/categories:', err);
      }
    };
    loadCatalog();
  }, []);

  // Filter products by category and search text
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'ALL' ||
      p.categoryId === selectedCategory ||
      p.categoryName?.toLowerCase() === selectedCategory.toLowerCase();

    const matchesSearch =
      searchQuery.trim() === '' ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Add product to cart
  const addToCart = (product: Product, qty = 1) => {
    if (product.stockQuantity <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > product.stockQuantity) return prev; // Do not exceed available inventory
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prev, { product, quantity: Math.min(qty, product.stockQuantity) }];
    });
  };

  // Adjust quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stockQuantity) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Barcode enter key trigger
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const matched = products.find(
      (p) =>
        p.barcode.toLowerCase() === searchQuery.trim().toLowerCase() ||
        p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
    );

    if (matched) {
      addToCart(matched, 1);
      setSearchQuery('');
    }
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  const totalGst = cart.reduce((acc, item) => {
    const itemTotal = item.product.sellingPrice * item.quantity;
    const gstPortion = itemTotal * (item.product.gstRate / (100 + item.product.gstRate));
    return acc + gstPortion;
  }, 0);
  const grandTotal = subtotal;

  // Checkout submission
  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload = {
        counterId: user?.counterId || counterId || 'COUNTER-01',
        cashierId: user?.id,
        paymentMethod: selectedPayment,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.sellingPrice,
          gstRate: item.product.gstRate,
        })),
        notes: `POS desktop sale via ${selectedPayment}`,
      };

      const { data } = await apiClient.post('/transactions', payload);
      setCompletedTx(data);
      setIsReceiptModalOpen(true);
      setCart([]); // Clear cart for next customer

      // Refresh product stock list in background
      const prodRes = await apiClient.get('/products');
      setProducts(prodRes.data.products || []);
    } catch (err: any) {
      console.error('Checkout failed:', err);
      alert(err.response?.data?.error || 'Transaction failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Soft-tinted icon badges based on category or index
  const getProductIcon = (categoryName?: string) => {
    const cat = categoryName?.toLowerCase() || '';
    if (cat.includes('coffee') || cat.includes('tea')) {
      return { icon: Coffee, bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    }
    if (cat.includes('dairy') || cat.includes('milk')) {
      return { icon: Milk, bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' };
    }
    if (cat.includes('bev')) {
      return { icon: Wine, bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' };
    }
    if (cat.includes('snack') || cat.includes('biscuit')) {
      return { icon: Cookie, bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' };
    }
    if (cat.includes('care') || cat.includes('soap')) {
      return { icon: Sparkles, bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' };
    }
    return { icon: Package, bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
  };

  return (
    <DesktopShell title="Point of Sale">
      {/* 
        Two-Pane Layout (100% Height, Fixed Pinned Shell, No Outer Scrollbars)
      */}
      <div className="flex h-full w-full overflow-hidden">
        {/* ========================================================= */}
        {/* LEFT PANE (65% width): Barcode, Categories & Dense Grid   */}
        {/* ========================================================= */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-200 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-[#0B0F19]">
          {/* 1. Barcode Scanner Search Bar (Pinned at top) */}
          <div className="mb-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Scan an item
            </span>
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan barcode or enter item code (Press F2 to focus)..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-2xs transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-[#111827] dark:text-white dark:placeholder-slate-500"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 active:scale-95 transition-all dark:bg-emerald-600"
              >
                <Plus className="h-4 w-4" />
                <span>Add item</span>
              </button>
            </form>
          </div>

          {/* 2. Quick Add Category Filter Pills */}
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-emerald-600 font-semibold text-white shadow-2xs dark:bg-emerald-600'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800'
                }`}
              >
                All items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 font-semibold text-white shadow-2xs dark:bg-emerald-600'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              {filteredProducts.length} items
            </span>
          </div>

          {/* 3. Dense Responsive Product Grid (Independently Scrollable) */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((prod) => {
                const { icon: ItemIcon, bg: iconBg } = getProductIcon(prod.categoryName);
                const isOutOfStock = prod.stockQuantity <= 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => !isOutOfStock && addToCart(prod, 1)}
                    className={`group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all duration-150 ${
                      isOutOfStock
                        ? 'opacity-60 cursor-not-allowed dark:border-slate-800/60 dark:bg-slate-900/40'
                        : 'hover:border-emerald-400 hover:shadow-md cursor-pointer active:scale-[0.98] dark:border-slate-800 dark:bg-[#111827] dark:hover:border-emerald-600'
                    }`}
                  >
                    <div>
                      {/* Icon badge + Category badge */}
                      <div className="flex items-start justify-between">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}
                        >
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {prod.gstRate}% GST
                        </span>
                      </div>

                      {/* Product Name & Description */}
                      <div className="mt-2.5">
                        <h4 className="line-clamp-2 text-xs font-bold text-slate-900 dark:text-white leading-tight">
                          {prod.name}
                        </h4>
                        <p className="mt-1 line-clamp-1 text-[10px] text-slate-400">
                          {prod.sku}
                        </p>
                      </div>
                    </div>

                    {/* Price and Quick-Add (+) Button */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                          {formatINR(prod.sellingPrice)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isOutOfStock ? (
                            <span className="text-rose-500 font-semibold">Out of stock</span>
                          ) : (
                            <span>{prod.stockQuantity} in stock</span>
                          )}
                        </div>
                      </div>

                      <button
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(prod, 1);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white transition-all shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANE (35% width): Pinned Full-Height Cart Panel     */}
        {/* ========================================================= */}
        <aside className="flex w-96 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827] shadow-xl z-10">
          {/* Cart Header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Current sale</h3>
                <span className="text-[10px] text-slate-400">
                  {user?.counterId || counterId || 'Counter 01'}
                </span>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {cart.reduce((a, b) => a + b.quantity, 0)} items
            </span>
          </div>

          {/* Scrollable Cart Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-4 dark:divide-slate-800/60">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-400">
                <ShoppingBag className="h-10 w-10 stroke-[1.5] text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs font-medium">Cart is currently empty</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Scan a barcode or click items from the catalog.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {item.product.name}
                      </h5>
                      <span className="text-[11px] text-slate-400">
                        {formatINR(item.product.sellingPrice)} each
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatINR(item.product.sellingPrice * item.quantity)}
                    </span>
                  </div>

                  {/* Quantity Stepper & Delete */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="flex h-6 w-6 items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="flex h-6 w-6 items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sticky Bottom Checkout Panel */}
          <div className="border-t border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-[#111827]">
            {/* Calculation Lines */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatINR(subtotal - totalGst)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Estimated GST</span>
                <span className="tabular-nums">{formatINR(totalGst)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-white">
                <span>Total</span>
                <span className="text-lg tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatINR(grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="mt-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Payment Mode
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(PaymentMethod.CASH)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-xs font-medium transition-all ${
                    selectedPayment === PaymentMethod.CASH
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Banknote className="h-4 w-4 mb-1 text-emerald-500" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayment(PaymentMethod.UPI)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-xs font-medium transition-all ${
                    selectedPayment === PaymentMethod.UPI
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  <QrCode className="h-4 w-4 mb-1 text-sky-500" />
                  <span>UPI QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayment(PaymentMethod.CARD)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-xs font-medium transition-all ${
                    selectedPayment === PaymentMethod.CARD
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="h-4 w-4 mb-1 text-indigo-500" />
                  <span>Card</span>
                </button>
              </div>
            </div>

            {/* Complete Sale Button (F8) */}
            <button
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCheckout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Checkout...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Complete sale (F8)</span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* Checkout Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Transaction Completed"
        maxWidth="md"
      >
        {completedTx && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                {formatINR(completedTx.grandTotal)}
              </h4>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Receipt #{completedTx.receiptNumber}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                Paid via {completedTx.paymentMethod}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <a
                href={`http://localhost:3000/api/receipts/${completedTx.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <Printer className="h-4 w-4 text-emerald-500" />
                <span>Download PDF</span>
              </a>

              <button
                onClick={() => {
                  setIsReceiptModalOpen(false);
                  barcodeInputRef.current?.focus();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <span>Next Customer</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DesktopShell>
  );
};
