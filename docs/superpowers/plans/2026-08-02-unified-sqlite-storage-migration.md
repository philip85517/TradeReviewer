# Unified SQLite Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mounted TradeReview SQLite database the single source of truth by migrating the current browser stores once and routing all business reads and writes through server APIs.

**Architecture:** Add a server-only SQLite adapter using Node's built-in `node:sqlite`, versioned SQL migrations, and typed storage contracts. Expose bootstrap, migration, trade, review, market-data, metadata, settings, and status APIs; refactor the client workspace to use those APIs. Keep browser storage only as a one-time migration source and temporary rollback copy.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Node 22.13+ `node:sqlite`, SQLite, Vitest, Testing Library, Docker Compose.

## Global Constraints

- The deployment is single-user and local; no login, account model, or multi-user isolation is required in this phase.
- The current browser data is migrated automatically on first upgrade.
- Migration is transactional, idempotent, and reports counts, conflicts, and validation results.
- The complete persistent data set is migrated: executions, import history, instruments, market data, coverage, reviews, drawings, tag suggestions, market-data jobs, and chart settings.
- After successful migration, normal business reads and writes use SQLite API endpoints only. Legacy browser data may remain temporarily as a read-only rollback copy, but is never consulted by the application again.
- The bundled XPEV demo remains available only to development/test paths and is not seeded into production SQLite.
- The Docker deployment uses `/var/lib/tradereview/tradereview.sqlite`, bind-mounted from `/Users/zhoulin/projects/TradeReview/data/sqlite/tradereview.sqlite`.
- Schema/data migration failures must not publish a new `app/current` release.
- The default deployment remains bound to `127.0.0.1`; public access requires a separate authentication decision.

---

## File and module map

Create focused units before wiring the large workspace component:

- `db/sqlite-schema.ts` — SQLite DDL, schema version, table names, and migration SQL.
- `db/sqlite.ts` — server-only `DatabaseSync` lifecycle, pragmas, transactions, and migration runner.
- `db/sqlite.test.ts` — temporary-file schema, transaction, and migration tests.
- `app/lib/storage/sqlite-contracts.ts` — shared JSON contracts for bootstrap, migration, CRUD, and status responses.
- `app/lib/storage/sqlite-store.ts` — server-side repository operations over the SQLite adapter.
- `app/lib/storage/sqlite-store.test.ts` — repository CRUD, upsert, and conflict tests.
- `app/api/storage/status/route.ts` — schema, migration, counts, and backup status.
- `app/api/storage/bootstrap/route.ts` — initial SQLite-backed workspace payload.
- `app/api/storage/migrate/route.ts` — idempotent browser-state migration endpoint.
- `app/api/storage/trades/route.ts` — execution, instrument, import-batch, and import-history reads/writes.
- `app/api/storage/reviews/route.ts` — review and tag-suggestion reads/writes.
- `app/api/storage/market-data/route.ts` — candle, coverage, provider-symbol, and sync-job reads/writes.
- `app/api/storage/settings/route.ts` — single-user chart settings.
- `app/lib/storage/sqlite-http-client.ts` — typed browser API client and HTTP error handling.
- `app/lib/storage/sqlite-repositories.ts` — API-backed implementations of existing repository interfaces.
- `app/lib/storage/browser-state-export.ts` — one-time serialization of all legacy localStorage/IndexedDB stores.
- `app/lib/storage/browser-state-migration.ts` — migration fingerprint, status marker, and retry behavior.
- `app/lib/storage/browser-state-export.test.ts` and `browser-state-migration.test.ts` — migration source and retry tests.
- `app/components/trade-review-workspace.tsx` — replace runtime legacy storage dependencies with API-backed storage and migration bootstrap.
- `app/components/trade-review-workspace.test.tsx` and `trade-review-workspace.import-flow.test.tsx` — API-backed import/review regression coverage.
- `deploy/ops/status.sh`, `deploy/ops/backup-db.sh`, `deploy/DEPLOYMENT.md` — report schema/data state and document the unified SQLite boundary.

The existing IndexedDB/localStorage repository files remain available only to the migration exporter and isolated legacy tests; no normal production path may import them for business reads or writes after Task 6.

## Task 1: Add the server-only SQLite foundation

**Files:**
- Create: `db/sqlite-schema.ts`
- Create: `db/sqlite.ts`
- Create: `db/sqlite.test.ts`

**Interfaces:**
- Produces `openSqliteDatabase(path?: string): DatabaseSync`, `initializeSqlite(database): void`, `withSqliteTransaction<T>(database, work): T`, and `SQLITE_DATABASE_PATH`.
- `initializeSqlite` applies all pending schema migrations and configures `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`.

- [ ] **Step 1: Write failing foundation tests**

Add tests that open a temporary SQLite file and assert:

```ts
it("creates the unified schema and applies required pragmas", () => {
  const database = openSqliteDatabase(tempDatabasePath());
  expect(database.prepare("select name from sqlite_master where type='table'").all()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "instruments" }),
      expect.objectContaining({ name: "executions" }),
      expect.objectContaining({ name: "schema_migrations" }),
    ]),
  );
  expect(database.prepare("pragma foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
});

it("rolls back a transaction when a write throws", () => {
  const database = openSqliteDatabase(tempDatabasePath());
  expect(() => withSqliteTransaction(database, () => {
    database.prepare(
      "insert into instruments (id, symbol, name, market, currency) values (?, ?, ?, ?, ?)",
    ).run("HK:700", "700", "腾讯控股", "HK", "HKD");
    throw new Error("abort");
  })).toThrow("abort");
  expect(database.prepare("select count(*) as count from instruments").get()).toEqual({ count: 0 });
});
```

- [ ] **Step 2: Run the foundation tests and verify they fail**

Run: `npm run test:unit -- db/sqlite.test.ts`

Expected: FAIL because the SQLite adapter and tables do not exist.

- [ ] **Step 3: Implement the schema and adapter**

Define tables for `schema_migrations`, `data_migrations`, `instruments`, `import_batches`, `executions`, `reviews`, `daily_candles`, `market_candles`, `coverage`, `interval_coverage`, `provider_symbols`, `tag_suggestions`, `market_data_jobs`, and `app_settings`. Store decimal quantities/prices as `TEXT`, JSON-valued evidence/drawings/revisions as validated JSON text, and add primary/unique keys matching the plan's upsert rules.

Use `node:sqlite` `DatabaseSync`; resolve the database path from `TRADEREVIEW_DB_PATH` or `/var/lib/tradereview/tradereview.sqlite`, create the parent directory only for a validated non-root path, and cache one connection per process. Apply migration rows in order and record a SHA-256 checksum for each migration.

- [ ] **Step 4: Run the foundation tests and verify they pass**

Run: `npm run test:unit -- db/sqlite.test.ts`

Expected: PASS, including schema creation, pragmas, transaction rollback, and migration checksum tests.

- [ ] **Step 5: Commit the foundation**

```bash
git add db/sqlite-schema.ts db/sqlite.ts db/sqlite.test.ts
git commit -m "feat: add sqlite storage foundation"
```

## Task 2: Define shared contracts and server repository operations

**Files:**
- Create: `app/lib/storage/sqlite-contracts.ts`
- Create: `app/lib/storage/sqlite-store.ts`
- Create: `app/lib/storage/sqlite-store.test.ts`
- Modify: `app/lib/storage/import-library.ts` only to export serialization helpers used by the migration contract, without changing legacy behavior yet.

**Interfaces:**
- `StorageBootstrap`: `{ schemaVersion, migration, executions, importHistory, instruments, reviews, tagSuggestions, marketDataJobs, settings }`.
- `BrowserStatePayload`: `{ version: 1, sourceClientId, sourceFingerprint, executions, importHistory, instruments, reviews, tagSuggestions, marketDataJobs, settings, dailyCandles, marketCandles, coverage, intervalCoverage, providerSymbols }`.
- `MigrationReport`: `{ sourceFingerprint, inserted, duplicate, conflict, failed, validationDigest }`.
- `SqliteStore`: `getStatus()`, `getBootstrap()`, `mergeBrowserState(payload)`, `mergeExecutions()`, `putReview()`, `putTagSuggestion()`, `putMarketData()`, `putSettings()`, and corresponding reads.

- [ ] **Step 1: Write failing repository tests**

Cover these named cases:

```ts
it("returns a complete bootstrap with empty production data");
it("upserts an instrument and execution in one transaction");
it("deduplicates a repeated browser migration by source fingerprint");
it("preserves a newer review when an older payload is retried");
it("stores and reads decimal fields without numeric coercion");
it("rolls back all tables when one browser-state record is invalid");
```

Use a new temporary database for each test and assert exact inserted/duplicate/conflict counts.

- [ ] **Step 2: Run repository tests and verify they fail**

Run: `npm run test:unit -- app/lib/storage/sqlite-store.test.ts`

Expected: FAIL because contracts and repository methods are absent.

- [ ] **Step 3: Implement contracts and repository**

Keep SQL in `sqlite-store.ts` and map rows to existing domain types (`TradeExecution`, `ImportHistoryEntry`, `EpisodeReviewRecord`, `TagSuggestionRecord`, `DailyCandleRecord`, and `MarketCandleRecord`). Validate JSON columns before writing. Reuse `reconcileExecutions` for execution conflicts and `updatedAt` for reviews. Record the migration fingerprint only after the transaction commits.

- [ ] **Step 4: Run repository tests and verify they pass**

Run: `npm run test:unit -- app/lib/storage/sqlite-store.test.ts`

Expected: PASS with deterministic upserts and rollback behavior.

- [ ] **Step 5: Commit the contracts and repository**

```bash
git add app/lib/storage/sqlite-contracts.ts app/lib/storage/sqlite-store.ts app/lib/storage/sqlite-store.test.ts app/lib/storage/import-library.ts
git commit -m "feat: add unified sqlite repository"
```

## Task 3: Expose status, bootstrap, and migration APIs

**Files:**
- Create: `app/api/storage/status/route.ts`
- Create: `app/api/storage/bootstrap/route.ts`
- Create: `app/api/storage/migrate/route.ts`
- Create: `app/api/storage/status/route.test.ts`
- Create: `app/api/storage/bootstrap/route.test.ts`
- Create: `app/api/storage/migrate/route.test.ts`

**Interfaces:**
- `GET /api/storage/status` returns `{ schemaVersion, migration, counts, databasePath }` without exposing filesystem internals beyond a stable database label.
- `GET /api/storage/bootstrap` returns `StorageBootstrap`.
- `POST /api/storage/migrate` accepts `BrowserStatePayload` and returns `MigrationReport`.

- [ ] **Step 1: Write failing route tests**

Assert:

```ts
it("returns status and counts without leaking the absolute database path");
it("returns a SQLite bootstrap payload for a single user");
it("rejects an unsupported migration payload version with 400");
it("returns a migration report and is idempotent on the same fingerprint");
it("returns 503 when the database cannot be opened");
```

Mock `getSqliteStore` with a temporary database or dependency injection; never use the production file in route tests.

- [ ] **Step 2: Run route tests and verify they fail**

Run: `npm run test:unit -- app/api/storage/status/route.test.ts app/api/storage/bootstrap/route.test.ts app/api/storage/migrate/route.test.ts`

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement the routes**

Parse JSON, enforce the versioned payload shape, map validation failures to 400, database failures to 503, and return structured `{ error: { code, message } }` responses. Set `Cache-Control: no-store` on all storage responses. Ensure route modules use the Node SQLite adapter in the Docker build and do not import browser globals.

- [ ] **Step 4: Run route tests and verify they pass**

Run: `npm run test:unit -- app/api/storage/status/route.test.ts app/api/storage/bootstrap/route.test.ts app/api/storage/migrate/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the storage APIs**

```bash
git add app/api/storage/status app/api/storage/bootstrap app/api/storage/migrate
git commit -m "feat: expose sqlite bootstrap and migration APIs"
```

## Task 4: Add CRUD APIs for trades, reviews, market data, and settings

**Files:**
- Create: `app/api/storage/trades/route.ts`
- Create: `app/api/storage/reviews/route.ts`
- Create: `app/api/storage/market-data/route.ts`
- Create: `app/api/storage/settings/route.ts`
- Create: matching `route.test.ts` files.

**Interfaces:**
- Trades route: `GET` returns executions/import history/instruments; `PUT` accepts a validated execution/import-batch merge request.
- Reviews route: `GET ?episodeId=` and `PUT` accept `EpisodeReviewRecord`; `GET ?suggestionsFor=` and `PUT` handle `TagSuggestionRecord`.
- Market-data route: `GET` accepts instrument/interval/range; `PUT` accepts candle and coverage commits matching existing `MarketDataRepository` contracts.
- Settings route: `GET` and `PUT` handle the existing `ChartSettings` shape.

- [ ] **Step 1: Write failing CRUD and validation tests**

Each route test must cover a successful read/write, malformed JSON rejection, unknown instrument rejection, duplicate upsert, and SQLite rollback on a failed batch. Market-data tests must assert that `1D` and `15m` keys cannot collide.

- [ ] **Step 2: Run the API tests and verify they fail**

Run: `npm run test:unit -- app/api/storage/trades app/api/storage/reviews app/api/storage/market-data app/api/storage/settings`

Expected: FAIL because the CRUD routes are absent.

- [ ] **Step 3: Implement the CRUD routes**

Use `SqliteStore` only; never call localStorage or IndexedDB from route modules. Validate all path/query parameters and JSON fields with explicit parsers. Return no-store responses and stable error codes (`invalid-request`, `not-found`, `conflict`, `storage-unavailable`).

- [ ] **Step 4: Run the API tests and verify they pass**

Run: `npm run test:unit -- app/api/storage/trades app/api/storage/reviews app/api/storage/market-data app/api/storage/settings`

Expected: PASS.

- [ ] **Step 5: Commit the CRUD APIs**

```bash
git add app/api/storage/trades app/api/storage/reviews app/api/storage/market-data app/api/storage/settings
git commit -m "feat: add sqlite business data APIs"
```

## Task 5: Build the typed browser API client and repository adapters

**Files:**
- Create: `app/lib/storage/sqlite-http-client.ts`
- Create: `app/lib/storage/sqlite-repositories.ts`
- Create: `app/lib/storage/sqlite-http-client.test.ts`
- Create: `app/lib/storage/sqlite-repositories.test.ts`
- Modify: `app/lib/storage/market-data-repository.ts`, `episode-review-repository.ts`, `instrument-metadata-repository.ts`, and `tag-suggestion-repository.ts` only to share stable interfaces with the API adapters.

**Interfaces:**
- `createSqliteHttpClient(fetcher = fetch)` returns `getStatus`, `getBootstrap`, `migrate`, `mergeExecutions`, `putReview`, `putTagSuggestion`, `get/putMarketData`, and `get/putSettings`.
- `ApiMarketDataRepository` implements `MarketDataRepository`.
- `ApiEpisodeReviewRepository` implements `EpisodeReviewRepository`.
- `ApiInstrumentMetadataRepository` and `ApiTagSuggestionRepository` implement their existing repository interfaces.

- [ ] **Step 1: Write failing client tests**

Mock `fetch` and assert exact method, URL, `Cache-Control`-safe request behavior, JSON body, response parsing, and conversion of non-2xx responses to `StorageHttpError` with `status` and server `code`.

- [ ] **Step 2: Run the client tests and verify they fail**

Run: `npm run test:unit -- app/lib/storage/sqlite-http-client.test.ts app/lib/storage/sqlite-repositories.test.ts`

Expected: FAIL because the client and adapters do not exist.

- [ ] **Step 3: Implement the client and adapters**

Keep the browser client independent of `node:sqlite`; it only performs same-origin `fetch`. Preserve existing pure sync/replay services by making them consume the same repository interfaces they already use.

- [ ] **Step 4: Run the client tests and verify they pass**

Run: `npm run test:unit -- app/lib/storage/sqlite-http-client.test.ts app/lib/storage/sqlite-repositories.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the API client**

```bash
git add app/lib/storage/sqlite-http-client.ts app/lib/storage/sqlite-repositories.ts app/lib/storage/sqlite-http-client.test.ts app/lib/storage/sqlite-repositories.test.ts app/lib/storage/market-data-repository.ts app/lib/storage/episode-review-repository.ts app/lib/storage/instrument-metadata-repository.ts app/lib/storage/tag-suggestion-repository.ts
git commit -m "feat: add sqlite browser API client"
```

## Task 6: Serialize and migrate all legacy browser state

**Files:**
- Create: `app/lib/storage/browser-state-export.ts`
- Create: `app/lib/storage/browser-state-migration.ts`
- Create: `app/lib/storage/browser-state-export.test.ts`
- Create: `app/lib/storage/browser-state-migration.test.ts`
- Modify: `app/lib/storage/indexeddb-schema.ts` only to expose a read-only `readAllTradeReviewStores(databaseName)` helper for migration.

**Interfaces:**
- `exportLegacyBrowserState(): Promise<BrowserStatePayload | null>` reads the current localStorage keys and all `trade-reviewer` object stores without deleting anything.
- `calculateBrowserStateFingerprint(payload): string` produces a stable SHA-256 fingerprint over canonical JSON.
- `migrateLegacyBrowserState(client, payload): Promise<MigrationReport>` posts once, retries on transport failure, and records only a migration marker after server validation succeeds.

- [ ] **Step 1: Write failing exporter tests**

Seed fake localStorage and fake IndexedDB with one record in every store, call `exportLegacyBrowserState`, and assert that the payload contains executions, import history, settings, reviews, suggestions, jobs, candles, coverage, provider symbols, and metadata. Assert the exporter does not remove any legacy key.

- [ ] **Step 2: Run exporter tests and verify they fail**

Run: `npm run test:unit -- app/lib/storage/browser-state-export.test.ts app/lib/storage/browser-state-migration.test.ts`

Expected: FAIL because the exporter and migration coordinator do not exist.

- [ ] **Step 3: Implement export, fingerprint, and migration retry**

Canonicalize record order before hashing. Use the existing parsers/repositories to validate legacy records. Set a migration marker only after the API returns a validation digest; leave legacy keys intact as a rollback copy. On a 4xx validation error, stop without marking; on network/503 errors, show retryable state.

- [ ] **Step 4: Run migration tests and verify they pass**

Run: `npm run test:unit -- app/lib/storage/browser-state-export.test.ts app/lib/storage/browser-state-migration.test.ts`

Expected: PASS, including idempotency, no deletion on failure, and retry after interruption.

- [ ] **Step 5: Commit the migration source**

```bash
git add app/lib/storage/browser-state-export.ts app/lib/storage/browser-state-migration.ts app/lib/storage/browser-state-export.test.ts app/lib/storage/browser-state-migration.test.ts app/lib/storage/indexeddb-schema.ts
git commit -m "feat: add browser to sqlite migration"
```

## Task 7: Refactor the workspace to SQLite as the only business source

**Files:**
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`
- Modify: `app/components/trade-review-workspace.import-flow.test.tsx`
- Modify: `app/components/review/episode-sidebar.tsx` only where import status/migration status is displayed.
- Create: `app/components/storage-migration-banner.tsx` and its test if the migration state needs a dedicated UI unit.

**Interfaces:**
- The workspace receives `createSqliteHttpClient()` as its default business storage dependency and may receive a test double through a dependency prop.
- `TradeReviewWorkspace` exposes `loading`, `migration`, `ready`, and `error` storage states; only `ready` renders the normal library/review UI.

- [ ] **Step 1: Write failing workspace tests**

Add tests that:

```tsx
it("boots from the SQLite bootstrap response without reading legacy execution storage");
it("migrates browser state before showing imported stocks");
it("shows a retryable migration error without clearing legacy data");
it("persists a new import through the trades API");
it("persists reviews, settings, market data, and suggestions through API repositories");
```

Keep the existing `showDemo={false}` production assertion and add a test that an empty SQLite bootstrap does not reintroduce XPEV.

- [ ] **Step 2: Run workspace tests and verify they fail**

Run: `npm run test:unit -- app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx`

Expected: FAIL because the workspace still loads and writes legacy browser storage directly.

- [ ] **Step 3: Implement SQLite bootstrap and writes**

Replace direct `loadImportedExecutions`, `saveImportedExecutions`, `loadImportHistory`, `saveImportHistoryEntry`, `loadReviewState`, `saveReviewState`, and default IndexedDB repositories in the production workspace path with the API client/adapters. Keep pure import parsing and replay calculations unchanged. Run migration coordination before bootstrap; block business UI on migration failure instead of falling back to legacy data.

- [ ] **Step 4: Run workspace tests and verify they pass**

Run: `npm run test:unit -- app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx`

Expected: PASS, including all existing import/review/replay regressions and the new API-backed tests.

- [ ] **Step 5: Commit the workspace refactor**

```bash
git add app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx app/components/review/episode-sidebar.tsx app/components/storage-migration-banner.tsx
git commit -m "feat: route workspace persistence through sqlite"
```

## Task 8: Make deployment status and backups report SQLite business state

**Files:**
- Modify: `deploy/ops/status.sh`
- Modify: `deploy/ops/backup-db.sh`
- Modify: `deploy/DEPLOYMENT.md`
- Modify: `scripts/deploy.test.mjs`

**Interfaces:**
- `make deploy-status` prints active release, configured bind/port, database size, schema version, migration status, per-table business counts, and latest backup checksum.
- `make deploy-backup` emits a metadata sidecar containing schema/data migration versions and record counts alongside the SQLite backup/checksum.

- [ ] **Step 1: Write failing deployment tests**

Add tests that initialize a temporary SQLite database, run the status command, and assert schema version and execution/instrument counts. Add backup tests asserting the metadata sidecar is written only after `quick_check` succeeds and is retained with the checksum.

- [ ] **Step 2: Run deployment tests and verify they fail**

Run: `npm run test:unit -- scripts/deploy.test.mjs`

Expected: FAIL because status and backup scripts do not expose SQLite business metadata.

- [ ] **Step 3: Implement status and backup metadata**

Query SQLite through the existing Compose `sqlite3` operations in `status.sh`, never by resolving arbitrary user paths. Keep the current atomic backup/restore and retention behavior. Document that all application releases reuse the same `data/sqlite` directory and that SQLite, not browser localdb, is the business source.

- [ ] **Step 4: Run deployment tests and verify they pass**

Run: `npm run test:unit -- scripts/deploy.test.mjs`

Expected: PASS, including existing path-safety and rollback tests.

- [ ] **Step 5: Commit deployment observability**

```bash
git add deploy/ops/status.sh deploy/ops/backup-db.sh deploy/DEPLOYMENT.md scripts/deploy.test.mjs
git commit -m "feat: report sqlite data and migration status"
```

## Task 9: Remove runtime legacy storage use and document rollout

**Files:**
- Modify: `app/lib/storage/import-transaction.ts` and legacy storage modules only to mark them migration-only and prevent accidental production imports.
- Modify: `tests/rendered-html.test.mjs`
- Create: `app/lib/storage/storage-boundary.test.ts`
- Create: `docs/superpowers/operations/unified-sqlite-rollout.md`

**Interfaces:**
- The production bundle must contain API-backed business persistence and no normal call sites to legacy `save*`/`load*` business functions.
- The rollout document records the exact migration, backup, status, restart, and browser verification commands.

- [ ] **Step 1: Write boundary regression tests**

Assert that a production workspace with an empty SQLite bootstrap renders the import-empty state, that no `localStorage`/IndexedDB business write occurs during import/review flows, and that the rendered production HTML contains no XPEV/demo records.

- [ ] **Step 2: Run the boundary tests and verify they fail**

Run: `npm run test:unit -- app/lib/storage/storage-boundary.test.ts tests/rendered-html.test.mjs`

Expected: FAIL until all runtime call sites use the API client.

- [ ] **Step 3: Remove accidental runtime legacy imports and add rollout documentation**

Leave legacy readers available to `browser-state-export.ts` only. Add comments and import boundaries that make the migration-only role explicit. Document:

```text
make deploy
make deploy-status
make deploy-backup
```

and the expected `127.0.0.1:4317`, `app/current`, bind mount, migration report, and backup checksum checks.

- [ ] **Step 4: Run boundary tests and verify they pass**

Run: `npm run test:unit -- app/lib/storage/storage-boundary.test.ts tests/rendered-html.test.mjs`

Expected: PASS with no production legacy storage writes.

- [ ] **Step 5: Commit the boundary cleanup**

```bash
git add app/lib/storage app/components/trade-review-workspace.tsx tests/rendered-html.test.mjs docs/superpowers/operations/unified-sqlite-rollout.md
git commit -m "feat: make sqlite the production storage source"
```

## Task 10: Run the complete verification and perform the one-time production migration

**Files:**
- No new source files; verify the complete tree and the existing deployment target.

- [ ] **Step 1: Run focused tests**

```bash
npm run test:unit -- db/sqlite.test.ts app/lib/storage/sqlite-store.test.ts app/api/storage app/lib/storage/browser-state-export.test.ts app/lib/storage/browser-state-migration.test.ts app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full checks**

```bash
npm run typecheck
npm run lint
npm run test:unit
npm test
git diff --check
```

Expected: all commands exit 0; rendered HTML has no production demo content.

- [ ] **Step 3: Deploy the reviewed source to the existing target**

Run from the reviewed source commit:

```bash
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy-status
```

Expected status: the same `tradereview-app-1`, bind `127.0.0.1:4317`, the same `data/sqlite` directory, a new `app/current` release, and a nonzero SQLite file with schema/data counts.

- [ ] **Step 4: Migrate and verify the existing browser profile**

Open `http://127.0.0.1:4317` in the browser profile containing the current records. Confirm the migration report totals match the previous browser state, then refresh and switch stocks to verify all data is loaded from SQLite.

- [ ] **Step 5: Back up and verify restart persistence**

```bash
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy-backup
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy-status
```

Restart the Compose service, reload the page, and run `make deploy-code`. Confirm the same SQLite record counts remain and the latest backup checksum is valid.

- [ ] **Step 6: Commit verification notes and final handoff**

Record the migration report, SQLite counts, backup path/checksum, active release, and any legacy browser cleanup decision in `docs/superpowers/operations/unified-sqlite-rollout.md`, then commit:

```bash
git add docs/superpowers/operations/unified-sqlite-rollout.md
git commit -m "docs: record unified sqlite rollout verification"
```
