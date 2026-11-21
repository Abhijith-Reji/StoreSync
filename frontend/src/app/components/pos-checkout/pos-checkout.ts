import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../services/pos.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { Product, PaymentMethod, Transaction } from '../../models/types';

@Component({
  selector: 'app-pos-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-checkout.html',
})
export class PosCheckoutComponent implements OnInit {
  protected posService = inject(PosService);
  protected cartService = inject(CartService);
  protected authService = inject(AuthService);

  readonly products = signal<Product[]>([]);
  readonly filteredProducts = signal<Product[]>([]);
  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('ALL');
  readonly categories = ['ALL', 'GROC', 'DAIRY', 'BEV', 'SNACK', 'CARE'];

  // Payment & Receipt Modals
  readonly showPaymentModal = signal<boolean>(false);
  readonly selectedPaymentMethod = signal<PaymentMethod>(PaymentMethod.CASH);
  readonly cashTendered = signal<number>(0);
  readonly isProcessing = signal<boolean>(false);
  readonly lastTransaction = signal<Transaction | null>(null);
  readonly showReceiptModal = signal<boolean>(false);

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.posService.getProducts().subscribe((data) => {
      this.products.set(data);
      this.applyFilter();
    });
  }

  onSearchChange(query: string) {
    this.searchQuery.set(query);
    this.applyFilter();
  }

  onBarcodeEnter() {
    const q = this.searchQuery().trim();
    if (!q) return;

    // Check if exact barcode match
    const exactMatch = this.products().find((p) => p.barcode === q);
    if (exactMatch) {
      this.cartService.addToCart(exactMatch, 1);
      this.searchQuery.set('');
      this.applyFilter();
    } else {
      this.applyFilter();
    }
  }

  setCategory(cat: string) {
    this.selectedCategory.set(cat);
    this.applyFilter();
  }

  applyFilter() {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();

    const filtered = this.products().filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchesCat = cat === 'ALL' || (p.category?.code || '').includes(cat);
      return matchesSearch && matchesCat;
    });

    this.filteredProducts.set(filtered);
  }

  protected readonly PaymentMethod = PaymentMethod;

  openPayment(method: PaymentMethod | string) {
    if (this.cartService.items().length === 0) {
      alert('Cart is empty. Scan products before initiating payment.');
      return;
    }
    this.selectedPaymentMethod.set(method as PaymentMethod);
    this.cashTendered.set(this.cartService.grandTotal());
    this.showPaymentModal.set(true);
  }

  get changeDue(): number {
    const change = this.cashTendered() - this.cartService.grandTotal();
    return change > 0 ? change : 0;
  }

  executeCheckout() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    const cashier = this.authService.currentUser();
    const dto = {
      counterId: cashier.counterId,
      cashierId: cashier.id,
      paymentMethod: this.selectedPaymentMethod(),
      items: this.cartService.items().map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        gstRate: it.gstRate,
        discountAmount: it.discountAmount,
      })),
      notes: `Touch POS Checkout on ${cashier.counterId}`,
    };

    this.posService.checkout(dto).subscribe({
      next: (tx) => {
        this.isProcessing.set(false);
        this.showPaymentModal.set(false);
        this.lastTransaction.set(tx);
        this.showReceiptModal.set(true);
        this.cartService.clearCart();
        this.loadProducts(); // Refresh stock
      },
      error: (err) => {
        this.isProcessing.set(false);
        alert(`Checkout Failed: ${err.error?.error || err.message || 'Server error'}`);
      },
    });
  }

  openPdfReceipt() {
    const tx = this.lastTransaction();
    if (tx) {
      const url = this.posService.getReceiptPdfUrl(tx.id);
      window.open(url, '_blank');
    }
  }

  closeReceiptModal() {
    this.showReceiptModal.set(false);
    this.lastTransaction.set(null);
  }
}
