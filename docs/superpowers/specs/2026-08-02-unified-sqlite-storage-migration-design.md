# Unified SQLite Storage and Browser Data Migration Design

## Goal

Make `/Users/zhoulin/projects/TradeReview/data/sqlite/tradereview.sqlite` the
single source of truth for the single-user TradeReview deployment. Migrate the
existing browser `localStorage` and IndexedDB data once, then stop using the
legacy browser databases for business reads and writes. Keep the existing
deployment path so releases share one SQLite file and can be backed up,
restored, and migrated independently of application code releases.

## Confirmed scope

- The deployment is single-user and local; no login, account model, or
  multi-user isolation is required in this phase.
- The current browser data is migrated automatically on first upgrade.
- Migration is transactional, idempotent, and reports counts, conflicts, and
  validation results.
- The complete persistent data set is migrated: executions, import history,
  instruments, market data, coverage, reviews, drawings, tag suggestions,
  market-data jobs, and chart settings.
- After successful migration, normal business reads and writes use SQLite API
  endpoints only. Legacy browser data may remain temporarily as a read-only
  rollback copy, but is never consulted by the application again.
- The bundled XPEV demo remains available only to development/test paths and
  is not seeded into production SQLite.

## Current boundary

The browser currently owns imported executions and import history in
`localStorage`, while market data, reviews, metadata, and tag suggestions are
stored in the IndexedDB database named `trade-reviewer`. The deployment SQLite
file is currently a deployment placeholder: `db/schema.ts` is empty and the
application does not read or write the mounted file.

The target runtime keeps the existing bind mount:

```text
host:      /Users/zhoulin/projects/TradeReview/data/sqlite
container: /var/lib/tradereview
database:  /var/lib/tradereview/tradereview.sqlite
```

`make deploy` creates a new application release and updates `app/current`, but
does not replace this data directory.

## Architecture

The application becomes a server-backed single-user application:

```text
browser import/read
        |
        | HTTP API
        v
TradeReview Node service
        |
        v
/var/lib/tradereview/tradereview.sqlite
```

The server owns a dedicated SQLite data-access layer. The Docker deployment
uses Node's built-in `node:sqlite` driver (`DatabaseSync`) because the runtime
already requires Node 22.13 or newer; SQL and transaction logic stay outside
React components. The database path is configurable for tests and local
development, defaulting to `/var/lib/tradereview/tradereview.sqlite` in the
container. The existing Cloudflare/D1 adapter is not used by this Docker
deployment and is outside this migration's scope.

All business writes use explicit transactions, foreign-key enforcement, a
busy timeout, and WAL mode. Browser IndexedDB may be retained later as a
rebuildable market-data cache only if explicitly reintroduced; it is not a
source of truth for migrated business records.

## SQLite data model

The schema is versioned and migrated from the repository. Core tables are:

- `instruments`: canonical instrument ID, symbol, name, market, currency, and
  metadata timestamps.
- `import_batches`: source file or screenshot metadata, fingerprints, import
  time, and reconciliation counts.
- `executions`: one row per execution, preserving source evidence, account,
  instrument, side, timestamp, quantity, price, and fee. Quantity and price
  are stored as decimal strings to preserve current precision semantics.
- `reviews`: episode review records, including cursor, plan, review fields,
  revisions, and confirmed tags.
- `daily_candles` and `market_candles`: daily and intraday candles keyed by
  instrument, interval/date, adjustment mode, and timestamp.
- `coverage`, `interval_coverage`, and `provider_symbols`: market-data
  coverage and provider mapping state.
- `tag_suggestions`: suggestion evidence and decision state.
- `market_data_jobs`: durable sync status and interval progress.
- `app_settings`: single-user chart and application settings.
- `schema_migrations`: applied schema migration versions and checksums.
- `data_migrations`: browser migration source fingerprints, status, counts,
  and validation summaries.

Natural and foreign-key constraints prevent orphaned records. The execution
ID, import batch ID/fingerprint, instrument ID, review episode ID, suggestion
ID, and market candle composite keys are used for deterministic upserts.

## API contracts

The client uses business-oriented endpoints rather than accessing storage
directly:

- `GET /api/storage/bootstrap` returns instruments, executions, import history,
  settings, and migration status needed to initialize the workspace.
- `POST /api/storage/migrate` accepts a versioned browser-state payload and
  returns migration counts, conflicts, and validation summaries.
- `GET /api/storage/status` returns schema version, data-migration status,
  record counts, and backup metadata when available.
- `GET/PUT /api/reviews/*` reads and saves episode reviews.
- `GET/PUT /api/market-data/*` reads and saves candles, coverage, provider
  symbols, and sync jobs.
- `GET/PUT /api/instruments/*` reads and saves canonical instrument metadata.

Requests and responses are versioned JSON contracts. The server validates
payloads before opening a write transaction and never trusts client-provided
SQL or file paths.

## Browser migration

On first load after the migration-capable release:

1. The client requests `/api/storage/status`.
2. If the server has no matching completed migration, it reads the legacy
   browser stores and builds a versioned payload with a deterministic source
   fingerprint.
3. `POST /api/storage/migrate` merges the payload in one SQLite transaction.
4. Executions are deduplicated by execution ID and existing reconciliation
   rules; import batches use IDs and source fingerprints; instruments use
   canonical IDs; reviews use `updatedAt`; market data uses composite keys;
   tag suggestions use record IDs.
5. The endpoint records the source fingerprint and returns inserted,
   duplicate, conflict, and failed counts plus a validation digest.
6. Only after successful validation does the client switch all business reads
   and writes to SQLite APIs.

Repeated submissions are safe. If the network or browser closes during
migration, the transaction rolls back and the next attempt retries. The client
does not silently fall back to legacy business data after a failed migration;
it shows a retryable migration state. Legacy browser keys can remain as a
read-only rollback copy and are never used by normal runtime code.

## Backup, restore, and release behavior

The existing deployment scripts remain the operational boundary:

- `make deploy-backup` performs an online SQLite backup, runs `PRAGMA
  quick_check`, writes a SHA-256 checksum and migration metadata, and applies
  retention configured by `BACKUP_RETENTION_DAYS`.
- `make deploy-restore` creates a safety backup, restores to a temporary file,
  validates it, atomically swaps the database, and rolls back on startup or
  health-check failure.
- `make deploy-status` reports the active release, configured bind/port,
  database size, schema version, record counts, latest backup, and migration
  status.
- Application releases can be rolled back without changing SQLite. Database
  recovery is explicit through `deploy-restore`.

The deploy process always reuses
`/Users/zhoulin/projects/TradeReview/data/sqlite`; a new release must not copy,
truncate, or replace the database. The production entry remains
`showDemo={false}` and never seeds the XPEV fixture into SQLite.

## Errors and safety

- Database open, migration, or integrity errors stop the release before the
  new `app/current` pointer is published.
- API writes return structured errors and preserve the current client state for
  retry.
- Conflicts are reported with stable IDs and do not silently overwrite newer
  reviews or incompatible executions.
- The local deployment remains bound to `127.0.0.1` by default. Public access
  requires a separate authentication decision.
- Legacy browser data is not deleted automatically during the first migration;
  cleanup is a separate, explicit post-verification operation.

## Verification and rollout

Automated coverage must include:

- schema creation, upgrades, foreign keys, and rollback behavior;
- CRUD and transaction boundaries for every table;
- duplicate imports and conflict reconciliation;
- full browser localStorage/IndexedDB migration;
- interrupted migration retry and idempotency;
- backup integrity, checksum, restore, and failed-restore rollback;
- deployment status and release/database path consistency;
- production server-rendered output without XPEV/demo content.

Rollout sequence:

1. Deploy the SQLite schema/API/migration release to the existing
   `/Users/zhoulin/projects/TradeReview` target.
2. Open `http://127.0.0.1:4317` with the browser profile containing the current
   records and complete the automatic migration.
3. Confirm the migration report and SQLite record counts match the browser
   source.
4. Run `make deploy-backup` and verify the checksum.
5. Reload the page, restart the container, and run a code-only deployment;
   confirm all business data still comes from SQLite.
6. After an observation period and a verified backup, explicitly remove the
   legacy browser backup if desired.
