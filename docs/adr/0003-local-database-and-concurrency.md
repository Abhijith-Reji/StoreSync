# ADR 0003: Local PostgreSQL Database and Multi-Counter Concurrency

## Status
Accepted

## Context
Supermarkets often run multiple checkout counters during peak hours connected over a Local Area Network (LAN). The system must operate fully offline when the internet is down and prevent data collisions, double-selling, and negative inventory.

## Decision
1. **Containerized PostgreSQL 16**: Deployed locally on the main store terminal using Docker Compose with persistent data volumes (`stocksync_pgdata`).
2. **Pessimistic Row-Level Locking**: All inventory deductions during checkout execute inside an ACID transaction with `SELECT ... FOR UPDATE` on affected product rows.
3. **Deadlock Prevention**: Product IDs within a transaction are sorted deterministically in ascending order before lock acquisition.
4. **Immutable Inventory Ledger**: Every quantity change (SALE, RESTOCK, DAMAGE, WASTAGE, RETURN, AUDIT_ADJUSTMENT) writes an immutable record with mandatory reason codes, creating a complete audit trail.

## Consequences
* **Positive**: Zero possibility of overselling during simultaneous checkouts; strict ACID durability even during sudden power failure; robust audit trail for loss prevention.
* **Negative**: Local store terminal must keep Docker running while store is operating.
