# ADR 0001: Isolated Top-Level Folders for System Domains

## Status
Superseded / Updated

## Context
StockSync requires:
1. An Angular frontend configured with Tailwind CSS for touch-friendly POS operations.
2. A high-performance local backend API for business logic execution, offline resilience, and database operations.
3. A containerized PostgreSQL instance for multi-counter ACID row locking.
4. Comprehensive architectural and operational documentation.

Initially, a monorepo workspace was used. However, to eliminate cross-package symlink friction, avoid leaky abstractions, and ensure each subsystem can be developed, built, tested, and containerized completely independently without sharing build resources or toolchains, the repository is structured into dedicated, isolated top-level directories.

## Decision
We organize the repository into four self-contained top-level directories:
* `frontend/`: Standalone Angular 22 application with Tailwind CSS v4. Manages its own `package.json`, `tsconfig.json`, and UI domain models.
* `backend/`: Standalone Node.js / Express / TypeScript backend service. Manages its own `package.json`, `tsconfig.json`, `.env`, business logic, and independent 8-point integration test suite.
* `database/`: Standalone Docker configuration labeled `name: stocksync` and automated PostgreSQL 16 initialization DDL / seed scripts.
* `docs/`: Centralized markdown documentation, ADRs, blueprints, and artifact samples.

## Consequences
* **Positive**: Absolute folder isolation; zero cross-package dependency coupling; each service can be deployed, containerized, or migrated independently; Docker Desktop cleanly labels the project container group under `stocksync`.
* **Negative**: Shared TypeScript models (enums and DTOs) are maintained within each project's domain folder.
