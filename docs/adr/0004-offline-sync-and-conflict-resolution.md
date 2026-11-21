# ADR 0004: Offline Sync Strategy & Last Write Wins (LWW)

## Status
Accepted

## Context
Broadband outages should not disrupt in-store retail checkout. The owner needs remote visibility on an Azure dashboard when connectivity is active, but the POS must never block waiting for cloud responses.

## Decision
1. **Local-First Writes**: Transactions and ledger records commit immediately to local PostgreSQL and are placed into a local `sync_queue` table.
2. **Asynchronous Background Sync**: A background worker polls `sync_queue` for `PENDING` records, batches them, and transmits them to Azure via REST API.
3. **Last Write Wins (LWW)**: Timestamps generated at checkout time determine chronological precedence.
4. **Monotonic Sequences**: A `BIGSERIAL sequence_id` guarantees in-order playback and prevents data overwrites.

## Consequences
* **Positive**: 100% checkout uptime during WAN outages; minimal bandwidth consumption via batching; eventual consistency for the owner's dashboard.
* **Negative**: Cloud dashboard data represents the state as of the last successful sync cycle during store internet disconnection.
