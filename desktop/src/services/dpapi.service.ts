import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * Windows DPAPI Secure Storage Service
 *
 * Utilizes Electron's native `safeStorage` API, which directly invokes the Windows
 * Data Protection API (`CryptProtectData` and `CryptUnprotectData`) via native C++ OS calls.
 *
 * This completely avoids child process spawning or PowerShell CLI commands, eliminating
 * any antivirus/AMSI heuristic flags while guaranteeing genuine Windows DPAPI security.
 */
export class DpapiService {
  private readonly storageDir: string;

  constructor() {
    const userData = app.getPath('userData');
    this.storageDir = path.join(userData, 'secure_store');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Check if Windows DPAPI encryption is available on the current OS
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Encrypt and save a sensitive token (e.g. refresh token) using native Windows DPAPI
   */
  async saveSecureToken(key: string, token: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('[DPAPI Error] Windows DPAPI encryption is not available on this system.');
    }

    const encryptedBuffer = safeStorage.encryptString(token);
    const filePath = path.join(this.storageDir, `${key}.dpapi`);
    await fs.promises.writeFile(filePath, encryptedBuffer);
  }

  /**
   * Read and decrypt a DPAPI-protected token using native Windows DPAPI
   */
  async getSecureToken(key: string): Promise<string | null> {
    const filePath = path.join(this.storageDir, `${key}.dpapi`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      if (!this.isAvailable()) {
        throw new Error('[DPAPI Error] Windows DPAPI encryption is not available.');
      }
      const encryptedBuffer = await fs.promises.readFile(filePath);
      return safeStorage.decryptString(encryptedBuffer);
    } catch (err) {
      console.error(`[DPAPI] Failed to decrypt token "${key}":`, err);
      return null;
    }
  }

  /**
   * Delete an encrypted token upon user logout
   */
  async clearSecureToken(key: string): Promise<void> {
    const filePath = path.join(this.storageDir, `${key}.dpapi`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * Check if a stored encrypted token exists on disk
   */
  hasSecureToken(key: string): boolean {
    const filePath = path.join(this.storageDir, `${key}.dpapi`);
    return fs.existsSync(filePath);
  }
}

export const dpapiService = new DpapiService();
