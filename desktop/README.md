# StockSync Desktop Wrapper (Electron + Windows DPAPI)

Native Windows desktop client for StockSync supermarket POS and accounting system.

## Architecture

StockSync Desktop packages both the Angular POS frontend and the Node.js backend API into a single Windows executable:

```
StockSync POS Executable (.exe)
├── Electron Main Process (desktop/src/main.ts)
│   ├── Spawns & monitors local Node.js Backend API (backend/dist/index.js)
│   ├── Intercepts application lifecycle & graceful termination
│   └── Exposes native Windows DPAPI security handlers via IPC
├── Secure IPC Preload Bridge (desktop/src/preload.ts)
│   └── Isolates DOM context while providing secure token storage functions
├── Windows DPAPI Keystore (desktop/src/services/dpapi.service.ts)
│   └── Uses electron.safeStorage (native CryptProtectData / CryptUnprotectData C++ calls)
│   └── Zero PowerShell execution, zero AMSI false positives
│   └── Tied to the logged-in Windows User account master key
└── Angular POS Frontend (frontend/dist/pos-desktop/browser)
    └── Renders in high-performance hardware-accelerated Chromium window
```

## Security: Native Windows DPAPI Token Storage

To prevent JWT refresh tokens from residing in plain text on the local terminal's disk:
* Electron's built-in `safeStorage` API directly calls the Windows OS Data Protection API (`CryptProtectData` and `CryptUnprotectData`).
* The encryption key is dynamically derived from the current logged-in Windows user's credentials and hardware TPM/master key.
* Even if an attacker physically extracts the encrypted `.dpapi` file, it cannot be decrypted on another machine or under another Windows user account.
* Eliminates command-line scripts or PowerShell invocations, ensuring complete antivirus and Windows Defender compliance.

## Development & Testing
```powershell
cd desktop
npm install
npm run build
npm start
```

## Packaging into Windows Executable (.exe)
```powershell
npm run dist
```
Generates the installer (`StockSync POS Setup.exe`) and portable executable in `desktop/release/`.
