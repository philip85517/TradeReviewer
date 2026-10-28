import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite";
import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
import { SqliteStore } from "./sqlite-store";
import type { TradeExecution } from "../trades/types";
import {
  assertBookVersion, BookVersionChangedError, BookVersionUnavailableError,
  readBookVersion, rotateBookEpoch,
} from "./trade-book-version";

const databases: DatabaseSync[] = [];
const directories: string[] = [];
afterEach(() => {
  for (const database of databases.splice(0).reverse()) if (database.isOpen) database.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function database(path = ":memory:", initialize = true) {
  const db = new DatabaseSync(path);
  databases.push(db);
  if (initialize) initializeSqlite(db);
  return db;
}
function isolatedPath() {
  const directory = mkdtempSync(join(tmpdir(), "trade-book-version-"));
  directories.push(directory);
  return join(directory, "book.sqlite");
}
function fill(id = "fill-1"): TradeExecution {
  return {
    id, accountId: "account-a", accountLabel: "Account A",
    instrument: { id: "HK:700", symbol: "700", name: "Name", market: "HK", currency: "HKD" },
    source: { platform: "broker", row: 1 }, side: "buy", executedAt: "2026-01-01",
    quantity: "1.00000000000000000001", price: "10", fee: "0",
  };
}

describe("persistent trade book version migration", () => {
  it("creates a persistent identity, recovery epoch and initial sequence", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    initializeSqlite(database);
    // Without this row callers cannot detect newly inserted facts or a restored book.
    expect(database.prepare("select name from sqlite_master where type = 'table' and name = 'trade_book_state'").get())
      .toEqual({ name: "trade_book_state" });
    expect(database.prepare("select database_id, epoch, sequence from trade_book_state").get())
      .toEqual({ database_id: expect.any(String), epoch: expect.any(String), sequence: 0 });
    expect(database.prepare("select version, name from schema_migrations where version = 15").get())
      .toEqual({ version: 15, name: "persist-trade-book-version-and-legacy-write-coverage" });
  });

  it("upgrades exactly the prior 14 migrations while preserving facts, JSON and checksums", () => {
    const db = database(":memory:", false);
    db.exec("create table schema_migrations(version integer primary key, name text not null, checksum text not null)");
    const prior = SQLITE_MIGRATIONS.filter((migration) => migration.version <= 14);
    for (const migration of prior) {
      db.exec(migration.sql);
      db.prepare("insert into schema_migrations values (?, ?, ?)").run(migration.version, migration.name, migration.checksum);
    }
    db.exec("insert into instruments(id,symbol,name,market,currency) values ('HK:700','700','Name','HK','HKD')");
    db.exec("insert into import_batches(id,imported_at,evidence_json) values ('old','2026-01-01','{\"raw\":\"unchanged\"}')");
    db.exec("insert into executions(id,instrument_id,side,executed_at,quantity,price,evidence_json) values ('old-fill','HK:700','buy','2026-01-01','0.12345678901234567890','0','{\"source\":{\"row\":1}}')");
    initializeSqlite(db);
    const version = readBookVersion(db);
    expect(version.sequence).toBe(0);
    expect(db.prepare("select quantity, price, evidence_json from executions").get())
      .toEqual({ quantity: "0.12345678901234567890", price: "0", evidence_json: '{"source":{"row":1}}' });
    expect(db.prepare("select evidence_json from import_batches").get()).toEqual({ evidence_json: '{"raw":"unchanged"}' });
    expect(db.prepare("select version, checksum from schema_migrations where version <= 14 order by version").all())
      .toEqual(prior.map(({ version, checksum }) => ({ version, checksum })));
    initializeSqlite(db);
    expect(readBookVersion(db)).toEqual(version);
  });

  it("rejects an unknown future schema before applying migrations or changing journal mode", () => {
    const db = database(":memory:", false);
    db.exec("create table schema_migrations(version integer primary key,name text not null,checksum text not null)");
    db.exec("insert into schema_migrations values (999,'future','future')");
    const before = db.prepare("select name,sql from sqlite_master order by name").all();
    expect(() => initializeSqlite(db)).toThrow(expect.objectContaining({ code: "SQLITE_SCHEMA_UNSUPPORTED" }));
    expect(db.prepare("select name,sql from sqlite_master order by name").all()).toEqual(before);
    expect(db.prepare("select version from schema_migrations").all()).toEqual([{ version: 999 }]);
  });

  it("tracks legacy new, revised and removed executions and rolls back its version atomically", () => {
    const db = database();
    const store = new SqliteStore(db);
    const initial = readBookVersion(db);
    store.mergeExecutions([fill()]);
    const inserted = readBookVersion(db);
    expect(inserted.sequence).toBeGreaterThan(initial.sequence);
    store.mergeExecutions([{ ...fill("fill-2"), executedAt: "2026-01-02" }]);
    const added = readBookVersion(db);
    expect(added.sequence).toBeGreaterThan(inserted.sequence);
    db.exec("begin immediate");
    db.exec("update executions set quantity = '2' where id = 'fill-1'");
    expect(readBookVersion(db).sequence).toBeGreaterThan(added.sequence);
    db.exec("rollback");
    expect(readBookVersion(db)).toEqual(added);
    db.exec("update executions set price = '20' where id = 'fill-1'");
    const revised = readBookVersion(db);
    expect(revised.sequence).toBeGreaterThan(added.sequence);
    db.exec("delete from executions where id = 'fill-1'");
    expect(readBookVersion(db).sequence).toBeGreaterThan(revised.sequence);
  });

  it("ignores repeated facts, presentation names and account labels", () => {
    const db = database();
    const store = new SqliteStore(db);
    store.mergeExecutions([fill()]);
    const before = readBookVersion(db);
    store.mergeExecutions([fill()]);
    db.exec("update instruments set name='New name',localized_name_json='{\"name\":\"新名字\"}',updated_at='later'");
    db.exec("update executions set evidence_json=json_set(evidence_json,'$.accountLabel','New display'),updated_at='later'");
    expect(readBookVersion(db)).toEqual(before);
  });

  it("tracks evidence semantic changes while ignoring object order and JSON whitespace", () => {
    const db = database();
    db.prepare("insert into import_batches(id,imported_at,reconciliation_json,evidence_json) values (?,?,?,?)")
      .run("material", "2026-01-01", '{"monthly":{"quantity":"5","events":[1,2]},"count":1}', '{"original":{"a":1,"b":2}}');
    const before = readBookVersion(db);
    db.prepare("update import_batches set reconciliation_json=?,evidence_json=? where id='material'")
      .run('{ "count":1.0, "monthly":{"events":[1,2],"quantity":"5"} }', '{"original":{"b":2,"a":1}}');
    expect(readBookVersion(db)).toEqual(before);
    db.exec("update import_batches set reconciliation_json=json_set(reconciliation_json,'$.monthly.quantity','6') where id='material'");
    const changed = readBookVersion(db);
    expect(changed.sequence).toBeGreaterThan(before.sequence);
    db.exec("update import_batches set evidence_json='{\"original\":{\"a\":1,\"b\":3}}'");
    expect(readBookVersion(db).sequence).toBeGreaterThan(changed.sequence);
    const evidence = readBookVersion(db);
    db.exec("update import_batches set reconciliation_json=json_set(reconciliation_json,'$.monthly.events',json('[2,1]'))");
    expect(readBookVersion(db).sequence).toBeGreaterThan(evidence.sequence);
  });

  it.each([
    ["large adjacent integers", '{"n":1000000000000000000000001}', '{"n":1000000000000000000000002}', true],
    ["negative adjacent integers", '{"n":-1000000000000000000000001}', '{"n":-1000000000000000000000002}', true],
    ["long fraction", '{"n":1.000000000000000000000001}', '{"n":1.000000000000000000000002}', true],
    ["underflow", '{"n":1e-400}', '{"n":2e-400}', true],
    ["overflow", '{"n":1e400}', '{"n":2e400}', true],
    ["unbounded positive exponents", '{"n":1e999999999999999999999}', '{"n":1e1000000000000000000000}', true],
    ["unbounded negative exponents", '{"n":1e-999999999999999999999}', '{"n":1e-1000000000000000000000}', true],
    ["zero versus underflow", '{"n":0}', '{"n":1e-999999999999999999999}', true],
    ["ordinary numeric equivalence", '{"n":1}', '{ "n":10.00e-1 }', false],
    ["negative numeric equivalence", '{"n":-0.01}', '{"n":-100e-4}', false],
    ["signed zero", '{"n":0}', '{"n":-0.000e999999999999999999999}', false],
    ["large exact equivalence", '{"n":1000000000000000000000001}', '{"n":1.000000000000000000000001e24}', false],
    // Coordinator ruling: >15-digit effective exponents may conservatively
    // invalidate equivalent rewrites; ordinary exact equivalence stays required.
    ["conservative large exponent carry", '{"n":10e99999999999999999999}', '{"n":1e100000000000000000000}', true],
    ["conservative large exponent borrow", '{"n":0.1e100000000000000000000}', '{"n":1e99999999999999999999}', true],
    ["conservative negative exponent carry", '{"n":10e-100000000000000000000}', '{"n":1e-99999999999999999999}', true],
    ["conservative negative exponent borrow", '{"n":0.1e-99999999999999999999}', '{"n":1e-100000000000000000000}', true],
    ["exponent leading zeros", '{"n":1e+000000000000000000000002}', '{"n":100}', false],
    ["15-digit exponent equivalence", '{"n":10e999999999999998}', '{"n":1e999999999999999}', false],
    ["15-digit negative exponent equivalence", '{"n":0.1e-999999999999998}', '{"n":1e-999999999999999}', false],
    ["long coefficient equivalence", `{"n":1${"2345678901".repeat(40)}}`, `{"n":1.${"2345678901".repeat(40)}e400}`, false],
    ["long coefficient last digit", `{"n":1${"2345678901".repeat(40)}1}`, `{"n":1${"2345678901".repeat(40)}2}`, true],
    ["nested object order", '{"a":{"x":1,"y":2},"b":[]}', '{"b":[],"a":{"y":2.0,"x":1e0}}', false],
    ["array order", '{"n":[1,2]}', '{"n":[2,1]}', true],
    ["null versus absence", '{"n":null}', '{}', true],
    ["number versus string", '{"n":1}', '{"n":"1"}', true],
    ["boolean versus number", '{"n":false}', '{"n":0}', true],
    ["duplicate last value", '{"n":1,"n":2}', '{"n":1,"n":3}', true],
    ["escaped duplicate number", '{"n":1,"\\u006e":1000000000000000000000001}', '{"n":1,"\\u006e":1000000000000000000000002}', true],
    ["decoded object keys", '{"n":1}', '{"\\u006e":1.0}', false],
    ["quoted key numbers", '{"a\\\"b":1.000000000000000000000001}', '{"a\\\"b":1.000000000000000000000002}', true],
    ["nested escaped keys", '{"n":{"a\\\"b":1000000000000000000000001}}', '{"\\u006e":{"a\\\"b":1000000000000000000000001}}', false],
    ["NUL key numeric change", '{"x\\u0000y":1000000000000000000000001}', '{"x\\u0000y":1000000000000000000000002}', true],
    ["distinct decoded paths", '{"a/b":{"c":1}}', '{"a":{"b/c":1}}', true],
    ["identical duplicate text", '{"n":1,"n":2}', '{"n":1,"n":2}', false],
  ])("compares exact JSON semantics: %s", (_label, beforeJson, afterJson, changed) => {
    const db = database();
    db.prepare("insert into import_batches(id,imported_at,reconciliation_json,evidence_json) values ('precision','now',?,?)").run(beforeJson, beforeJson);
    const before = readBookVersion(db);
    db.prepare("update import_batches set reconciliation_json=?,evidence_json=? where id='precision'").run(afterJson, afterJson);
    expect(readBookVersion(db).sequence > before.sequence).toBe(changed);
  });

  it.each([
    ["root labels with large token", '{"accountLabel":"A","n":1000000000000000000000001}', '{"accountLabel":"B","n":1000000000000000000000001}', false],
    ["numeric change beside ignored root", '{"accountLabel":"A","n":1000000000000000000000001}', '{"accountLabel":"B","n":1000000000000000000000002}', true],
    ["nested label", '{"source":{"accountLabel":"A"}}', '{"source":{"accountLabel":"B"}}', true],
    ["root label subtree", '{"accountLabel":{"n":1}}', '{"accountLabel":{"n":2}}', false],
    ["duplicate ignored labels", '{"accountLabel":"A","accountLabel":"B","n":1}', '{"accountLabel":"C","accountLabel":"D","n":1}', false],
    ["escaped ignored label", '{"accountLabel":"A","n":1}', '{"\\u0061ccountLabel":"B","n":1}', false],
    ["label inside array", '[{"accountLabel":"A"}]', '[{"accountLabel":"B"}]', true],
  ])("excludes only configured root JSON branches: %s", (_label, beforeJson, afterJson, changed) => {
    const db = database();
    new SqliteStore(db).mergeExecutions([fill()]);
    db.prepare("update executions set evidence_json=?").run(beforeJson);
    const before = readBookVersion(db);
    db.prepare("update executions set evidence_json=?").run(afterJson);
    expect(readBookVersion(db).sequence > before.sequence).toBe(changed);
  });

  it("keeps exact semantics at the inclusive byte and node bounds", () => {
    const db = database();
    const update = db.prepare("update import_batches set evidence_json=? where id='boundary'");
    const padding = "x".repeat(4096 - Buffer.byteLength(JSON.stringify({ padding: "", n: 1 })));
    const wide = Object.fromEntries(Array.from({ length: 63 }, (_, i) => [`k${i}`, i]));
    const cases = [
      [JSON.stringify({ padding, n: 1 }), JSON.stringify({ n: 1, padding })],
      [JSON.stringify(wide), JSON.stringify(Object.fromEntries(Object.entries(wide).reverse()))],
    ];
    expect(Buffer.byteLength(cases[0][0])).toBe(4096);
    db.exec("insert into import_batches(id,imported_at,evidence_json) values ('boundary','now','{}')");
    for (const [beforeJson, afterJson] of cases) {
      update.run(beforeJson);
      const before = readBookVersion(db);
      update.run(afterJson);
      expect(readBookVersion(db)).toEqual(before);
    }
  });

  it("conservatively invalidates changed JSON beyond the byte or node bound", () => {
    const db = database();
    const update = db.prepare("update import_batches set evidence_json=? where id='bounded'");
    const padding = "x".repeat(4097 - Buffer.byteLength(JSON.stringify({ padding: "", n: 1 })));
    const wide = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`k${i}`, i]));
    const cases = [
      [JSON.stringify({ padding, n: 1 }), JSON.stringify({ n: 1, padding })],
      [JSON.stringify(wide), JSON.stringify(Object.fromEntries(Object.entries(wide).reverse()))],
      [`{"n":1${"0".repeat(5000)}}`, '{"n":1e5000}'],
      [`{"n":1${"0".repeat(5000)}1}`, `{"n":1${"0".repeat(5000)}2}`],
    ];
    db.exec("insert into import_batches(id,imported_at,evidence_json) values ('bounded','now','{}')");
    for (const [beforeJson, afterJson] of cases) {
      update.run(beforeJson);
      const before = readBookVersion(db);
      update.run(beforeJson); // Same text remains a no-op at every size.
      expect(readBookVersion(db)).toEqual(before);
      update.run(afterJson);
      expect(readBookVersion(db).sequence).toBeGreaterThan(before.sequence);
    }
  });

  it("ignores a large JSON root label edit without losing adjacent original numeric tokens", () => {
    const db = database();
    new SqliteStore(db).mergeExecutions([fill()]);
    const update = db.prepare("update executions set evidence_json=?");
    const longNumber = `1${"0".repeat(5000)}`;
    update.run(`{"accountLabel":"A","n":${longNumber}1}`);
    const before = readBookVersion(db);
    update.run(`{"accountLabel":"B","n":${longNumber}1}`);
    expect(readBookVersion(db)).toEqual(before);
    update.run(`{"accountLabel":"C","n":${longNumber}2}`);
    expect(readBookVersion(db).sequence).toBeGreaterThan(before.sequence);
  });

  it("tracks source associations, security identities and audited identity mappings", () => {
    const db = database();
    new SqliteStore(db).mergeExecutions([fill()]);
    const before = readBookVersion(db);
    db.exec("update executions set evidence_json=json_set(evidence_json,'$.source.row',2)");
    const sourceChanged = readBookVersion(db);
    expect(sourceChanged.sequence).toBeGreaterThan(before.sequence);
    db.exec("update instruments set symbol='00700'");
    const identityChanged = readBookVersion(db);
    expect(identityChanged.sequence).toBeGreaterThan(sourceChanged.sequence);
    db.exec("insert into tradingview_account_migration_operations(operation_id,operation_kind,idempotency_key,plan_digest,base_snapshot_digest,status,request_json,result_json,created_at,updated_at) values ('op','commit','request','plan','base','committed','{}','{}','now','now')");
    expect(readBookVersion(db)).toEqual(identityChanged);
    db.exec("insert into tradingview_account_migration_aliases values ('op','account','old-account','new-account')");
    const aliasChanged = readBookVersion(db);
    expect(aliasChanged.sequence).toBeGreaterThan(identityChanged.sequence);
    db.exec("update tradingview_account_migration_aliases set new_id='corrected-account'");
    expect(readBookVersion(db).sequence).toBeGreaterThan(aliasChanged.sequence);
  });

  it("does not version Recall, settings, market caches or provider symbols", () => {
    const db = database();
    new SqliteStore(db).mergeExecutions([fill()]);
    const before = readBookVersion(db);
    db.exec("insert into recall_documents(episode_id,draft_json,updated_at) values ('episode','{}','now')");
    db.exec("insert into app_settings(key,value_json) values ('theme','\"dark\"')");
    db.exec("insert into market_candles(instrument_id,interval,timestamp,open,high,low,close) values ('HK:700','1d','2026-01-01','1','1','1','1')");
    db.exec("insert into provider_symbols(instrument_id,provider,provider_symbol) values ('HK:700','market-provider','HK.00700')");
    db.exec("update instruments set metadata_json='{\"exchange\":\"HKEX\",\"name\":\"Display\"}'");
    expect(readBookVersion(db)).toEqual(before);
  });

  it("keeps both identity and sequence across restart and sees another connection's commits", () => {
    const path = isolatedPath();
    const first = database(path);
    const original = readBookVersion(first);
    first.close();
    const reader = database(path);
    expect(readBookVersion(reader)).toEqual(original);
    const writer = database(path);
    reader.exec("begin deferred");
    expect(readBookVersion(reader)).toEqual(original);
    new SqliteStore(writer).mergeExecutions([fill()]);
    expect(readBookVersion(reader)).toEqual(original);
    reader.exec("commit");
    const committed = readBookVersion(reader);
    expect(committed.sequence).toBeGreaterThan(original.sequence);
    expect(() => assertBookVersion(reader, original)).toThrow(BookVersionChangedError);
    expect(() => assertBookVersion(reader, committed)).not.toThrow();
    writer.close();
    reader.close();
    expect(readBookVersion(database(path))).toEqual(committed);
  });

  it("explicitly rotates a copied backup's epoch without changing the original book", () => {
    const path = isolatedPath();
    const original = database(path);
    new SqliteStore(original).mergeExecutions([fill()]);
    const version = readBookVersion(original);
    original.exec("pragma wal_checkpoint(truncate)");
    original.close();
    const restoredPath = join(directories[0], "restored.sqlite");
    copyFileSync(path, restoredPath); // The owned source is closed and checkpointed, so no WAL is omitted.
    const restored = database(restoredPath);
    expect(readBookVersion(restored)).toEqual(version);
    const rotated = rotateBookEpoch(restored);
    expect(rotated.databaseId).toBe(version.databaseId);
    expect(rotated.epoch).not.toBe(version.epoch);
    expect(rotated.sequence).toBe(0);
    expect(() => assertBookVersion(restored, version)).toThrow(expect.objectContaining({ code: "BOOK_VERSION_CHANGED" }));
    restored.close();
    expect(readBookVersion(database(restoredPath))).toEqual(rotated);
    expect(readBookVersion(database(path))).toEqual(version);
  });

  it("rejects a different book or epoch even when its sequence matches", () => {
    const first = database();
    const second = database();
    const version = readBookVersion(first);
    expect(() => assertBookVersion(second, version)).toThrow(BookVersionChangedError);
    first.exec("begin immediate");
    rotateBookEpoch(first);
    first.exec("rollback");
    expect(readBookVersion(first)).toEqual(version);
    rotateBookEpoch(first);
    expect(() => assertBookVersion(first, version)).toThrow(BookVersionChangedError);
  });

  it("fails explicitly on missing or corrupt state instead of fabricating a version", () => {
    const uninitialized = database(":memory:", false);
    expect(() => readBookVersion(uninitialized)).toThrow(BookVersionUnavailableError);
    expect(() => rotateBookEpoch(uninitialized)).toThrow(BookVersionUnavailableError);
    const db = database();
    db.exec("delete from trade_book_state");
    expect(() => readBookVersion(db)).toThrow(BookVersionUnavailableError);
    expect(() => rotateBookEpoch(db)).toThrow(BookVersionUnavailableError);
    // Missing state must also stop an old write path from changing facts silently.
    expect(() => new SqliteStore(db).mergeExecutions([fill()])).toThrow();
    expect(db.prepare("select count(*) as count from executions").get()?.count).toBe(0);
    db.exec("pragma ignore_check_constraints=on");
    db.exec("insert into trade_book_state(singleton,database_id,epoch,sequence) values (1,'id','epoch',-1)");
    expect(() => readBookVersion(db)).toThrow(BookVersionUnavailableError);
    expect(() => new SqliteStore(db).mergeExecutions([fill()])).toThrow();
    expect(db.prepare("select sequence from trade_book_state").get()).toEqual({ sequence: -1 });
  });
});
