-- StockSync Migration 02: Active Sessions, Password Tracking & Stock Dashboard Indexes

-- 1. User Sessions Table (Database-backed session management & sliding window token support)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    counter_id VARCHAR(50) NOT NULL DEFAULT 'COUNTER-01',
    refresh_token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Audit and security columns on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Category active status for soft deletes
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. High-Performance Indexes (Aligned with Supabase Postgres Best Practices)
-- Active session lookup & revocation checks
CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token_hash);

-- Low-stock query acceleration (Partial index for products at or below alert threshold)
CREATE INDEX IF NOT EXISTS idx_products_low_stock 
ON products(stock_quantity, min_stock_alert) 
WHERE is_active = TRUE;

-- Inventory valuation covering index
CREATE INDEX IF NOT EXISTS idx_products_valuation 
ON products(category_id, stock_quantity, cost_price, selling_price) 
WHERE is_active = TRUE;

-- Ledger audit queries by product, reason code, and timeline
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_audit 
ON inventory_ledger(product_id, reason_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_created 
ON inventory_ledger(created_at DESC);
