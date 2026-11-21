-- StockSync Database Initialization Script
-- Offline-First Supermarket Management & POS System

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('OWNER', 'MANAGER', 'SALESPERSON');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('CASH', 'UPI', 'CARD', 'SPLIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('COMPLETED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reason_code AS ENUM ('SALE', 'RESTOCK', 'DAMAGE', 'WASTAGE', 'RETURN', 'AUDIT_ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sync_status AS ENUM ('PENDING', 'IN_FLIGHT', 'SYNCED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'SALESPERSON',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(100) UNIQUE NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12,2) NOT NULL,
    gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    min_stock_alert INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Immutable Inventory Ledger Table
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    change_quantity INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reason_code reason_code NOT NULL,
    reference_id VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Transactions / Orders Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    counter_id VARCHAR(50) NOT NULL DEFAULT 'COUNTER-01',
    subtotal NUMERIC(12,2) NOT NULL,
    total_tax NUMERIC(12,2) NOT NULL,
    total_discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12,2) NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'CASH',
    payment_status payment_status NOT NULL DEFAULT 'COMPLETED',
    notes TEXT,
    sync_status sync_status NOT NULL DEFAULT 'PENDING',
    sync_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Transaction Items Table
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    gst_rate NUMERIC(5,2) NOT NULL,
    gst_amount NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL
);

-- 7. Cloud Sync Queue Table
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    sequence_id BIGSERIAL,
    status sync_status NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Indexes for performance & concurrency
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_product ON inventory_ledger(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_reason ON inventory_ledger(reason_code);
CREATE INDEX IF NOT EXISTS idx_transactions_receipt ON transactions(receipt_number);
CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(sync_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_seq ON sync_queue(status, sequence_id);

-- SEED DATA
-- Default Passwords (bcrypt hash of 'StockSync@2026')
-- Hash: $2b$10$w0M9tHqTff4uD7kZgW8k9uV.6Oskx2wJjU44jUj/1l9pLdJ0j/f0G
-- Also providing bcrypt of 'Owner@123', 'Manager@123', 'Cashier@123'
-- For ease of testing, we store bcrypt hash of:
-- Owner: 'Owner@123' -> $2a$12$Z0tTqj4ZfM/TjE.Qp9cIbe2l.OQvR/fM7K7XvN.G7GvQf3z.g4Q8u
-- Manager: 'Manager@123'
-- Cashier: 'Cashier@123'
-- Using pgcrypto crypt() for portability:

INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES 
    ('owner', crypt('Owner@123', gen_salt('bf', 10)), 'Main Store Owner', 'OWNER', TRUE),
    ('manager', crypt('Manager@123', gen_salt('bf', 10)), 'Floor Shift Manager', 'MANAGER', TRUE),
    ('cashier1', crypt('Cashier@123', gen_salt('bf', 10)), 'POS Cashier 01', 'SALESPERSON', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Seed Categories
INSERT INTO categories (name, code, description)
VALUES 
    ('Groceries & Staples', 'GROC', 'Rice, flour, pulses, spices, and cooking staples'),
    ('Dairy & Bakery', 'DAIRY', 'Milk, butter, paneer, curd, bread, and bakery treats'),
    ('Beverages', 'BEV', 'Juices, cold drinks, teas, coffees, and health drinks'),
    ('Snacks & Packaged', 'SNACK', 'Biscuits, chips, noodles, and packaged snacks'),
    ('Personal & Home Care', 'CARE', 'Soaps, detergents, cleaners, and hygiene products')
ON CONFLICT (code) DO NOTHING;

-- Seed Products
DO $$
DECLARE
    groc_id UUID;
    dairy_id UUID;
    bev_id UUID;
    snack_id UUID;
    care_id UUID;
    owner_id UUID;
BEGIN
    SELECT id INTO groc_id FROM categories WHERE code = 'GROC';
    SELECT id INTO dairy_id FROM categories WHERE code = 'DAIRY';
    SELECT id INTO bev_id FROM categories WHERE code = 'BEV';
    SELECT id INTO snack_id FROM categories WHERE code = 'SNACK';
    SELECT id INTO care_id FROM categories WHERE code = 'CARE';
    SELECT id INTO owner_id FROM users WHERE username = 'owner';

    -- Insert products and record initial ledger entries
    IF NOT EXISTS (SELECT 1 FROM products WHERE barcode = '8901030001011') THEN
        INSERT INTO products (id, barcode, sku, name, description, category_id, cost_price, selling_price, gst_rate, stock_quantity, min_stock_alert)
        VALUES 
            ('a0000000-0000-0000-0000-000000000001', '8901030001011', 'SKU-RICE-BAS-5KG', 'Premium Basmati Rice 5kg', 'Aged long grain aromatic basmati rice', groc_id, 420.00, 520.00, 5.00, 100, 15),
            ('a0000000-0000-0000-0000-000000000002', '8901030001012', 'SKU-ATTA-WH-10KG', 'Chakki Fresh Whole Wheat Atta 10kg', '100% whole wheat stone ground flour', groc_id, 340.00, 410.00, 5.00, 80, 20),
            ('a0000000-0000-0000-0000-000000000003', '8901030002011', 'SKU-MILK-TON-1L', 'Pasteurized Toned Milk 1L', 'Fresh homogenized dairy milk', dairy_id, 54.00, 64.00, 0.00, 60, 10),
            ('a0000000-0000-0000-0000-000000000004', '8901030002012', 'SKU-BREAD-BRN-400G', 'Multigrain Brown Bread 400g', 'Enriched with oats, seeds, and malt', dairy_id, 38.00, 50.00, 0.00, 45, 10),
            ('a0000000-0000-0000-0000-000000000005', '8901030003011', 'SKU-TEA-PREM-500G', 'Premium CTC Black Tea 500g', 'Rich aroma and strong liquor', bev_id, 210.00, 275.00, 5.00, 75, 15),
            ('a0000000-0000-0000-0000-000000000006', '8901030003012', 'SKU-COFFEE-INST-100G', 'Classic Instant Coffee 100g', 'Pure roasted coffee granules', bev_id, 185.00, 240.00, 18.00, 50, 10),
            ('a0000000-0000-0000-0000-000000000007', '8901030004011', 'SKU-CHIP-SALT-100G', 'Classic Salted Potato Chips 100g', 'Crispy farm fresh potato wafers', snack_id, 32.00, 45.00, 12.00, 120, 25),
            ('a0000000-0000-0000-0000-000000000008', '8901030004012', 'SKU-COOK-CHOCO-200G', 'Dark Choco Chip Cookies 200g', 'Baked with rich cocoa and choco chips', snack_id, 48.00, 65.00, 18.00, 90, 20),
            ('a0000000-0000-0000-0000-000000000009', '8901030005011', 'SKU-SOAP-ANTI-125G', 'Antiseptic Bathing Bar 125g', 'Germ defense bathing soap', care_id, 30.00, 42.00, 18.00, 150, 30),
            ('a0000000-0000-0000-0000-000000000010', '8901030005012', 'SKU-DISH-GEL-750ML', 'Dishwash Gel Lemon 750ml', 'Tough grease removal dishwashing formula', care_id, 115.00, 155.00, 18.00, 65, 15);

        -- Record initial RESTOCK ledger entries for auditability
        INSERT INTO inventory_ledger (product_id, change_quantity, previous_quantity, new_quantity, reason_code, reference_id, notes, created_by)
        VALUES
            ('a0000000-0000-0000-0000-000000000001', 100, 0, 100, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000002', 80, 0, 80, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000003', 60, 0, 60, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000004', 45, 0, 45, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000005', 75, 0, 75, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000006', 50, 0, 50, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000007', 120, 0, 120, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000008', 90, 0, 90, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000009', 150, 0, 150, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id),
            ('a0000000-0000-0000-0000-000000000010', 65, 0, 65, 'RESTOCK', 'INITIAL-SEED', 'Initial warehouse stock onboarding', owner_id);
    END IF;
END $$;
