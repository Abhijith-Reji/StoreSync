import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  Product,
  CreateTransactionDto,
  Transaction,
  InventoryLedgerEntry,
  ManualStockAdjustmentDto,
  User,
  UserRole,
} from '../models/types';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class PosService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  private getHeaders(): HttpHeaders {
    const token = this.authService.token();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getProducts(): Observable<Product[]> {
    return this.http
      .get<Product[]>(`${this.baseUrl}/products`, { headers: this.getHeaders() })
      .pipe(
        catchError((err) => {
          console.warn('[PosService] Fallback to offline catalog', err);
          return of(this.getFallbackProducts());
        })
      );
  }

  searchProducts(query: string): Observable<Product[]> {
    return this.http
      .get<Product[]>(`${this.baseUrl}/products/search?q=${encodeURIComponent(query)}`, {
        headers: this.getHeaders(),
      })
      .pipe(
        catchError(() => {
          const q = query.toLowerCase();
          const filtered = this.getFallbackProducts().filter(
            (p) => p.barcode.includes(q) || p.name.toLowerCase().includes(q)
          );
          return of(filtered);
        })
      );
  }

  checkout(dto: CreateTransactionDto): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.baseUrl}/transactions`, dto, {
      headers: this.getHeaders(),
    });
  }

  getReceiptPdfUrl(transactionId: string): string {
    return `${this.baseUrl}/receipts/${transactionId}/pdf`;
  }

  getLedger(): Observable<InventoryLedgerEntry[]> {
    return this.http.get<InventoryLedgerEntry[]>(`${this.baseUrl}/products/ledger`, {
      headers: this.getHeaders(),
    });
  }

  adjustStock(dto: ManualStockAdjustmentDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/products/adjust-stock`, dto, {
      headers: this.getHeaders(),
    });
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`, { headers: this.getHeaders() });
  }

  createUser(dto: { username: string; password: string; fullName: string; role: UserRole }): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users`, dto, { headers: this.getHeaders() });
  }

  toggleUserStatus(userId: string, isActive: boolean): Observable<User> {
    return this.http.patch<User>(
      `${this.baseUrl}/users/${userId}/status`,
      { isActive },
      { headers: this.getHeaders() }
    );
  }

  getSyncStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/sync/status`, { headers: this.getHeaders() });
  }

  triggerSync(): Observable<any> {
    return this.http.post(`${this.baseUrl}/sync/trigger`, {}, { headers: this.getHeaders() });
  }

  private getFallbackProducts(): Product[] {
    return [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        barcode: '8901030001011',
        sku: 'SKU-RICE-BAS-5KG',
        name: 'Premium Basmati Rice 5kg',
        costPrice: 420,
        sellingPrice: 520,
        gstRate: 5,
        stockQuantity: 100,
        minStockAlert: 15,
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'a0000000-0000-0000-0000-000000000003',
        barcode: '8901030002011',
        sku: 'SKU-MILK-TON-1L',
        name: 'Pasteurized Toned Milk 1L',
        costPrice: 54,
        sellingPrice: 64,
        gstRate: 0,
        stockQuantity: 60,
        minStockAlert: 10,
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'a0000000-0000-0000-0000-000000000005',
        barcode: '8901030003011',
        sku: 'SKU-TEA-PREM-500G',
        name: 'Premium CTC Black Tea 500g',
        costPrice: 210,
        sellingPrice: 275,
        gstRate: 5,
        stockQuantity: 75,
        minStockAlert: 15,
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'a0000000-0000-0000-0000-000000000007',
        barcode: '8901030004011',
        sku: 'SKU-CHIP-SALT-100G',
        name: 'Classic Salted Potato Chips 100g',
        costPrice: 32,
        sellingPrice: 45,
        gstRate: 12,
        stockQuantity: 120,
        minStockAlert: 25,
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'a0000000-0000-0000-0000-000000000009',
        barcode: '8901030005011',
        sku: 'SKU-SOAP-ANTI-125G',
        name: 'Antiseptic Bathing Bar 125g',
        costPrice: 30,
        sellingPrice: 42,
        gstRate: 18,
        stockQuantity: 150,
        minStockAlert: 30,
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}
