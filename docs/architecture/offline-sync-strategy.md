# Offline Resilience & Data Synchronization

### 1. The Offline-First Paradigm

In supermarket environments, checkout stalls cause immediate customer churn and revenue loss. StockSync guarantees that checkout operations never stop due to broadband failures, Azure downtime, or network latency.

```mermaid
sequenceDiagram
    participant Cashier as POS Cashier
    participant Terminal as Angular POS UI
    participant LocalAPI as Local StockSync API
    participant LocalDB as Local PostgreSQL
    participant SyncWorker as Background Sync Worker
    participant Azure as Azure Cloud Service

    Cashier->>Terminal: Scan items & Complete Checkout
    Terminal->>LocalAPI: POST /api/transactions
    Note over LocalAPI,LocalDB: Begins Atomic Transaction
    LocalAPI->>LocalDB: SELECT ... FOR UPDATE (Lock products)
    LocalAPI->>LocalDB: Deduct stock & Add to inventory_ledger
    LocalAPI->>LocalDB: Insert transaction & items
    LocalAPI->>LocalDB: Insert into sync_queue (Status: PENDING)
    LocalDB-->>LocalAPI: COMMIT Success
    LocalAPI-->>Terminal: Transaction Confirmed + Receipt PDF
    Terminal-->>Cashier: Print / Display Receipt

    Note over SyncWorker,Azure: Async Sync Cycle (Internet Active)
    SyncWorker->>LocalDB: Fetch PENDING batches (FOR UPDATE SKIP LOCKED)
    SyncWorker->>Azure: POST /api/v1/sync/batch (Encrypted payload)
    alt Internet OK
        Azure-->>SyncWorker: 200 OK (Batch Committed)
        SyncWorker->>LocalDB: Mark sync_queue & transactions as SYNCED
    else Internet Outage
        SyncWorker->>LocalDB: Retain as PENDING, increment retry_count
        Note over LocalDB: Data remains safe locally
    end
```

---

### 2. Synchronization Queue Design

Every business-critical mutation (Transaction, Manual Stock Adjustment, Return, Price Change) generates an entry in `sync_queue`:

```sql
CREATE TABLE sync_queue (
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
```

#### Fields & Purpose
* **`sequence_id`**: A monotonically increasing `BIGSERIAL` integer that preserves the exact chronological order of store operations.
* **`payload`**: Complete self-contained snapshot of the business object, ensuring idempotency on the cloud destination.
* **`status`**: State machine (`PENDING` -> `IN_FLIGHT` -> `SYNCED` or `FAILED`).

---

### 3. Conflict Resolution: Last Write Wins (LWW)

When connectivity is restored after an extended offline period:
1. **Timestamp Authority**: The local store terminal's hardware clock (backed by RTC) provides ISO-8601 UTC timestamps for every transaction.
2. **Sequential Ingestion**: Cloud services process updates ordered by `(created_at, sequence_id)`.
3. **Idempotency**: If a network failure occurs during batch upload acknowledgment, re-transmitting the batch causes zero duplicate sales because cloud storage uses `entity_id` (UUID) as an upsert key.
