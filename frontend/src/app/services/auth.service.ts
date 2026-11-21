import { Injectable, signal, computed, effect } from '@angular/core';
import { UserRole } from '../models/types';

export interface PosUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  counterId: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'stocksync_access_token';
  private readonly USER_KEY = 'stocksync_active_user';

  readonly currentUser = signal<PosUser>({
    id: 'c0000000-0000-0000-0000-000000000003',
    username: 'cashier1',
    fullName: 'POS Cashier 01',
    role: UserRole.SALESPERSON,
    counterId: 'COUNTER-01',
  });

  readonly token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));
  readonly isLocked = signal<boolean>(false);
  readonly inactivityTimeoutMs = 15 * 60 * 1000; // 15 minutes as per PRD
  private lastActivity = Date.now();

  readonly isOwner = computed(() => this.currentUser()?.role === UserRole.OWNER);
  readonly isManager = computed(
    () => this.currentUser()?.role === UserRole.MANAGER || this.currentUser()?.role === UserRole.OWNER
  );
  readonly isSalesperson = computed(() => this.currentUser()?.role === UserRole.SALESPERSON);

  readonly isDesktop = typeof window !== 'undefined' && !!(window as any).stockSyncDesktop;

  constructor() {
    this.initActivityTracker();
    this.restoreDpapiToken();
  }

  private restoreDpapiToken() {
    if (typeof window !== 'undefined' && (window as any).stockSyncDesktop) {
      (window as any).stockSyncDesktop.getSecureToken('refresh_token').then((secureToken: string | null) => {
        if (secureToken) {
          console.log('[Windows DPAPI] Secure session token retrieved via native DPAPI.');
          this.token.set(secureToken);
        }
      });
    }
  }

  private initActivityTracker() {
    if (typeof window === 'undefined') return;

    const reset = () => {
      this.lastActivity = Date.now();
    };

    window.addEventListener('mousemove', reset, { passive: true });
    window.addEventListener('keydown', reset, { passive: true });
    window.addEventListener('touchstart', reset, { passive: true });

    // Check inactivity every 10 seconds
    setInterval(() => {
      if (!this.isLocked() && Date.now() - this.lastActivity > this.inactivityTimeoutMs) {
        console.warn('[Security] Screen inactivity timeout reached. Locking terminal.');
        this.isLocked.set(true);
      }
    }, 10000);
  }

  setSession(user: PosUser, token: string) {
    this.currentUser.set(user);
    this.token.set(token);
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.isLocked.set(false);
    this.lastActivity = Date.now();

    // Persist securely to Windows DPAPI when running inside Electron
    if (typeof window !== 'undefined' && (window as any).stockSyncDesktop) {
      (window as any).stockSyncDesktop.saveSecureToken(token, 'refresh_token').catch((err: any) => {
        console.error('[Windows DPAPI] Failed to encrypt token with DPAPI:', err);
      });
    }
  }

  switchRole(role: UserRole) {
    const rolesMap: Record<UserRole, PosUser> = {
      [UserRole.OWNER]: {
        id: 'c0000000-0000-0000-0000-000000000001',
        username: 'owner',
        fullName: 'Main Store Owner',
        role: UserRole.OWNER,
        counterId: 'ADMIN-DESK',
      },
      [UserRole.MANAGER]: {
        id: 'c0000000-0000-0000-0000-000000000002',
        username: 'manager',
        fullName: 'Floor Shift Manager',
        role: UserRole.MANAGER,
        counterId: 'MGR-DESK',
      },
      [UserRole.SALESPERSON]: {
        id: 'c0000000-0000-0000-0000-000000000003',
        username: 'cashier1',
        fullName: 'POS Cashier 01',
        role: UserRole.SALESPERSON,
        counterId: 'COUNTER-01',
      },
    };
    this.setSession(rolesMap[role], 'mock-pos-token-' + role.toLowerCase());
  }

  unlockScreen(pinOrPassword: string): boolean {
    if (pinOrPassword.trim().length > 0) {
      this.isLocked.set(false);
      this.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  logout() {
    this.token.set(null);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);

    // Clear DPAPI secure token on logout
    if (typeof window !== 'undefined' && (window as any).stockSyncDesktop) {
      (window as any).stockSyncDesktop.clearSecureToken('refresh_token').catch(() => {});
    }

    this.switchRole(UserRole.SALESPERSON);
  }
}
