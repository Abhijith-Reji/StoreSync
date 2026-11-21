import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { PosService } from './services/pos.service';
import { PosCheckoutComponent } from './components/pos-checkout/pos-checkout';
import { InventoryComponent } from './components/inventory/inventory';
import { UserManagementComponent } from './components/user-management/user-management';
import { InactivityLockComponent } from './components/inactivity-lock/inactivity-lock';
import { UserRole } from './models/types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    PosCheckoutComponent,
    InventoryComponent,
    UserManagementComponent,
    InactivityLockComponent,
  ],
  templateUrl: './app.html',
})
export class App {
  protected authService = inject(AuthService);
  protected posService = inject(PosService);

  readonly activeTab = signal<'CHECKOUT' | 'INVENTORY' | 'STAFF' | 'SYNC'>('CHECKOUT');
  readonly isSyncing = signal<boolean>(false);
  readonly syncStatus = signal<any>(null);

  protected readonly UserRole = UserRole;

  switchRole(role: UserRole) {
    this.authService.switchRole(role);
    if (role === UserRole.SALESPERSON && (this.activeTab() === 'INVENTORY' || this.activeTab() === 'STAFF')) {
      this.activeTab.set('CHECKOUT');
    }
  }

  triggerAzureSync() {
    this.isSyncing.set(true);
    this.posService.triggerSync().subscribe({
      next: (res) => {
        this.isSyncing.set(false);
        alert(`Cloud Sync Successful: ${res.processed} records pushed to Azure.`);
      },
      error: (err) => {
        this.isSyncing.set(false);
        alert(`Sync Error: ${err.message}`);
      },
    });
  }

  minimizeDesktop() {
    (window as any).stockSyncDesktop?.minimizeWindow();
  }

  maximizeDesktop() {
    (window as any).stockSyncDesktop?.maximizeWindow();
  }

  closeDesktop() {
    (window as any).stockSyncDesktop?.closeWindow();
  }
}
