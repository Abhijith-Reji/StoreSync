import { contextBridge, ipcRenderer } from 'electron';

export interface StockSyncDesktopBridge {
  readonly isDesktop: boolean;
  saveSecureToken: (token: string, key?: string) => Promise<{ success: boolean; error?: string }>;
  getSecureToken: (key?: string) => Promise<string | null>;
  clearSecureToken: (key?: string) => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
}

const desktopApi: StockSyncDesktopBridge = {
  isDesktop: true,
  saveSecureToken: (token: string, key = 'refresh_token') =>
    ipcRenderer.invoke('dpapi:save-token', key, token),
  getSecureToken: (key = 'refresh_token') =>
    ipcRenderer.invoke('dpapi:get-token', key),
  clearSecureToken: (key = 'refresh_token') =>
    ipcRenderer.invoke('dpapi:clear-token', key),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
};

contextBridge.exposeInMainWorld('stockSyncDesktop', desktopApi);
