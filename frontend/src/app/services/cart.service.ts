import { Injectable, signal, computed } from '@angular/core';
import { Product, CartItem } from '../models/types';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  readonly items = signal<CartItem[]>([]);

  readonly itemCount = computed(() =>
    this.items().reduce((total, item) => total + item.quantity, 0)
  );

  readonly subtotal = computed(() => {
    return this.items().reduce((total, item) => {
      const tax = (item.totalPrice * item.gstRate) / (100 + item.gstRate);
      return total + (item.totalPrice - tax);
    }, 0);
  });

  readonly totalTax = computed(() => {
    return this.items().reduce((total, item) => {
      const tax = (item.totalPrice * item.gstRate) / (100 + item.gstRate);
      return total + tax;
    }, 0);
  });

  readonly grandTotal = computed(() => {
    return this.items().reduce((total, item) => total + item.totalPrice, 0);
  });

  addToCart(product: Product, quantity = 1) {
    const current = this.items();
    const existingIndex = current.findIndex((it) => it.productId === product.id);

    if (existingIndex > -1) {
      const existing = current[existingIndex];
      const newQty = existing.quantity + quantity;
      if (newQty > product.stockQuantity) {
        alert(`Cannot add more than available stock (${product.stockQuantity})`);
        return;
      }
      const updated = [...current];
      const itemGross = product.sellingPrice * newQty;
      const itemTax = (itemGross * product.gstRate) / (100 + product.gstRate);

      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        gstAmount: Math.round(itemTax * 100) / 100,
        totalPrice: Math.round(itemGross * 100) / 100,
      };
      this.items.set(updated);
    } else {
      if (quantity > product.stockQuantity) {
        alert(`Cannot add more than available stock (${product.stockQuantity})`);
        return;
      }
      const itemGross = product.sellingPrice * quantity;
      const itemTax = (itemGross * product.gstRate) / (100 + product.gstRate);

      this.items.set([
        ...current,
        {
          productId: product.id,
          product,
          quantity,
          unitPrice: product.sellingPrice,
          gstRate: product.gstRate,
          gstAmount: Math.round(itemTax * 100) / 100,
          discountAmount: 0,
          totalPrice: Math.round(itemGross * 100) / 100,
        },
      ]);
    }
  }

  updateQuantity(productId: string, delta: number) {
    const current = this.items();
    const index = current.findIndex((it) => it.productId === productId);
    if (index === -1) return;

    const item = current[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (newQty > item.product.stockQuantity) {
      alert(`Cannot exceed available stock (${item.product.stockQuantity})`);
      return;
    }

    const updated = [...current];
    const itemGross = item.unitPrice * newQty;
    const itemTax = (itemGross * item.gstRate) / (100 + item.gstRate);

    updated[index] = {
      ...item,
      quantity: newQty,
      gstAmount: Math.round(itemTax * 100) / 100,
      totalPrice: Math.round(itemGross * 100) / 100,
    };
    this.items.set(updated);
  }

  removeFromCart(productId: string) {
    this.items.set(this.items().filter((it) => it.productId !== productId));
  }

  clearCart() {
    this.items.set([]);
  }
}
