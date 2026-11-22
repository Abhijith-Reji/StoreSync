// Token Storage Abstraction (localStorage with Electron DPAPI bridge support)

const ACCESS_TOKEN_KEY = 'storesync_access_token';
const REFRESH_TOKEN_KEY = 'storesync_refresh_token';
const USER_KEY = 'storesync_user';

export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    // If running inside Electron, sync with safeStorage / DPAPI asynchronously
    if ((window as any).stockSyncDesktop?.saveToken) {
      (window as any).stockSyncDesktop.saveToken('refresh_token', refreshToken).catch(() => {});
    }
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if ((window as any).stockSyncDesktop?.clearToken) {
      (window as any).stockSyncDesktop.clearToken('refresh_token').catch(() => {});
    }
  },

  getUser(): any | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setUser(user: any): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
};
