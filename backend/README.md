# StockSync Local Backend API

Self-contained Node.js / Express / TypeScript local retail and POS engine.

## Core Features
* **ACID Concurrency Safety**: Implements PostgreSQL `SELECT ... FOR UPDATE` row-level locks on sorted product IDs to prevent overselling on multi-counter LAN setups.
* **Immutable Inventory Audit Ledger**: Mandatory reason codes (`RESTOCK`, `DAMAGE`, `WASTAGE`, `RETURN`, `AUDIT_ADJUSTMENT`) recorded with user attribution for all manual changes and sales.
* **Hardware-Free PDF Receipt Engine**: Compiles and streams standardized 80mm thermal receipts with GST breakdowns (0%, 5%, 12%, 18%) using PDFKit.
* **Offline Cloud Sync Queue**: Enqueues sales and ledger mutations locally with monotonically increasing sequence IDs and Last-Write-Wins (LWW) conflict resolution for Azure sync.
* **Role-Based Access Control (RBAC)**: JWT authentication with Owner, Manager, and Salesperson roles and instant active/inactive account revocation.

## Scripts
* **Development Server**:
  ```powershell
  npm run dev
  ```
  Runs on `http://localhost:3000`.
* **Build**:
  ```powershell
  npm run build
  ```
* **Production Start**:
  ```powershell
  npm start
  ```
* **Integration Test Suite**:
  ```powershell
  npm run test:integration
  ```
  Executes the full 8-point end-to-end verification suite against the local database.

## Environment Variables (`.env`)
Configured in `./.env`:
* `PORT`: API port (default: 3000)
* `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: PostgreSQL credentials
* `JWT_SECRET`, `JWT_EXPIRES_IN`: Authentication security tokens
* `COUNTER_ID`: Active POS terminal identifier (e.g. `COUNTER-01`)
