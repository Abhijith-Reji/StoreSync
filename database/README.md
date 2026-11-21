# StockSync Local Database

Containerized PostgreSQL 16 database instance for StockSync offline-first supermarket management.

## Starting the Database
1. Copy `.env.example` to `.env` (if not already done) and specify a secure database password:
   ```powershell
   cp .env.example .env
   ```
2. Start the container in detached mode:
   ```powershell
   docker compose up -d
   ```
The Docker Compose file is explicitly named `name: stocksync` so that it displays under the "stocksync" group in Docker Desktop.

## Stopping the Database
```powershell
docker compose down
```

## Configuration & Credentials
Database credentials are read exclusively from your local `.env` file (which is excluded from version control):
* **Host**: `localhost`
* **Port**: `5432` (or configured `DB_PORT`)
* **Database**: `stocksync_local`
* **User**: `stocksync_admin`
* **Password**: Set via `DB_PASSWORD` in `.env`

The database automatically initializes all tables, enums, indexes, and initial seed accounts from `./init/01-init.sql`.
