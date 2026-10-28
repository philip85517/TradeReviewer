import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { createTradeChanges, getSqliteStore } from "../../lib/storage/sqlite-store";
import { copyStoredTradeSnapshotRows, materializeStoredTradeSnapshot } from "../../lib/storage/stored-trade-snapshot";
import { assembleTradeReadPages, encodeTradeRead, parseTradeReadPage, tradeDisplayProjection } from "../../lib/storage/trade-read-contract";
import { saveImportedExecutions } from "../../lib/storage/import-library";
import type { SqliteHttpClient } from "../../lib/storage/sqlite-http-client";

/** The old UI fixtures keep browser storage for their assertions, but writes use
 * the real coordinator and snapshot contracts in an isolated memory database. */
export function formalWorkspaceClient(base: SqliteHttpClient, databases: DatabaseSync[]): SqliteHttpClient {
  let database: DatabaseSync | undefined;
  let starting: Promise<DatabaseSync> | undefined;
  async function start(client: SqliteHttpClient) {
    if (database) return database;
    if (!starting) starting = (async () => {
      const bootstrap = await client.getBootstrap();
      const db = new DatabaseSync(":memory:");
      databases.push(db);
      initializeSqlite(db);
      getSqliteStore(db).mergeTradeData({ executions: bootstrap.executions, instruments: bootstrap.instruments, importHistory: bootstrap.importHistory });
      database = db;
      return db;
    })();
    return starting;
  }
  const client: SqliteHttpClient = {
    ...base,
    async getBootstrap() {
      if (!database) return base.getBootstrap();
      return { ...await base.getBootstrap(), ...getSqliteStore(database).getBootstrap() };
    },
    async prepareTradeChanges(intent) { return createTradeChanges(await start(client)).prepare(intent); },
    async commitTradeChanges(input) {
      const db = await start(client);
      const receipt = createTradeChanges(db).commit(input);
      saveImportedExecutions(getSqliteStore(db).getExecutions());
      return receipt;
    },
    async getTradeCommit(requestId) { return createTradeChanges(await start(client)).getCommit(requestId); },
    async getInstrumentMetadata(ids) { return { instruments: getSqliteStore(await start(client)).getInstrumentMetadata(ids) }; },
    async putInstrumentMetadata(record) { getSqliteStore(await start(client)).putInstrumentMetadata(record); return { ok: true }; },
    async readTradeSnapshot(selection = {}) {
      const db = await start(client), store = getSqliteStore(db);
      const snapshot = materializeStoredTradeSnapshot(copyStoredTradeSnapshotRows(db), selection);
      const display = tradeDisplayProjection(snapshot, store.getBootstrap());
      return parseTradeReadPage({ snapshot, display, payloadDigest: `sha256:${createHash("sha256").update(encodeTradeRead({ snapshot, display })).digest("hex")}` });
    },
    async readTradeBook(selection = {}) {
      const pages = [];
      let cursor: string | undefined;
      do {
        const page = await client.readTradeSnapshot!({ ...selection, ...(cursor ? { cursor } : {}) });
        pages.push(page);
        cursor = page.snapshot.nextCursor ?? undefined;
      } while (cursor);
      return assembleTradeReadPages(pages);
    },
    async putInstrumentName(input) {
      const db = await start(client);
      getSqliteStore(db).putInstrumentName(input);
      saveImportedExecutions(getSqliteStore(db).getExecutions());
      return { ok: true };
    },
  };
  return client;
}
