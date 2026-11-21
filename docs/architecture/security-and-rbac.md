# Security, Authentication & Role-Based Access Control

### 1. Role-Based Access Control (RBAC) Matrix

StockSync implements granular authorization to protect financial registers, inventory valuation, and system configuration.

| Feature / Resource | Owner | Manager | Salesperson (Cashier) |
| :--- | :---: | :---: | :---: |
| POS Checkout & Barcode Scan | Yes | Yes | Yes |
| Daily Drawer Totals & Cash Summary | Yes | Yes | Yes (Own register) |
| Digital & PDF Receipt Generation | Yes | Yes | Yes |
| Product Catalog Search | Yes | Yes | Yes |
| Manual Stock Adjustments (Wastage / Return) | Yes | Yes (Mandatory Reason) | No |
| View Inventory Audit Ledger | Yes | Yes | No |
| Onboard New Staff Accounts | Yes | Yes | No |
| Toggle Staff Active / Inactive Status | Yes | Yes | No |
| System Configuration & Global Settings | Yes | No | No |
| Remote Cloud Dashboard (Azure) | Yes | No | No |
| Force Azure Cloud Sync Trigger | Yes | Yes | No |

---

### 2. Authentication Flow & Token Lifecycle

* **Access Tokens**: JSON Web Tokens (JWT) signed using HMAC-SHA256 with 12-hour validity to avoid disruptive session expirations during 8-10 hour cashier shifts.
* **Refresh Tokens**: Cryptographically signed tokens (7-day validity) stored on Windows clients using **Windows Data Protection API (DPAPI)** to protect against disk theft or local file extraction.
* **Instant Revocation**: When an Owner or Manager toggles a staff account to `isActive = false`, the token authentication middleware checks `is_active` state upon token refresh or critical financial actions, instantly revoking access.

---

### 3. Screen Inactivity Lockout

To protect POS registers left unattended during slow store hours:
1. **Activity Monitor**: An inactivity observer runs on the Angular POS frontend, tracking keyboard strokes, mouse clicks, and touch gestures.
2. **Timeout Threshold**: Configurable between 15 and 30 minutes of detected screen idleness.
3. **Lock Screen Overlay**: Upon timeout, a modal lock screen obscures product and cart data, requiring the cashier's PIN or password to resume the active checkout session without losing scanned cart items.
