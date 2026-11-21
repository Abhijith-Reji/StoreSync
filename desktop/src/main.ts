import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { dpapiService } from './services/dpapi.service';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = 3000;
const HEALTH_URL = `http://localhost:${BACKEND_PORT}/api/health`;

/**
 * Probe backend API until it is healthy and responsive
 */
function waitForBackend(url: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        })
        .on('error', () => retry());
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Backend did not become healthy within ${timeoutMs / 1000}s`));
      } else {
        setTimeout(probe, 500);
      }
    };

    probe();
  });
}

/**
 * Start the Node.js backend API process
 */
function startBackendServer(): void {
  // Determine backend entry path
  const backendScript = isDev
    ? path.join(__dirname, '../../backend/dist/index.js')
    : path.join(process.resourcesPath, 'backend', 'dist', 'index.js');

  const backendCwd = isDev
    ? path.join(__dirname, '../../backend')
    : path.join(process.resourcesPath, 'backend');

  console.log(`[Electron Main] Spawning backend server from: ${backendScript}`);

  try {
    backendProcess = spawn(process.execPath, [backendScript], {
      cwd: backendCwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(BACKEND_PORT),
        NODE_ENV: isDev ? 'development' : 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (data) => {
      console.log(`[Backend API] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`[Backend API Error] ${data.toString().trim()}`);
    });

    backendProcess.on('exit', (code, signal) => {
      console.warn(`[Backend API] Process exited with code ${code}, signal ${signal}`);
    });
  } catch (err) {
    console.error('[Electron Main] Failed to spawn backend server:', err);
  }
}

/**
 * Create and configure the POS BrowserWindow
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'StockSync Supermarket POS',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Register DPAPI IPC Handlers
  ipcMain.handle('dpapi:save-token', async (_, key: string, token: string) => {
    try {
      await dpapiService.saveSecureToken(key, token);
      return { success: true };
    } catch (err: any) {
      console.error('[IPC Error] dpapi:save-token failed:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dpapi:get-token', async (_, key: string) => {
    try {
      return await dpapiService.getSecureToken(key);
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('dpapi:clear-token', async (_, key: string) => {
    try {
      await dpapiService.clearSecureToken(key);
      return true;
    } catch (err) {
      return false;
    }
  });

  // Window Management Handlers
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:toggle-fullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return mainWindow.isFullScreen();
    }
    return false;
  });
  ipcMain.handle('app:version', () => app.getVersion());

  // Wait for backend readiness before loading UI
  try {
    await waitForBackend(HEALTH_URL);
    console.log('[Electron Main] Backend API confirmed healthy.');
  } catch (err) {
    console.warn('[Electron Main] Backend health check warning:', err);
  }

  // Load the Frontend
  const frontendPath = isDev
    ? path.join(__dirname, '../../frontend/dist/pos-desktop/browser/index.html')
    : path.join(process.resourcesPath, 'frontend', 'index.html');

  console.log(`[Electron Main] Loading frontend UI from: ${frontendPath}`);
  mainWindow.loadFile(frontendPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App Lifecycle
app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    console.log('[Electron Main] Terminating backend child process...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
