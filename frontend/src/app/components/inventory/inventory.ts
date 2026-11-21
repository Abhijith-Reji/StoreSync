import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../services/pos.service';
import { Product, ReasonCode, InventoryLedgerEntry } from '../../models/types';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.html',
})
export class InventoryComponent implements OnInit {
  protected posService = inject(PosService);

  readonly products = signal<Product[]>([]);
  readonly ledger = signal<InventoryLedgerEntry[]>([]);
  readonly activeTab = signal<'STOCK' | 'LEDGER'>('STOCK');

  // Adjustment Modal
  readonly showAdjustModal = signal<boolean>(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly adjustQuantity = signal<number>(1);
  readonly adjustReason = signal<ReasonCode>(ReasonCode.RESTOCK);
  readonly adjustNotes = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);

  readonly reasonCodes = [
    ReasonCode.RESTOCK,
    ReasonCode.DAMAGE,
    ReasonCode.WASTAGE,
    ReasonCode.RETURN,
    ReasonCode.AUDIT_ADJUSTMENT,
  ];

  ngOnInit() {
    this.refreshData();
  }

  refreshData() {
    this.posService.getProducts().subscribe((data) => this.products.set(data));
    this.posService.getLedger().subscribe((data) => this.ledger.set(data));
  }

  openAdjustment(product: Product) {
    this.selectedProduct.set(product);
    this.adjustQuantity.set(1);
    this.adjustReason.set(ReasonCode.RESTOCK);
    this.adjustNotes.set('');
    this.showAdjustModal.set(true);
  }

  submitAdjustment() {
    const prod = this.selectedProduct();
    if (!prod) return;

    if (!this.adjustNotes().trim()) {
      alert('Mandatory reason explanation is required for the audit trail.');
      return;
    }

    this.isSubmitting.set(true);

    // Negative quantity for damage/wastage
    let qty = Math.abs(this.adjustQuantity());
    if (this.adjustReason() === ReasonCode.DAMAGE || this.adjustReason() === ReasonCode.WASTAGE) {
      qty = -qty;
    }

    this.posService
      .adjustStock({
        productId: prod.id,
        changeQuantity: qty,
        reasonCode: this.adjustReason(),
        notes: this.adjustNotes().trim(),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showAdjustModal.set(false);
          alert('Stock adjustment saved to immutable audit ledger.');
          this.refreshData();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          alert(`Failed: ${err.error?.error || err.message}`);
        },
      });
  }
}
