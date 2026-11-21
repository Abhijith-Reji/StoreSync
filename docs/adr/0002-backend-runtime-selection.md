# ADR 0002: Backend Runtime Selection: Node.js (TypeScript)

## Status
Accepted

## Context
The PRD states: "Backend API: ASP NET Core (C#) or Node js (TypeScript) for high performance business logic execution." Both .NET 10 and Node.js 24 were detected in the developer's environment.

## Decision
We select **Node.js (TypeScript)** with Express, connection pooling (`pg`), and transactional concurrency management for the local API:
1. **Seamless Monorepo Integration**: Both Angular and the backend share the identical TypeScript runtime, allowing direct consumption of `@stocksync/shared-types` without code generators or dual language tooling.
2. **Desktop Shell Affinity**: When packaging into a desktop client (Electron or Tauri), Node.js can be bundled directly into the application process without requiring the client machine to install or maintain the .NET runtime.
3. **Transparent Concurrency & Database Control**: Direct usage of `pg.Pool` and explicit transactions (`BEGIN`, `SELECT ... FOR UPDATE`, `COMMIT`) provides precise control over multi-counter row locks.
4. **Rich PDF Ecosystem**: High-performance streaming PDF generation using `pdfkit` for thermal receipt formatting without third-party native dependencies.

## Consequences
* **Positive**: Rapid startup, low memory footprint on cash register machines, zero-friction shared code, lightweight packaging.
* **Negative**: CPU-intensive background jobs should be offloaded to worker threads if complex analytics are added in future phases.
