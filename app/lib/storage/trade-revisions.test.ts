import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../../db/sqlite", async original => ({ ...await original<typeof import("../../../db/sqlite")>(), openSqliteDatabase: vi.fn() }));
import { initializeSqlite, openSqliteDatabase } from "../../../db/sqlite";
import { SqliteStore } from "./sqlite-store";
import { createTradeChanges, TradeChangeError } from "./trade-changes";
import { readBookVersion } from "./trade-book-version";
import { canonicalRecord, type TradeRevisionRequest } from "./trade-revisions";
import type { TradeExecution } from "../trades/types";
import { POST as postRevision } from "../../api/storage/trade-revisions/route";
const instrument = { id: "US:CTVA", symbol: "CTVA", name: "Corteva", market: "US", currency: "USD" };
const execution: TradeExecution = { id: "original", instrument, accountId: "a", accountLabel: "账户A", source: { platform: "tiger", row: 0, sourceTimestampText: "原始凭证时间" }, executedAt: "2026-07-24T13:48:50Z", side: "buy", quantity: "100", price: "88.77", fee: "0" };
const databases: DatabaseSync[] = [];
afterEach(() => { vi.mocked(openSqliteDatabase).mockReset(); databases.splice(0).forEach((db) => db.close()); });
function setup(seed: TradeExecution = execution) { const db = new DatabaseSync(":memory:"); databases.push(db); initializeSqlite(db); const store = new SqliteStore(db); store.mergeTradeData({ executions: [seed] }); return { store, db }; }

// Capture every persisted application table, including plans, receipts and audit
// bytes. A successful retry must not start another commit or advance the book.
function persistedState(db: DatabaseSync) {
  const tables = db.prepare("select name from sqlite_schema where type='table' and name not like 'sqlite_%' order by name").all();
  return {
    bookVersion: readBookVersion(db),
    tables: tables.map(({ name }) => ({
      name,
      rows: db.prepare(`select * from "${String(name).replaceAll('"', '""')}"`).all()
        .map(row => JSON.stringify(row)).sort(),
    })),
  };
}

function revisionRequest(): TradeRevisionRequest {
  return {
    id: "retry-proof", instrumentId: instrument.id, accountId: "a", reason: "核对原凭证",
    changes: [{ before: execution, after: { ...execution, quantity: "200" } }],
    expectedScope: [execution],
    importHistory: {
      id: "supplement-proof", fileName: "proof.csv", sourceLabel: "凭证", sourceKind: "statement",
      importedAt: "2026-07-29T00:00:00.000Z", tradeCount: 1, instrumentCount: 1,
      excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0,
    },
  };
}

function auditRow(db: DatabaseSync, id: string) {
  return db.prepare("select * from trade_revisions where id=?").get(id)!;
}

// Reproduce the known old writer shape as fixture data, independently of the
// production comparator. All these fixtures have no localized display names.
function legacyRequestJson(input: TradeRevisionRequest, recordedAt?: string) {
  return canonicalRecord({ ...input, changes: input.changes.map(({ before, after }) => ({ before, after })), ...(recordedAt ? { recordedAt } : {}) });
}

function installLegacyRequest(db: DatabaseSync, input: TradeRevisionRequest, recordedAt?: string) {
  db.prepare("update trade_revisions set request_json=? where id=?")
    .run(legacyRequestJson(input, recordedAt), input.id);
}

it("atomically revises, records original evidence, and makes retries idempotent", () => {
  const { store, db } = setup();
  const initialAuditCount = store.getTradeRevisions(instrument.id).length;
  const input = { id: "request-1", instrumentId: instrument.id, accountId: "a", reason: "核对原凭证数量", changes: [{ before: execution, after: { ...execution, quantity: "200" } }] };
  const first = store.reviseTrades(input);
  const saved = persistedState(db);
  expect(store.reviseTrades(input)).toEqual(first);
  expect(persistedState(db)).toEqual(saved);
  expect(store.getExecutions()[0].quantity).toBe("200");
  expect(store.getTradeRevisions(instrument.id)).toHaveLength(initialAuditCount + 1);
  expect(store.getTradeRevisions(instrument.id).find(revision => revision.id === input.id)?.changes[0].before).toEqual(execution);
  expect(() => store.reviseTrades({ ...input, id: "stale" })).toThrow(/conflict/i);
  expect(() => store.reviseTrades({ ...input, reason: "重用请求号" })).toThrow(/conflict/i);
});
it("rejects off-scope, invalid, and mixed stale changes without partial writes", () => {
  const { store } = setup();
  const initialAudits = store.getTradeRevisions(instrument.id);
  const base = { id: "bad", instrumentId: instrument.id, accountId: "a", reason: "修正" };
  expect(() => store.reviseTrades({ ...base, changes: [{ before: execution, after: { ...execution, accountId: "b" } }] })).toThrow();
  expect(() => store.reviseTrades({ ...base, changes: [{ before: execution, after: { ...execution, quantity: "-1" } }] })).toThrow();
  expect(() => store.reviseTrades({ ...base, changes: [{ before: null, after: { ...execution, id: "new" } }, { before: { ...execution, price: "999" }, after: null }] })).toThrow();
  expect(store.getExecutions()).toEqual([execution]); expect(store.getTradeRevisions(instrument.id)).toEqual(initialAudits);
});
it("supports explicit additions and removals while retaining their audit trail", () => {
  const { store } = setup();
  const initialAudits = store.getTradeRevisions(instrument.id);
  store.reviseTrades({ id: "add", instrumentId: instrument.id, accountId: "a", reason: "补录", changes: [{ before: null, after: { ...execution, id: "added", side: "sell", executedAt: "2026-07-29T15:01:17Z" } }] });
  store.reviseTrades({ id: "remove", instrumentId: instrument.id, accountId: "a", reason: "重复记录", changes: [{ before: execution, after: null }] });
  expect(store.getExecutions().map((e) => e.id)).toEqual(["added"]);
  expect(store.getTradeRevisions(instrument.id)).toHaveLength(initialAudits.length + 2);
  expect(store.getTradeRevisions(instrument.id)).toEqual(expect.arrayContaining(initialAudits));
  expect(store.getTradeRevisions(instrument.id).map(revision => revision.id)).toEqual(expect.arrayContaining(["add", "remove"]));
});
it("rolls back the execution edit if recording the audit fails", () => {
  const { store, db } = setup();
  db.exec("create trigger reject_revision before insert on trade_revisions begin select raise(abort, 'audit unavailable'); end");
  expect(() => store.reviseTrades({ id: "atomic", instrumentId: instrument.id, accountId: "a", reason: "核对", changes: [{ before: execution, after: null }] })).toThrow();
  expect(store.getExecutions()).toEqual([execution]);
});
it("rejects a changed scope snapshot and forged instrument identity", () => {
  const { store } = setup();
  const initialAuditCount = store.getTradeRevisions(instrument.id).length;
  const input = { id:"scope", instrumentId:instrument.id, accountId:"a", reason:"补充文件", expectedScope:[], changes:[{before:null,after:{...execution,id:"supplement"}}] };
  expect(()=>store.reviseTrades(input)).toThrow(/conflict/i);
  expect(()=>store.reviseTrades({...input,expectedScope:[execution],changes:[{before:null,after:{...execution,id:"supplement",instrument:{...instrument,symbol:"AAPL"}}}]})).toThrow(/Invalid/);
  store.reviseTrades({...input,expectedScope:[execution]});
  store.reviseTrades({...input,expectedScope:[execution]});
  expect(store.getExecutions()).toHaveLength(2);
  expect(store.getTradeRevisions(instrument.id)).toHaveLength(initialAuditCount + 1);
});
it("does not let localized display metadata create a revision conflict", () => {
  const { store } = setup();
  const localizedName = {
    name: "科尔特瓦",
    locale: "zh-CN" as const,
    source: "tencent",
    resolvedAt: "2026-07-29T00:00:00.000Z",
  };
  const displaySnapshot = {
    ...execution,
    instrument: { ...instrument, localizedName },
  };

  store.mergeTradeData({
    instruments: [{ ...instrument, localizedName }],
    executions: [],
  });

  expect(store.getExecutions()[0]?.instrument.localizedName).toEqual(localizedName);
  store.reviseTrades({
    id: "localized-display",
    instrumentId: instrument.id,
    accountId: "a",
    reason: "修正数量",
    expectedScope: [displaySnapshot],
    changes: [{
      before: displaySnapshot,
      after: { ...displaySnapshot, quantity: "200" },
    }],
  });
  expect(store.getExecutions()[0]?.quantity).toBe("200");

  expect(() => store.reviseTrades({
    id: "localized-stale",
    instrumentId: instrument.id,
    accountId: "a",
    reason: "使用旧交易快照",
    changes: [{
      before: displaySnapshot,
      after: { ...displaySnapshot, quantity: "300" },
    }],
  })).toThrow(/conflict/i);
});

it("stores request fields separately from server audit metadata for revisions and imports", () => {
  const { store, db } = setup();
  const input = revisionRequest();
  const first = store.reviseTrades(input);
  expect(JSON.parse(String(auditRow(db, input.id).request_json))).toEqual(input);
  for (const row of db.prepare("select request_json,revision_json,recorded_at from trade_revisions").all()) {
    expect(JSON.parse(String(row.request_json))).not.toHaveProperty("recordedAt");
    expect(JSON.parse(String(row.revision_json)).recordedAt).toBe(row.recorded_at);
  }
  const saved = persistedState(db);
  expect(store.reviseTrades(input)).toEqual(first);
  expect(persistedState(db)).toEqual(saved);
});

const changedRequests: [string, (input: TradeRevisionRequest) => unknown][] = [
  ["reason", input => ({ ...input, reason: "另一个原因" })],
  ["change quantity", input => ({ ...input, changes: [{ before: execution, after: { ...execution, quantity: "300" } }] })],
  ["change source evidence", input => ({ ...input, changes: [{ before: execution, after: { ...execution, quantity: "200", source: { ...execution.source, sourceTimestampText: "不同凭证" } } }] })],
  ["scope quantity", input => ({ ...input, expectedScope: [{ ...execution, quantity: "99" }] })],
  ["scope source evidence", input => ({ ...input, expectedScope: [{ ...execution, source: { ...execution.source, row: 7 } }] })],
  ["empty scope", input => ({ ...input, expectedScope: [] })],
  ["absent scope/history", ({ expectedScope: _scope, importHistory: _history, ...input }) => input],
  ["history metadata", input => ({ ...input, importHistory: { ...input.importHistory, fileName: "other.csv" } })],
  ["history count", input => ({ ...input, importHistory: { ...input.importHistory, excludedRecordCount: 1 } })],
  ["history extension", input => ({ ...input, importHistory: { ...input.importHistory, provenance: { reviewed: true } } })],
  ["absent history", ({ importHistory: _history, ...input }) => input],
  ["top-level extension", input => ({ ...input, clientContext: { channel: "other" } })],
  ["change extension", input => ({ ...input, changes: input.changes.map(change => ({ ...change, clientEvidence: "other" })) })],
];

it.each(changedRequests)("rejects changed same-ID %s without any persisted write", (_name, changeRequest) => {
  const { store, db } = setup();
  const input = revisionRequest();
  store.reviseTrades(input);
  const saved = persistedState(db);
  expect(() => store.reviseTrades(changeRequest(input))).toThrowError(expect.objectContaining({
    code: "REVISION_CONFLICT", category: "conflict", phase: "compatibility",
  }));
  expect(persistedState(db)).toEqual(saved);
});

it("accepts JSON extensions while comparing all their content on retry", () => {
  const { store, db } = setup();
  const input = {
    ...revisionRequest(), clientContext: { channel: "manual", evidence: ["one"] },
    changes: [{ before: execution, after: { ...execution, quantity: "200" }, clientEvidence: { page: 1 } }],
  };
  const first = store.reviseTrades(input);
  expect(JSON.parse(String(auditRow(db, input.id).request_json))).toEqual(input);
  const saved = persistedState(db);
  expect(store.reviseTrades(input)).toEqual(first);
  for (const changed of [
    { ...input, clientContext: { ...input.clientContext, evidence: ["two"] } },
    { ...input, changes: [{ ...input.changes[0], clientEvidence: { page: 2 } }] },
  ]) {
    expect(() => store.reviseTrades(changed)).toThrowError(expect.objectContaining({ code: "REVISION_CONFLICT" }));
    expect(persistedState(db)).toEqual(saved);
  }
});

it.each(["timestamp-polluted", "request-only"])("retries the proven legacy %s shape without rewriting audit bytes or BookVersion", shape => {
  const { store, db } = setup();
  const input = {
    ...revisionRequest(), clientContext: { evidence: "one" },
    changes: [{ before: execution, after: { ...execution, quantity: "200" }, clientEvidence: { page: 1 } }],
  };
  const first = store.reviseTrades(input);
  installLegacyRequest(db, input, shape === "timestamp-polluted" ? first.revision.recordedAt : undefined);
  const saved = persistedState(db);
  const originalAudit = auditRow(db, input.id);
  expect(new SqliteStore(db).reviseTrades(input)).toEqual(first);
  expect(auditRow(db, input.id)).toEqual(originalAudit);
  expect(persistedState(db)).toEqual(saved);
  for (const changed of [
    { ...input, reason: "不同原因" },
    { ...input, clientContext: { evidence: "two" } },
    { ...input, changes: [{ ...input.changes[0], clientEvidence: { page: 2 } }] },
    { ...input, expectedScope: [] },
    { ...input, importHistory: { ...input.importHistory, fileName: "other.csv" } },
  ]) {
    expect(() => store.reviseTrades(changed)).toThrowError(expect.objectContaining({ code: "REVISION_CONFLICT" }));
    expect(persistedState(db)).toEqual(saved);
  }
});

const brokenLegacyProofs: [string, (db: DatabaseSync, input: TradeRevisionRequest, recordedAt: string) => void][] = [
  ["SQL timestamp", (db, input) => db.prepare("update trade_revisions set recorded_at=? where id=?").run("2000-01-01T00:00:00.000Z", input.id)],
  ["SQL account", (db, input) => db.prepare("update trade_revisions set account_id='other' where id=?").run(input.id)],
  ["audit ID", (db, input, recordedAt) => db.prepare("update trade_revisions set revision_json=? where id=?").run(JSON.stringify({ ...input, id: "other", recordedAt }), input.id)],
  ["audit instrument", (db, input, recordedAt) => db.prepare("update trade_revisions set revision_json=? where id=?").run(JSON.stringify({ ...input, instrumentId: "US:OTHER", recordedAt }), input.id)],
  ["audit reason", (db, input, recordedAt) => db.prepare("update trade_revisions set revision_json=? where id=?").run(JSON.stringify({ ...input, reason: "different", recordedAt }), input.id)],
  ["audit-only extension", (db, input, recordedAt) => db.prepare("update trade_revisions set revision_json=? where id=?").run(JSON.stringify({ ...input, legacyEvidence: "extra", recordedAt }), input.id)],
  ["missing audit timestamp", (db, input) => db.prepare("update trade_revisions set revision_json=? where id=?").run(JSON.stringify(input), input.id)],
  ["invalid audit shape", (db, input) => db.prepare("update trade_revisions set revision_json='[]' where id=?").run(input.id)],
  ["special audit kind", (db, input, recordedAt) => db.prepare("update trade_revisions set revision_json=? where id=?").run(JSON.stringify({ ...input, kind: "fact-state-audit-v1", recordedAt }), input.id)],
  ["request-only extension", (db, input, recordedAt) => db.prepare("update trade_revisions set request_json=? where id=?").run(canonicalRecord({ ...input, legacyEvidence: "extra", recordedAt }), input.id)],
  ["request timestamp", (db, input) => installLegacyRequest(db, input, "2000-01-01T00:00:00.000Z")],
  ["non-server timestamp format", (db, input) => {
    const recordedAt = "yesterday";
    db.prepare("update trade_revisions set request_json=?,revision_json=?,recorded_at=? where id=?")
      .run(legacyRequestJson(input, recordedAt), JSON.stringify({ ...input, recordedAt }), recordedAt, input.id);
  }],
];

it.each(brokenLegacyProofs)("rejects unproven legacy %s without rewriting history", (_name, breakProof) => {
  const { store, db } = setup();
  const input = revisionRequest();
  const first = store.reviseTrades(input);
  installLegacyRequest(db, input, first.revision.recordedAt);
  breakProof(db, input, first.revision.recordedAt);
  const saved = persistedState(db);
  expect(() => store.reviseTrades(input)).toThrowError(expect.objectContaining({ code: "REVISION_CONFLICT" }));
  expect(persistedState(db)).toEqual(saved);
});

it.each(["fresh", "stored", "legacy"])("rejects client-owned recordedAt for a %s request without writes", mode => {
  const { store, db } = setup();
  const input = revisionRequest();
  let recordedAt = "2000-01-01T00:00:00.000Z";
  if (mode !== "fresh") {
    recordedAt = store.reviseTrades(input).revision.recordedAt;
    if (mode === "legacy") installLegacyRequest(db, input, recordedAt);
  }
  const saved = persistedState(db);
  for (const forgedTimestamp of [recordedAt, "2001-01-01T00:00:00.000Z", null]) {
    expect(() => store.reviseTrades({ ...input, recordedAt: forgedTimestamp }))
      .toThrowError(expect.objectContaining({ category: "input" }));
    expect(persistedState(db)).toEqual(saved);
  }
});

it("keeps localized display metadata neutral on an otherwise identical retry", () => {
  const { store, db } = setup();
  const input = revisionRequest();
  const first = store.reviseTrades(input);
  const localizedName = { name: "科尔特瓦", locale: "zh-CN" as const, source: "tencent", resolvedAt: "2026-07-29T00:00:00.000Z" };
  const display = (record: TradeExecution) => ({ ...record, instrument: { ...record.instrument, localizedName } });
  const saved = persistedState(db);
  expect(store.reviseTrades({
    ...input,
    expectedScope: input.expectedScope!.map(display),
    changes: input.changes.map(change => ({ before: display(change.before!), after: display(change.after!) })),
  })).toEqual(first);
  expect(persistedState(db)).toEqual(saved);
});

// These literal shape errors must be rejected before comparison/SQL. Business
// values and arbitrary JSON extensions are deliberately not normalized here.
const malformedScopes: [string, unknown][] = [
  ["object scope", {}],
  ["null scope", null],
  ["string scope", "scope"],
  ["number scope", 1],
  ["boolean scope", false],
  ["null item", [null]],
  ["empty item", [{}]],
  ["array item", [[]]],
  ["string item", ["original"]],
  ["null instrument", [{ ...execution, instrument: null }]],
  ["array instrument", [{ ...execution, instrument: [] }]],
  ["empty instrument", [{ ...execution, instrument: {} }]],
  ["null source", [{ ...execution, source: null }]],
  ["array source", [{ ...execution, source: [] }]],
  ["missing source platform", [{ ...execution, source: { row: 0 } }]],
  ["invalid source row", [{ ...execution, source: { ...execution.source, row: "0" } }]],
  ["invalid side", [{ ...execution, side: "hold" }]],
  ...["id", "accountId", "accountLabel", "executedAt", "quantity", "price", "fee"].map((field): [string, unknown] => [
    `non-string ${field}`, [{ ...execution, [field]: 1 }],
  ]),
  ...["id", "symbol", "name", "market", "currency"].map((field): [string, unknown] => [
    `non-string instrument ${field}`, [{ ...execution, instrument: { ...instrument, [field]: 1 } }],
  ]),
];

function revisionPost(input: unknown) {
  return postRevision(new Request("http://localhost/api/storage/trade-revisions", { method: "POST", body: JSON.stringify(input) }));
}

it("returns the original HTTP result on exact retry but rejects a fresh-ID stale before value with 409 and no writes", async () => {
  const { store, db } = setup();
  vi.mocked(openSqliteDatabase).mockReturnValue(db);
  const input = {
    id: "http-repair", instrumentId: instrument.id, accountId: "a", reason: "核对数量",
    changes: [{ before: execution, after: { ...execution, quantity: "200" } }],
  };
  const first = await revisionPost(input);
  expect(first.status).toBe(200);
  const firstResult = await first.json();
  const saved = persistedState(db);
  const retry = await revisionPost(input);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toEqual(firstResult);
  expect(persistedState(db)).toEqual(saved);
  const stale = await revisionPost({ ...input, id: "http-stale" });
  expect({ status: stale.status, body: await stale.json() }).toMatchObject({
    status: 409, body: { error: { code: "REVISION_CONFLICT", category: "conflict", phase: "prepare", retryable: false } },
  });
  expect(store.getExecutions()[0].quantity).toBe("200");
  expect(persistedState(db)).toEqual(saved);
});

it.each(["changed before", "changed scope", "missing before", "existing addition ID"])(
  "returns a typed prepare conflict for %s through Store, formal prepare and HTTP without writes",
  async scenario => {
    const { store, db } = setup();
    vi.mocked(openSqliteDatabase).mockReturnValue(db);
    let input: TradeRevisionRequest = {
      id: "rejected-precondition", instrumentId: instrument.id, accountId: "a", reason: "核对数量",
      changes: [{ before: execution, after: { ...execution, quantity: "200" } }],
    };
    if (scenario === "changed before" || scenario === "changed scope") {
      store.reviseTrades({ ...input, id: "already-reviewed" });
      if (scenario === "changed scope") {
        input = {
          ...input, expectedScope: [execution],
          changes: [{ before: { ...execution, quantity: "200" }, after: { ...execution, quantity: "300" } }],
        };
      }
    } else if (scenario === "missing before") {
      input = { ...input, changes: [{
        before: { ...execution, id: "never-present" },
        after: { ...execution, id: "never-present", quantity: "200" },
      }] };
    } else {
      input = { ...input, changes: [{ before: null, after: { ...execution, quantity: "200" } }] };
    }
    const saved = persistedState(db);
    for (const attempt of [
      () => store.reviseTrades(input),
      () => createTradeChanges(db).prepare({ kind: "revision", revision: input }),
    ]) {
      let failure: unknown;
      try { attempt(); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(TradeChangeError);
      expect(failure).toMatchObject({ code: "REVISION_CONFLICT", category: "conflict", phase: "prepare", retryable: false });
      expect(persistedState(db)).toEqual(saved);
    }
    const response = await revisionPost(input);
    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 409, body: { error: { code: "REVISION_CONFLICT", category: "conflict", phase: "prepare", retryable: false } },
    });
    expect(persistedState(db)).toEqual(saved);
  },
);

it("keeps a forged instrument identity as typed domain HTTP 422 without writes", async () => {
  const { store, db } = setup();
  vi.mocked(openSqliteDatabase).mockReturnValue(db);
  const input = {
    id: "forged-symbol", instrumentId: instrument.id, accountId: "a", reason: "核对",
    changes: [{ before: execution, after: { ...execution, instrument: { ...instrument, symbol: "AAPL" } } }],
  };
  const saved = persistedState(db);
  expect(() => store.reviseTrades(input)).toThrowError(expect.objectContaining({
    code: "TRADE_RULE_REJECTED", category: "domain", phase: "prepare", retryable: false,
  }));
  const response = await revisionPost(input);
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 422, body: { error: { code: "TRADE_RULE_REJECTED", category: "domain", phase: "prepare", retryable: false } },
  });
  expect(persistedState(db)).toEqual(saved);
});

it.each(malformedScopes)("returns typed HTTP 400 for incoming %s without writes", async (_name, expectedScope) => {
  const { store, db } = setup();
  vi.mocked(openSqliteDatabase).mockReturnValue(db);
  const { importHistory: _history, ...input } = revisionRequest();
  const malformed = { ...input, expectedScope };
  const saved = persistedState(db);
  const response = await revisionPost(malformed);
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 400, body: { error: { code: "INVALID_INPUT", category: "input", phase: "compatibility" } },
  });
  expect(() => store.reviseTrades(malformed)).toThrowError(expect.objectContaining({ category: "input" }));
  expect(persistedState(db)).toEqual(saved);
});

it.each(malformedScopes)("returns typed HTTP 409 for legacy audit %s without rewriting history", async (_name, expectedScope) => {
  const { store, db } = setup();
  vi.mocked(openSqliteDatabase).mockReturnValue(db);
  const input = revisionRequest();
  const first = store.reviseTrades(input);
  installLegacyRequest(db, input, first.revision.recordedAt);
  db.prepare("update trade_revisions set revision_json=? where id=?")
    .run(JSON.stringify({ ...first.revision, expectedScope }), input.id);
  const saved = persistedState(db);
  const response = await revisionPost(input);
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 409, body: { error: { code: "REVISION_CONFLICT", category: "conflict", phase: "compatibility" } },
  });
  expect(() => store.reviseTrades(input)).toThrowError(expect.objectContaining({ code: "REVISION_CONFLICT" }));
  expect(persistedState(db)).toEqual(saved);
});

it("preserves historical unknown fees, date-only precision and evidence through scope validation and legacy retry", async () => {
  const { store, db } = setup({
    ...execution, executedAt: "2026-07-24", quantity: "100.00000000000000000001", price: "88.77000000000000000001",
    source: { ...execution.source, feeStatus: "unknown", timePrecision: "date-only", sourceTimestampText: "2026-07-24 原始日期凭证" },
  });
  db.exec("update executions set fee=null where id='original'"); // synthetic historical raw fact
  vi.mocked(openSqliteDatabase).mockReturnValue(db);
  const historical = store.getExecutions()[0];
  const input = {
    ...revisionRequest(),
    changes: [{ before: historical, after: { ...historical, quantity: "200.00000000000000000001" } }],
    expectedScope: [{ ...historical, instrument: { ...historical.instrument, localizedName: {
      name: "科尔特瓦", locale: "zh-CN" as const, source: "tencent", resolvedAt: "2026-07-29T00:00:00.000Z",
    } } }],
    clientContext: { originalEvidence: ["unmodified"] },
  };
  const response = await revisionPost(input);
  expect(response.status).toBe(200);
  const first = await response.json();
  if (typeof first !== "object" || first === null || Array.isArray(first)
    || !("revision" in first) || typeof first.revision !== "object"
    || first.revision === null || Array.isArray(first.revision)
    || !("recordedAt" in first.revision) || typeof first.revision.recordedAt !== "string") {
    throw new Error("Expected revision response with string recordedAt");
  }
  expect(store.getExecutions()[0]).toMatchObject({
    fee: "", quantity: "200.00000000000000000001", price: "88.77000000000000000001", executedAt: "2026-07-24",
    source: { feeStatus: "unknown", timePrecision: "date-only", sourceTimestampText: "2026-07-24 原始日期凭证" },
  });
  // Old writers already ignored localized display names in canonical requests.
  installLegacyRequest(db, { ...input, expectedScope: [historical] }, first.revision.recordedAt);
  const saved = persistedState(db);
  const retry = await revisionPost(input);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toEqual(first);
  expect(persistedState(db)).toEqual(saved);
});

it("keeps genuine SQL failures as HTTP 500 instead of classifying them as revision conflicts", async () => {
  const { db } = setup();
  vi.mocked(openSqliteDatabase).mockReturnValue(db);
  databases.splice(databases.indexOf(db), 1);
  db.close();
  const response = await revisionPost(revisionRequest());
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 500, body: { error: { code: "UNEXPECTED_FAILURE", category: "unexpected", phase: "prepare" } },
  });
});
