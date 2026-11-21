// Self-contained TypeScript types and interfaces for StockSync POS Frontend

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
  gstRate: number;
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
