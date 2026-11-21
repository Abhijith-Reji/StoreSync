# StockSync: Setup & Development Guide

Welcome to **StockSync**, an offline-first supermarket management and accounting system designed for localized POS reliability, LAN multi-counter scalability, and asynchronous Azure cloud synchronization.

---

## 1. Prerequisites

Before setting up the project, ensure you have the following installed on your host operating system (Windows 10/11 recommended):

* **Node.js**: v20+ or v24+ (`node -v`)
* **npm**: v10+ or v11+ (`npm -v`)
* **Angular CLI**: v19+ or v22+ (`ng version`)
* **Docker Desktop**: Running with Linux container mode enabled (`docker --version`)

---

## 2. Dedicated Top-Level Folder Structure

StockSync is structured into isolated, completely self-contained top-level directories:

```
StoreSync/
├── frontend/                 # Self-contained Angular 22 + Tailwind CSS v4 POS Application
│   ├── src/                  # App components, services, and local models
│   ├── package.json          # Independent dependencies & scripts
│   └── tsconfig.json         # Isolated TypeScript config
├── backend/                  # Self-contained Node.js + TypeScript Local REST API
│   ├── src/                  # Controllers, services, ACID transactions, PDF engine
│   ├── scripts/              # Independent 8-point integration test suite
│   ├── .env                  # Backend environment configuration
│   ├── package.json          # Independent dependencies & scripts
│   └── tsconfig.json         # Isolated TypeScript config
├── database/                 # Self-contained PostgreSQL Docker setup
│   ├── docker-compose.yml    # Labeled with 'name: stocksync' for Docker Desktop
│   ├── init/                 # 01-init.sql: schema, tables, indexes, and seed accounts
│   ├── .env                  # Database connection credentials
│   └── README.md
├── docs/                     # Centralized technical documentation & ADRs
│   ├── architecture/         # System overview, sync strategy, schema, RBAC, PDF engine
│   ├── adr/                  # Architecture Decision Records
│   ├── sample-receipt.pdf    # Test-generated 80mm PDF receipt
│   └── setup-guide.md        # This guide
├── .agents/                  # Workspace custom skills (simple-review)
└── README.md                 # Root documentation and quickstart
```

---

## 3. Database Setup (Dockerized PostgreSQL)

StockSync relies on a localized PostgreSQL 16 container labeled with `name: stocksync` so that Docker Desktop cleanly categorizes it under "stocksync".

### A. Environment Configuration
Copy the template and set your local credentials in `database/.env`:
```powershell
cp database/.env.example database/.env
```
Ensure your `database/.env` specifies your secure password:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=stocksync_admin
DB_PASSWORD=your_secure_db_password_here
DB_NAME=stocksync_local
```

### B. Launch PostgreSQL Container
From the `database/` folder or the repository root:
```powershell
cd database
docker compose up -d
```

Verify that the container is healthy:
```powershell
docker compose ps
```

### C. Seed Users and Credentials
The database automatically seeds default accounts on initial startup:

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Owner** | `owner` | `Owner@123` | Full admin privileges, user management, sync controls |
| **Manager** | `manager` | `Manager@123` | Stock adjustments with reason codes, inventory audit, staff oversight |
| **Salesperson** | `cashier1` | `Cashier@123` | Fast POS barcode checkout, receipt generation, daily drawer |

---

## 4. Running the Backend API & Tests

Navigate to `backend/`:
```powershell
cd backend
npm install
```

### A. Run Integration Verification Test Suite
Executes all 8 end-to-end tests (Database, RBAC Auth, Barcode Search, Checkout with Row-Level Locking, 80mm PDF Receipt generation, Manual Stock Adjustment audit, Azure Sync queue, and User Revocation):
```powershell
npm run test:integration
```

### B. Start Backend API
```powershell
npm run dev
```
The API starts on `http://localhost:3000`. Test the health check endpoint:
```powershell
curl http://localhost:3000/api/health
```

---

## 5. Running the Angular POS Frontend

Navigate to `frontend/`:
```powershell
cd frontend
npm install
npm start
```
The POS interface will be available at `http://localhost:4200`.

---

## 6. Key Operational Endpoints

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service and PostgreSQL health check | Public |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | Public |
| `GET` | `/api/products` | Retrieve active product catalog and stock levels | Authenticated |
| `GET` | `/api/products/search?q=...` | Barcode/SKU/name rapid lookup | Authenticated |
| `POST` | `/api/transactions` | Execute checkout with row-level locking | Authenticated |
| `GET` | `/api/receipts/:id/pdf` | Stream binary 80mm PDF receipt | Authenticated |
| `POST` | `/api/products/adjust-stock` | Manual stock adjustment with mandatory reason code | Manager / Owner |
| `GET` | `/api/products/ledger` | View immutable inventory ledger audit trail | Manager / Owner |
| `GET` | `/api/users` | List staff accounts | Manager / Owner |
| `POST` | `/api/users` | Onboard staff member | Manager / Owner |
| `PATCH` | `/api/users/:id/status`| Instant access revocation (active/inactive toggle) | Manager / Owner |
| `GET` | `/api/sync/status` | View Azure sync queue status and pending count | Authenticated |
| `POST` | `/api/sync/trigger` | Trigger immediate cloud sync batch | Manager / Owner |

---

## 7. Security Standards & Secret Sanitization Policy for Public GitHub Release

To maintain a zero-leak security posture for open-source and public releases on GitHub, all contributors and future development sessions must adhere to the following standards:

### A. Zero Hardcoded Credentials in Source Code
* Never commit hardcoded fallback passwords, JWT secrets, database connection strings, or cloud API keys in TypeScript, JavaScript, or Docker files.
* Application config files (such as `backend/src/config/env.ts`) must require mandatory environment variables and fail fast at startup (`getRequiredEnv()`) if required secrets are absent, rather than falling back to default insecure strings.

### B. Strict `.gitignore` Enforcement
* All `.env`, `.env.*`, and `*.env` files across root, `backend/`, and `database/` are strictly ignored by `.gitignore`.
* Never run `git add -f` on any `.env` file containing real values.

### C. Clean Template Files (`.env.example`)
* Only committed templates (`.env.example`) are allowed in version control.
* Every `.env.example` file must contain generic placeholder values (e.g. `your_secure_db_password_here`, `your_jwt_secret_key_minimum_32_characters_here`, `your_azure_sync_api_key_here`).

### D. Default Seed Account Passwords
* Default dev accounts in database seed scripts (Owner, Manager, Cashier) are for local development onboarding only.
* Production deployments must immediately update default passwords upon first initialization.

### E. Pre-Commit Secret Audit
Before every push or release, verify that no credentials exist in tracked files:
```powershell
git ls-files | ForEach-Object { Select-String -Path $_ -Pattern "(password|secret|apikey|api_key)\s*[:=]\s*['\"][^'\"]+['\"]" }
```
Ensure all matches are purely generic template descriptions or safe config keys.
