# Database Schema & Concurrency Control

### 1. Entity-Relationship Overview

StockSync's PostgreSQL schema is designed for strict ACID compliance, auditability, and high-concurrency multi-counter operations.

```mermaid
erDiagram
    USERS ||--o{ TRANSACTIONS : "processes as cashier"
    USERS ||--o{ INVENTORY_LEDGER : "authorizes adjustment"
    CATEGORIES ||--o{ PRODUCTS : "contains"
    PRODUCTS ||--o{ TRANSACTION_ITEMS : "sold in"
    PRODUCTS ||--o{ INVENTORY_LEDGER : "stock modified"
    TRANSACTIONS ||--|{ TRANSACTION_ITEMS : "contains"
    TRANSACTIONS ||--o| SYNC_QUEUE : "tracked for sync"

    USERS {
        uuid id PK
        string username UK
        string password_hash
        string full_name
        user_role role
        boolean is_active
        timestamp created_at
    }

    CATEGORIES {
        uuid id PK
        string name UK
        string code UK
        text description
    }

    PRODUCTS {
        uuid id PK
        string barcode UK
        string sku UK
        string name
        uuid category_id FK
        numeric cost_price
        numeric selling_price
        numeric gst_rate
        int stock_quantity
        int min_stock_alert
        boolean is_active
        int version
    }

    INVENTORY_LEDGER {
        uuid id PK
        uuid product_id FK
        int change_quantity
        int previous_quantity
        int new_quantity
        reason_code reason_code
        string reference_id
        text notes
        uuid created_by FK
        timestamp created_at
    }

    TRANSACTIONS {
        uuid id PK
        string receipt_number UK
        uuid cashier_id FK
        string counter_id
        numeric subtotal
        numeric total_tax
        numeric total_discount
        numeric grand_total
        payment_method payment_method
        payment_status payment_status
        sync_status sync_status
        timestamp created_at
    }

    TRANSACTION_ITEMS {
        uuid id PK
        uuid transaction_id FK
        uuid product_id FK
        int quantity
        numeric unit_price
        numeric gst_rate
        numeric gst_amount
        numeric discount_amount
        numeric total_price
    }

    SYNC_QUEUE {
        uuid id PK
        string entity_type
        string entity_id
        jsonb payload
        bigint sequence_id
        sync_status status
        int retry_count
        timestamp created_at
    }
```

---

### 2. Multi-Counter Concurrency & Row-Level Locking

In a multi-checkout supermarket, two cashiers may scan the last remaining unit of an item at the exact same millisecond. Without strict locking, both transactions could pass, leading to negative inventory and accounting discrepancies.

#### Implementation Strategy

StockSync prevents this through explicit row locking:

```typescript
// 1. Sort item IDs deterministically to avoid cross-counter deadlocks
const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

await withTransaction(async (client) => {
  for (const item of sortedItems) {
    // 2. Lock product row exclusively
    const res = await client.query(
      `SELECT id, stock_quantity, selling_price, gst_rate 
       FROM products 
       WHERE id = $1 
       FOR UPDATE`,
      [item.productId]
    );

    const product = res.rows[0];
    if (product.stock_quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    // 3. Deduct stock safely
    await client.query(
      `UPDATE products 
       SET stock_quantity = stock_quantity - $1, version = version + 1 
       WHERE id = $2`,
      [item.quantity, item.productId]
    );

    // 4. Create immutable ledger entry
    await client.query(
      `INSERT INTO inventory_ledger (product_id, change_quantity, previous_quantity, new_quantity, reason_code, ...) 
       VALUES (...)`
    );
  }
});
```

* **Deadlock Prevention**: Sorting product IDs prior to acquisition guarantees that concurrent transactions request locks in identical order.
* **Row-Level Granularity**: While Product A is locked, checkouts scanning Product B run at full wire speed with zero blocking.
