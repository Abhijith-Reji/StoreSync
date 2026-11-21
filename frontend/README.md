# StockSync Touch POS Frontend

Standalone Angular 22 touch-screen Point of Sale (POS) interface styled with Tailwind CSS v4.

## Features
* **Touch-Optimized UI**: Large hit targets (`min-h-[56px]`), high contrast, numpad tender inputs, and instant barcode auto-focus.
* **Offline-Ready**: Communicates with the local StockSync backend API (`http://localhost:3000/api`) with resilient offline fallback models.
* **Role-Based Access Control (RBAC)**: Supports Salesperson, Manager, and Owner views with instant privilege switching.
* **Screen Inactivity Lockout**: Automatically locks screen after 15 minutes of inactivity with PIN/password re-authentication to protect open cashier registers.
* **Digital PDF Receipt Viewer**: Direct receipt preview and download.

## Running the Frontend
```powershell
npm install
npm start
```
The interface is served at `http://localhost:4200`.

## Production Build
```powershell
npm run build
```
Compiled assets will be placed in `dist/`.
