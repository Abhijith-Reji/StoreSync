// Self-contained TypeScript types and interfaces for StockSync Backend API

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  SALESPERSON = 'SALESPERSON',
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  productCount?: number;
  createdAt: string;
}

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  costPrice: number;
  sellingPrice: number;
  gstRate: number; // e.g. 0, 5, 12, 18
  stockQuantity: number;
  minStockAlert: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export enum ReasonCode {
  SALE = 'SALE',
  RESTOCK = 'RESTOCK',
  DAMAGE = 'DAMAGE',
  WASTAGE = 'WASTAGE',
  RETURN = 'RETURN',
  AUDIT_ADJUSTMENT = 'AUDIT_ADJUSTMENT',
}

export interface InventoryLedgerEntry {
  id: string;
  productId: string;
  productName?: string;
  changeQuantity: number;
  previousQuantity: number;
  newQuantity: number;
  reasonCode: ReasonCode;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  SPLIT = 'SPLIT',
}

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  IN_FLIGHT = 'IN_FLIGHT',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  discountAmount: number;
  totalPrice: number;
}

export interface CreateTransactionDto {
  counterId: string;
  cashierId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    discountAmount?: number;
  }[];
  paymentMethod: PaymentMethod;
  paymentDetails?: {
    cashTendered?: number;
    changeReturned?: number;
    upiReference?: string;
    cardLast4?: string;
  };
  notes?: string;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  discountAmount: number;
  totalPrice: number;
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  cashierId: string;
  cashierName?: string;
  counterId: string;
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: TransactionItem[];
  notes?: string;
  syncStatus: SyncStatus;
  syncTimestamp?: string;
  createdAt: string;
}

export interface TaxBreakdownItem {
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTax: number;
}

export interface ReceiptPayload {
  receiptId: string;
  receiptNumber: string;
  storeName: string;
  storeAddress: string;
  storeGstin: string;
  counterId: string;
  cashierName: string;
  transactionTime: string;
  items: {
    name: string;
    barcode: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    totalPrice: number;
  }[];
  subtotal: number;
  taxBreakdowns: TaxBreakdownItem[];
  totalDiscount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  tenderedAmount?: number;
  changeAmount?: number;
}

export interface ManualStockAdjustmentDto {
  productId: string;
  changeQuantity: number;
  reasonCode: ReasonCode;
  notes: string;
}

export interface SyncBatchPayload {
  storeId: string;
  batchTimestamp: string;
  lastSequenceId: number;
  transactions: Transaction[];
  ledgerEntries: InventoryLedgerEntry[];
}

// ------------------------------------------------------------
// Permissions & Session Management
// ------------------------------------------------------------

export enum Permission {
  AUTH_ME = 'AUTH_ME',
  POS_CHECKOUT = 'POS_CHECKOUT',
  INVENTORY_READ = 'INVENTORY_READ',
  INVENTORY_ADJUST = 'INVENTORY_ADJUST',
  INVENTORY_MANAGE = 'INVENTORY_MANAGE', // Product create/update/delete
  CATEGORIES_MANAGE = 'CATEGORIES_MANAGE',
  DASHBOARD_VIEW = 'DASHBOARD_VIEW',     // Stock valuation, KPIs, velocity
  REPORTS_VIEW = 'REPORTS_VIEW',
  USERS_MANAGE = 'USERS_MANAGE',
  SESSIONS_REVOKE = 'SESSIONS_REVOKE',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    Permission.AUTH_ME,
    Permission.POS_CHECKOUT,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_MANAGE,
    Permission.CATEGORIES_MANAGE,
    Permission.DASHBOARD_VIEW,
    Permission.REPORTS_VIEW,
    Permission.USERS_MANAGE,
    Permission.SESSIONS_REVOKE,
  ],
  [UserRole.MANAGER]: [
    Permission.AUTH_ME,
    Permission.POS_CHECKOUT,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_MANAGE,
    Permission.CATEGORIES_MANAGE,
    Permission.DASHBOARD_VIEW,
    Permission.REPORTS_VIEW,
    Permission.USERS_MANAGE,
  ],
  [UserRole.SALESPERSON]: [
    Permission.AUTH_ME,
    Permission.POS_CHECKOUT,
    Permission.INVENTORY_READ,
  ],
};

export interface UserSession {
  id: string;
  userId: string;
  counterId: string;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
  expiresAt: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface SessionDto {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  counterId: string;
  ipAddress?: string;
  userAgent?: string;
  isCurrent: boolean;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

// ------------------------------------------------------------
// Stock Management Dashboard & Catalog Types
// ------------------------------------------------------------

export interface DashboardSummary {
  totalProducts: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  potentialProfit: number;
  profitMarginPercent: number;
  lowStockCount: number;
  outOfStockCount: number;
  adjustmentsTodayCount: number;
  timestamp: string;
}

export interface LowStockAlertItem {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  categoryName: string;
  stockQuantity: number;
  minStockAlert: number;
  deficit: number;
  costPrice: number;
  sellingPrice: number;
  urgencyRatio: number; // stockQuantity / minStockAlert
}

export interface StockMovementItem {
  reasonCode: ReasonCode;
  totalQuantity: number;
  netUnits: number; // positive for restock/return, negative for sale/damage/wastage
  entryCount: number;
}

export interface FastMovingProduct {
  productId: string;
  productName: string;
  barcode: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  productCount: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  lowStockCount: number;
}

export interface CreateProductDto {
  barcode: string;
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  costPrice: number;
  sellingPrice: number;
  gstRate: number;
  initialStock: number;
  minStockAlert: number;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  categoryId?: string;
  costPrice?: number;
  sellingPrice?: number;
  gstRate?: number;
  minStockAlert?: number;
  isActive?: boolean;
}

export interface BulkRestockItemDto {
  productId: string;
  quantity: number;
  costPrice?: number;
}

export interface BulkRestockDto {
  invoiceReference: string;
  supplierName?: string;
  notes?: string;
  items: BulkRestockItemDto[];
}

export interface CreateCategoryDto {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
}

