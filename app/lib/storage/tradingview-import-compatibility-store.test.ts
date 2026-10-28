import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { csv, header, row } from "../import/__fixtures__/tradingview";
import { importIntentForPreview } from "../../components/import/trade-import-plan";
import { createImportPreview } from "../import/import-preview";
import { enrichStatementImport } from "../import/enrich-import";
import { fingerprintBytes } from "../import/file-fingerprint";
import { parseTradingViewSimulationCsv } from "../import/tradingview-simulation";
import { parseTradingViewCsv } from "../import/tradingview";
import type { TradeExecution } from "../trades/types";
import type { BrowserStatePayload, ReviewPlan, TradeChangeChoices, TradeChangeIntent } from "./sqlite-contracts";
import type { MaterialVersionInput } from "./source-materials";
import type { TradingViewMigrationPreview } from "./tradingview-account-migration-contracts";
import { SqliteStore, createTradeChanges } from "./sqlite-store";
import { readBookVersion } from "./trade-book-version";
import { readStoredTradeSnapshot } from "./stored-trade-snapshot";

const databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const bytes = new TextEncoder().encode(csv), fp = fingerprintBytes(bytes);
const parsed = () => parseTradingViewSimulationCsv(bytes, { fileName: "回放交易_SSE_600330_2026-09-03.csv", sourceFileId: fp });
type ImportIntent = Extract<TradeChangeIntent, { kind: "import" }>;
function setup(options: Parameters<typeof createTradeChanges>[1] = {}) {
  const db = new DatabaseSync(":memory:"); databases.push(db); initializeSqlite(db);
  return { db, store: new SqliteStore(db), changes: createTradeChanges(db, options) };
}
type Fixture = ReturnType<typeof setup>;
function snapshot(db: DatabaseSync, management = false) {
  return Object.fromEntries(db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name").all()
    .filter(r => management || !["trade_change_plans", "trade_change_receipts", "trade_change_requests"].includes(String(r.name)))
    .map(r => [String(r.name), db.prepare(`select * from "${String(r.name)}"`).all().map(v => JSON.stringify(v)).sort()]));
}
function count(db: DatabaseSync, table: string) { return Number(db.prepare(`select count(*) as n from "${table}"`).get()!.n); }
function commit(f: Fixture, plan: ReviewPlan, choices: TradeChangeChoices = {}, requestId: string = randomUUID()) {
  return f.changes.commit({ requestId, planId: plan.planId, choices });
}
function intent(evidence = false): ImportIntent {
  const p = parsed(); return { kind: "import", candidates: p.records, ...(evidence ? { tradingViewImport: { policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" }, evidence: p.tradingViewEvidence } } : {}) };
}
function weak(kind: "W15" | "W16" | "W17"): TradeExecution[] {
  return parsed().records.map(record => {
    if (kind !== "W15") return { ...record, accountId: `tradingview:${fp}`, accountLabel: `TradingView · 模拟盘 · ${fp.slice(0, 8)}`,
      price: kind === "W17" && record.source.row === 3 ? "999" : record.price, source: { ...record.source, simulationRole: undefined } };
    const { tradeNature: _nature, sourceTradeId: _trade, ...legacy } = record.source;
    const role = record.source.row === 3 ? "entry" : "exit";
    return { ...record, id: `tradingview:${fp}:CN-SH:600330:1:${role}`, accountId: `tradingview:${fp}:CN-SH:600330`, accountLabel: `TradingView · 模拟盘 · ${fp.slice(0, 8)}`,
      executedAt: record.source.sourceTimestampText === "2021-02-19" ? "2021-02-19T07:00:00.000Z" : "2021-03-01T07:00:00.000Z",
      source: { ...legacy, inputKind: "statement", tradingNature: "simulated", simulationTradeId: "1", simulationRole: role, simulationRunId: `${fp}:CN-SH:600330` } };
  });
}
function bound(original: ImportIntent, plan: ReviewPlan): ImportIntent {
  return { ...structuredClone(original), tradingViewImport: { policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" }, ...original.tradingViewImport,
    identity: { kind: "keep-independent", reviewPlanId: plan.planId, inputDigest: plan.summary.inputDigest,
      candidateIds: [...new Set(plan.identityReviews!.flatMap(r => r.incomingIds))].sort() } } };
}
function reviewAndIndependent(kind: "W15" | "W16" | "W17") {
  const f = setup(), seed = weak(kind); f.store.mergeTradeData({ executions: seed });
  const storedSeed = f.store.getExecutions();
  const before = snapshot(f.db), original = intent(true), plan = f.changes.prepare(original);
  expect(plan.status).toBe("review-required"); expect(plan.identityReviews!.length).toBeGreaterThan(0);
  expect(plan.summary.changes).toEqual([]); expect(snapshot(f.db)).toEqual(before);
  const management = snapshot(f.db, true);
  expect(() => commit(f, plan, { conflicts: [], missingExecutions: [], reactivateExecutions: [] })).toThrowError(expect.objectContaining({ code: "TRADINGVIEW_SOURCE_REVIEW_REQUIRED" }));
  expect(snapshot(f.db, true)).toEqual(management);
  const ready = f.changes.prepare(bound(original, plan)); expect(ready.status).toBe("ready");
  const receipt = commit(f, ready); expect(receipt.result.tradingViewImport?.identity.kind).toBe("kept-independent");
  expect(f.changes.getCommit(f.db.prepare("select request_id from trade_change_requests where receipt_id=?").get(receipt.receiptId)!.request_id as string)).toEqual(receipt);
  expect(f.store.getExecutions()).toHaveLength(4);
  for (const old of storedSeed) expect(f.store.getExecutions().find(e => e.id === old.id)).toEqual(old);
  expect(readBookVersion(f.db)).toEqual(receipt.bookVersion);
}
function sourceMaterial(records: TradeExecution[], versionId = "proof:v1"): MaterialVersionInput {
  return { materialId: "proof:material", versionId, parserVersion: "fixture-v1", sourceKind: "tradingview", locator: { fixture: "public-store" }, fileFingerprint: fp, recordedAt: "2026-10-26T00:00:00.000Z",
    scope: { accounts: { values: [records[0].accountId], unknown: false }, instruments: { values: [records[0].instrument.id], unknown: false }, markets: { values: [records[0].instrument.market], unknown: false }, periods: { values: [], unknown: true } }, diagnostics: [], content: { fixture: "complete-operation" },
    observations: records.map(e => ({ id: `${versionId}:${e.id}`, key: e.id, locator: { executionId: e.id }, raw: { observed: e.id }, originalAccountId: e.accountId, executionIds: [e.id], linkReason: "public seed evidence" })) };
}
function saveMaterial(f: Fixture, material: MaterialVersionInput) { return commit(f, f.changes.prepare({ kind: "material", materials: [material] })); }
function formal(optional: "specified" | "omitted" | "null" = "specified") {
  const f = setup(), legacy = parsed().records.map(e => ({ ...e, accountId: `tradingview:${fp}`, accountLabel: "旧账户" }));
  f.store.mergeTradeData({ executions: legacy }); saveMaterial(f, sourceMaterial(legacy));
  const plan = f.changes.prepare({ kind: "tradingview-account-migration", operationId: "formal:forward" });
  const p = plan.tradingView as TradingViewMigrationPreview; expect(p.status, JSON.stringify(p)).toBe("ready");
  const maintenanceRequest = { operationId: p.operationId, idempotencyKey: `${p.operationId}:commit`, baseSnapshotDigest: p.baseSnapshotDigest, planDigest: p.planDigest,
    ...(optional === "specified" ? { expectedAffectedRows: [...p.executionPlan.map(r => ({ table: "executions", key: r.executionId, beforeDigest: r.beforeDigest })), ...p.referencePlan.map(r => ({ table: r.table, key: r.primaryKey, beforeDigest: r.beforeDigest }))],
      provisionalPrincipalAction: p.provisionalPrincipal.action === "no-op" ? "no-op" as const : "create-if-absent" as const } : {}) };
  if (optional === "null") { Reflect.set(maintenanceRequest, "episodeMapDigest", null); Reflect.set(maintenanceRequest, "provisionalPrincipalAction", null); }
  const receipt = f.changes.commit({ requestId: "formal:request", planId: plan.planId, choices: {}, maintenanceRequest });
  return { ...f, legacy, maintenancePlan: plan, maintenanceReceipt: receipt };
}
function revise(f: Fixture, before: TradeExecution, price: string) {
  const revision = { id: randomUUID(), instrumentId: before.instrument.id, accountId: before.accountId, reason: "核对原始成交后正式修订", changes: [{ before, after: { ...before, price } }] };
  const plan = f.changes.prepare({ kind: "revision", revision }); const receipt = commit(f, plan);
  return { revision, plan, receipt };
}
function browser(executions: TradeExecution[]): BrowserStatePayload {
  return { version: 1, sourceClientId: "owned", sourceFingerprint: randomUUID(), executions, importHistory: [], instruments: [], reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {}, dailyCandles: [], marketCandles: [], coverage: [], intervalCoverage: [], providerSymbols: [] };
}
// Only S07/S15 call this corruption seam; every row originates from actual public prepare/commit.
function corruptPlan(f: Fixture, change: () => void) {
  const trigger = f.db.prepare("select sql from sqlite_master where type='trigger' and name='trade_change_plan_immutable'").get()!;
  expect(typeof trigger.sql).toBe("string");
  f.db.exec("drop trigger trade_change_plan_immutable");
  try { change(); } finally { f.db.exec(String(trigger.sql)); }
}
function alterPlan(f: Fixture, id: string, change: (body: { review: Record<string, unknown>; prepared: Record<string, unknown> }) => void) {
  const prior = f.db.prepare("select body_json from trade_change_plans where id=?").get(id)!;
  expect(typeof prior.body_json).toBe("string"); const body = JSON.parse(String(prior.body_json)); change(body);
  const json = JSON.stringify(body); corruptPlan(f, () => { f.db.prepare("update trade_change_plans set body_json=?,body_digest=? where id=?").run(json, createHash("sha256").update(json).digest("hex"), id); });
}
const ordinary = (): TradeExecution => ({ id: "old-file:1", accountId: "cms:account-1", accountLabel: "招商证券 · 账户 1", instrument: { id: "CN-SH:600938", symbol: "600938", market: "CN-SH", currency: "CNY", name: "中国海油" }, side: "buy", quantity: "100", price: "15.20", fee: "5", executedAt: "2026-03-01T07:00:00.000Z", source: { platform: "china-merchants", page: 2, row: 1, sourceOrder: 1, timePrecision: "date-only", fileName: "招商证券.pdf", fileFingerprint: "old-file", sourceTimestampText: "2026-03-01", sourceTimezone: "Asia/Shanghai" } });

function publicBook(f: Fixture) {
  return { ...readStoredTradeSnapshot(f.db), receipt: undefined, executions: f.store.getExecutions() };
}

describe("TradingView decoded evidence public input", () => {
  it("binds source discriminators while allowing real enrichment preview batches and candidate subsets", async () => {
    const f = setup(), parser = parsed();
    const localizedName = { name: "天通股份", locale: "zh-CN" as const, source: "tencent", resolvedAt: "2026-10-27T00:00:00.000Z" };
    const enriched = await enrichStatementImport(parser, { resolver: async () => ({
      resolved: new Map([["CN-SH:600330", { market: "CN-SH", symbol: "600330", name: "天通股份", localizedName,
        assetType: "stock", source: "tencent", confidence: "portal", resolvedAt: localizedName.resolvedAt }]]),
      unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve(),
    }) });
    const preview = createImportPreview("展示文件名.csv", { ...enriched, importable: enriched.importable.slice(0, 1) });
    const input = importIntentForPreview(preview);
    expect(input.candidates).toHaveLength(1);
    expect(input.candidates[0].instrument).toMatchObject({ name: "天通股份", localizedName });
    expect(input.candidates[0].source.batchId).toBe(preview.id);
    const first = commit(f, f.changes.prepare(input));
    expect(first.result.tradingViewImport!.material).toMatchObject({ kind: "save-evidence", observations: 2, links: 1 });
    const beforeReuse = publicBook(f), displayOnly = structuredClone(input);
    displayOnly.candidates[0].source.fileName = "另一展示文件名.csv";
    displayOnly.candidates[0].source.batchId = "another-preview-attempt";
    displayOnly.candidates[0].instrument.name = "证券展示名";
    const repeated = commit(f, f.changes.prepare(displayOnly));
    expect(repeated.result.tradingViewImport!.material.kind).toBe("reuse-exact");
    expect(publicBook(f)).toEqual(beforeReuse);
    for (const field of ["platform", "inputKind"] as const) {
      const rejected = setup(), changed = structuredClone(input), before = publicBook(rejected), databaseBefore = snapshot(rejected.db, true);
      Reflect.set(changed.candidates[0].source, field, field === "platform" ? "legacy" : "statement");
      expect.soft(() => commit(rejected, rejected.changes.prepare(changed)), field).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
      expect.soft(publicBook(rejected), field).toEqual(before);
      expect.soft(snapshot(rejected.db, true), field).toEqual(databaseBefore);
    }
  });
  it("rejects source semantics not produced by the decoded parser and validates display exceptions", () => {
    const additions = [
      ["simulationSignal", "forged-signal"], ["tradingNature", "simulated"], ["simulationTradeId", "forged-trade"],
      ["simulationReport", { "净损益 CNY": "999" }], ["page", 999],
      ["settlement", { currency: "CNY", quantity: "100", grossAmount: "1000", netAmount: "1000", fees: {} }],
      ["uncontractedSource", "forged"], ["fileName", { forged: true }], ["batchId", 42],
    ] as const;
    for (const [field, value] of additions) {
      const f = setup(), input = intent(true), before = publicBook(f), databaseBefore = snapshot(f.db, true);
      Reflect.set(input.candidates[0].source, field, value);
      expect.soft(() => commit(f, f.changes.prepare(input)), field).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
      expect.soft(publicBook(f), field).toEqual(before);
      expect.soft(snapshot(f.db, true), field).toEqual(databaseBefore);
    }
  });
  it("binds parser candidate ids even when source classification is replaced in a mixed batch", () => {
    const supported = setup(), mixed = intent(true); mixed.candidates.push(ordinary());
    const receipt = commit(supported, supported.changes.prepare(mixed));
    expect(receipt.result.tradingViewImport!.material).toMatchObject({ kind: "save-evidence", observations: 2, links: 2 });
    expect(supported.store.getExecutions()).toHaveLength(3);
    const f = setup(), changed = intent(true), before = publicBook(f), databaseBefore = snapshot(f.db, true);
    changed.candidates[0].source = ordinary().source;
    expect.soft(() => commit(f, f.changes.prepare(changed))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect.soft(publicBook(f)).toEqual(before);
    expect.soft(snapshot(f.db, true)).toEqual(databaseBefore);
  });
  it("checks parser-derived scope run and source fields against the selected executions", () => {
    for (const mutation of ["market", "symbol", "currency", "run", "trade-id", "price", "source-date", "source-role"] as const) {
      const f = setup(), input = intent(true), before = publicBook(f), evidence = input.tradingViewImport!.evidence!;
      if (mutation === "market") evidence.derived.market = "CN-SZ";
      if (mutation === "symbol") evidence.derived.symbol = "600000";
      if (mutation === "currency") evidence.derived.currency = "USD";
      if (mutation === "run") { evidence.derived.sourceRun = "forged-run"; input.candidates.forEach(e => { e.source.simulationRunId = "forged-run"; }); }
      if (mutation === "trade-id") input.candidates[0].source.sourceTradeId = "forged-trade";
      if (mutation === "price") input.candidates[0].price = "999";
      if (mutation === "source-date") input.candidates[0].source.sourceTimestampText = "2020-01-01";
      if (mutation === "source-role") input.candidates[0].source.simulationRole = "exit";
      expect.soft(() => commit(f, f.changes.prepare(input)), mutation).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
      expect.soft(publicBook(f), mutation).toEqual(before);
    }
  });
  it("saves all original parser observations when the preview selects a candidate subset and reuses them", () => {
    const f = setup(), parser = parsed();
    const preview = createImportPreview("回放交易.csv", { ...parser, importable: parser.records.slice(0, 1), unresolved: [], cacheHits: 0 });
    const input = importIntentForPreview(preview);
    expect(input.candidates).toHaveLength(1);
    expect(input.tradingViewImport!.evidence).toEqual(parser.tradingViewEvidence);
    const first = commit(f, f.changes.prepare(input)), stored = readStoredTradeSnapshot(f.db);
    expect(first.result.tradingViewImport!.material).toMatchObject({ kind: "save-evidence", observations: 2, links: 1 });
    expect(stored.facts.map(fact => fact.id)).toEqual([input.candidates[0].id]);
    expect(stored.materials[0].version.observations.toSorted((a,b) => String(a.key).localeCompare(String(b.key))).map(o => ({ raw: o.raw, executionIds: o.executionIds }))).toEqual(parser.tradingViewEvidence!.rows.map(sourceRow => ({ raw: sourceRow, executionIds: sourceRow.candidateIds.filter(id => id === input.candidates[0].id) })));
    const before = publicBook(f), repeated = commit(f, f.changes.prepare(input));
    expect(repeated.result.tradingViewImport!.material.kind).toBe("reuse-exact");
    expect(repeated.bookVersion).toEqual(first.bookVersion);
    expect(publicBook(f)).toEqual(before);
  });
  it("keeps complete result evidence through a real preview subset instead of taking a record source extra", () => {
    const f = setup(), parser = parsed(), original = structuredClone(parser.tradingViewEvidence!);
    const recordExtra = structuredClone(original); recordExtra.rows = recordExtra.rows.slice(0, 1);
    Reflect.set(parser.records[0].source, "tradingViewEvidence", recordExtra);
    const preview = createImportPreview("回放交易.csv", { ...parser, importable: parser.records.slice(0, 1), unresolved: [], cacheHits: 0 });
    const input = importIntentForPreview(preview);
    expect.soft(preview.tradingViewEvidence).toEqual(original);
    expect.soft(input.tradingViewImport!.evidence).toEqual(original);
    // Result-level propagation must not let an uncontracted record-source extra enter persistence.
    const before = publicBook(f), databaseBefore = snapshot(f.db, true);
    expect(() => commit(f, f.changes.prepare(input))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect(publicBook(f)).toEqual(before); expect(snapshot(f.db, true)).toEqual(databaseBefore);
    Reflect.deleteProperty(input.candidates[0].source, "tradingViewEvidence");
    const receipt = commit(f, f.changes.prepare(input)), stored = readStoredTradeSnapshot(f.db);
    expect(receipt.result.tradingViewImport!.material).toMatchObject({ kind: "save-evidence", observations: 2, links: 1 });
    expect(stored.materials[0].version.observations.toSorted((a,b) => String(a.key).localeCompare(String(b.key))).map(observation => observation.raw)).toEqual(original.rows);
    expect(stored.facts.map(fact => fact.id)).toEqual([parser.records[0].id]);
  });
  it("rejects real parser all-invalid evidence rather than silently dropping the source observations", () => {
    const f = setup(), source = new TextEncoder().encode([header, row(1, "多头进场", "2021-01-01", "bad")].join("\r\n"));
    const parser = parseTradingViewSimulationCsv(source, { fileName: "回放交易_SSE_600330_2026-09-03.csv", sourceFileId: fingerprintBytes(source) });
    expect(parser.blocked).toBe(true); expect(parser.records).toEqual([]); expect(parser.tradingViewEvidence!.rows[0].outcome).toBe("invalid");
    const before = publicBook(f), input: ImportIntent = { kind: "import", candidates: [], tradingViewImport: { policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" }, evidence: parser.tradingViewEvidence } };
    expect(() => commit(f, f.changes.prepare(input))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect(publicBook(f)).toEqual(before);
  });
  it("closes decoded evidence objects without discarding supported cell diagnostics", () => {
    const input = intent(true), evidence = input.tradingViewImport!.evidence!;
    evidence.headers.push({ kind: "string", value: "备注" });
    evidence.rows[0].entries.push({ key: "备注", cell: { kind: "unsupported", jsType: "object", diagnosticId: "decoded:2:备注" } });
    evidence.cellDiagnostics.push({ id: "decoded:2:备注", sheet: evidence.sheet.name, logicalRow: 2, column: "备注" });
    const supported = setup(), receipt = commit(supported, supported.changes.prepare(input));
    expect(receipt.result.tradingViewImport!.material.kind).toBe("save-evidence");
    expect(readStoredTradeSnapshot(supported.db).materials[0].version.observations.some(observation =>
      JSON.stringify(observation.raw) === JSON.stringify(evidence.rows[0]))).toBe(true);
    for (const field of ["root", "sheet", "derived", "row", "entry", "diagnostic"] as const) {
      const f = setup(), changed = structuredClone(input), decoded = changed.tradingViewImport!.evidence!;
      const object = field === "root" ? decoded : field === "sheet" ? decoded.sheet : field === "derived" ? decoded.derived
        : field === "row" ? decoded.rows[0] : field === "entry" ? decoded.rows[0].entries[0] : decoded.cellDiagnostics[0];
      Reflect.set(object, "forged", "not a parser field");
      const before = publicBook(f), databaseBefore = snapshot(f.db, true);
      expect.soft(() => commit(f, f.changes.prepare(changed)), field).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
      expect.soft(publicBook(f), field).toEqual(before);
      expect.soft(snapshot(f.db, true), field).toEqual(databaseBefore);
    }
  });
  it("rejects impossible decoded cells and broken cell-position diagnostics", () => {
    for (const mutation of ["negative-zero", "null-extra", "bigint-spelling", "duplicate-key", "empty-key", "missing-diagnostic", "orphan-diagnostic", "wrong-diagnostic-position", "header-key"] as const) {
      const f = setup(), input = intent(true), before = publicBook(f), evidence = input.tradingViewImport!.evidence!, entries = evidence.rows[0].entries;
      if (mutation === "negative-zero") Reflect.set(entries[0], "cell", { kind: "number", value: 1, negativeZero: true });
      if (mutation === "null-extra") Reflect.set(entries[0], "cell", { kind: "null", value: "forged" });
      if (mutation === "bigint-spelling") Reflect.set(entries[0], "cell", { kind: "bigint", decimal: "01" });
      if (mutation === "duplicate-key") entries.push(structuredClone(entries[0]));
      if (mutation === "empty-key") entries[0].key = "";
      if (mutation === "missing-diagnostic") entries.push({ key: "备注", cell: { kind: "unsupported", jsType: "object", diagnosticId: "decoded:2:备注" } });
      if (mutation === "orphan-diagnostic") evidence.cellDiagnostics.push({ id: "decoded:2:备注", sheet: evidence.sheet.name, logicalRow: 2, column: "备注" });
      if (mutation === "wrong-diagnostic-position") { entries[0].cell = { kind: "unsupported", jsType: "object", diagnosticId: "decoded:99:交易编号" }; evidence.cellDiagnostics.push({ id: "decoded:99:交易编号", sheet: evidence.sheet.name, logicalRow: 99, column: "交易编号" }); }
      if (mutation === "header-key") entries[0].key = "伪列";
      expect.soft(() => commit(f, f.changes.prepare(input)), mutation).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
      expect.soft(publicBook(f), mutation).toEqual(before);
    }
  });
  it("rejects an accepted source row without its candidate before any visible commit", () => {
    const f = setup(), input = intent(true), before = publicBook(f);
    input.tradingViewImport!.evidence!.rows.find(row => row.outcome === "accepted")!.candidateIds = [];

    expect(() => commit(f, f.changes.prepare(input))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect(publicBook(f)).toEqual(before);
  });
  it("rejects an unknown source candidate and preserves an existing public book", () => {
    const f = setup(); commit(f, f.changes.prepare({ kind: "import", candidates: [ordinary()] }));
    const input = intent(true), before = publicBook(f);
    input.tradingViewImport!.evidence!.rows.find(row => row.outcome === "accepted")!.candidateIds = ["unknown-candidate"];

    expect(() => commit(f, f.changes.prepare(input))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect(publicBook(f)).toEqual(before);
  });
  it("rejects a candidate claimed more than once by decoded source rows", () => {
    const f = setup(), input = intent(true), before = publicBook(f);
    const row = input.tradingViewImport!.evidence!.rows.find(row => row.outcome === "accepted")!;
    row.candidateIds.push(row.candidateIds[0]);

    expect(() => commit(f, f.changes.prepare(input))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect(publicBook(f)).toEqual(before);
  });
  it("rejects evidence that covers only part of the incoming candidates", () => {
    const f = setup(), input = intent(true), before = publicBook(f);
    input.tradingViewImport!.evidence!.rows = input.tradingViewImport!.evidence!.rows.filter(row => row.candidateIds.includes(input.candidates[0].id));

    expect(() => commit(f, f.changes.prepare(input))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect(publicBook(f)).toEqual(before);
  });
  it("classifies missing required decoded evidence fields as input errors without committing", () => {
    const fields = ["parserVersion", "fileFingerprint", "sheet", "sheet.ordinal", "sheet.name", "headers", "rows", "cellDiagnostics", "derived",
      "derived.accountId", "derived.accountOrigin", "derived.tradeNature", "derived.natureOrigin", "derived.sourceRun", "derived.runOrigin", "derived.market", "derived.symbol", "derived.currency",
      "rows.0.logicalRow", "rows.0.entries", "rows.0.outcome", "rows.0.candidateIds", "rows.0.diagnosticCodes", "rows.0.entries.0.cell"];
    for (const field of fields) {
      const f = setup(), input = intent(true), before = publicBook(f);
      const path = field.split("."), key = path.pop()!;
      const owner = path.reduce((value, part) => Reflect.get(value, part), input.tradingViewImport!.evidence!);
      Reflect.deleteProperty(owner, key);

      expect.soft(() => commit(f, f.changes.prepare(input)), field).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
      expect.soft(publicBook(f), field).toEqual(before);
    }
  });
  it("rejects source row claims that disagree with parser row outcomes and positions", () => {
    for (const mutation of ["swapped-candidates", "wrong-position", "repeated-position", "nonaccepted-with-candidate"] as const) {
      const f = setup(), input = intent(true), before = publicBook(f), rows = input.tradingViewImport!.evidence!.rows;
      if (mutation === "swapped-candidates") [rows[0].candidateIds, rows[1].candidateIds] = [rows[1].candidateIds, rows[0].candidateIds];
      if (mutation === "wrong-position") rows[0].logicalRow = 999;
      if (mutation === "repeated-position") rows[1].logicalRow = rows[0].logicalRow;
      if (mutation === "nonaccepted-with-candidate") rows[0].outcome = "invalid";

      expect.soft(() => commit(f, f.changes.prepare(input)), mutation).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
      expect.soft(publicBook(f), mutation).toEqual(before);
    }
  });
  it("validates decoded source evidence even when no TradingView candidate reaches planning", () => {
    const f = setup(), input = intent(true), before = publicBook(f);
    input.candidates = [];

    expect(() => commit(f, f.changes.prepare(input))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", phase: "prepare" }));
    expect(publicBook(f)).toEqual(before);
  });
  it("persists and reuses real parser evidence with accepted invalid and unpaired source rows", () => {
    const f = setup(), source = new TextEncoder().encode([csv, row(2, "多头进场", "2021-03-02", "10"), row(3, "多头进场", "2021-03-03", "bad")].join("\r\n"));
    const parser = parseTradingViewSimulationCsv(source, { fileName: "回放交易_SSE_600330_2026-09-03.csv", sourceFileId: fingerprintBytes(source) });
    const evidence = parser.tradingViewEvidence!;
    expect(evidence.rows.map(row => [row.logicalRow, row.outcome, row.candidateIds.length])).toEqual([[2, "accepted", 1], [3, "accepted", 1], [4, "unpaired", 0], [5, "invalid", 0]]);
    expect(parser.records.every(record => evidence.rows.find(row => row.logicalRow === record.source.row)?.candidateIds.includes(record.id))).toBe(true);
    const input: ImportIntent = { kind: "import", candidates: parser.records, tradingViewImport: { policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" }, evidence } };

    const first = commit(f, f.changes.prepare(input));
    expect(first.result.tradingViewImport?.material).toMatchObject({ kind: "save-evidence", observations: 4, links: 2 });
    const stored = readStoredTradeSnapshot(f.db, { version: { atLeast: first.bookVersion } });
    expect(stored.facts.map(fact => fact.id).sort()).toEqual(parser.records.map(record => record.id).sort());
    expect(stored.materials).toHaveLength(1);
    expect(stored.materials[0].version.observations.toSorted((a, b) => String(a.key).localeCompare(String(b.key))).map(observation => ({ raw: observation.raw, executionIds: observation.executionIds }))).toEqual(evidence.rows.map(row => ({ raw: row, executionIds: row.candidateIds })));
    const before = publicBook(f), repeated = commit(f, f.changes.prepare(input));
    expect(repeated.result.tradingViewImport?.material).toMatchObject({ kind: "reuse-exact", materialId: stored.materials[0].id, versionId: stored.materials[0].version.id });
    expect(repeated.bookVersion).toEqual(first.bookVersion);
    expect(publicBook(f)).toEqual(before);
  });
});

describe("TradingView import compatibility candidate5", () => {
  it("recognizes the same formal proof for specified omitted and null optional maintenance fields", () => {
    for (const optional of ["specified", "omitted", "null"] as const) {
      const f = formal(optional), before = publicBook(f), plan = f.changes.prepare({ kind: "import", candidates: f.legacy });
      expect.soft(plan.status, optional).toBe("ready");
      if (plan.status === "ready") expect(commit(f, plan).result.report.duplicate, optional).toBe(2);
      expect(publicBook(f)).toEqual(before);
    }
  });
  it("rejects malformed maintenance request fields before a migration writes", () => {
    for (const [field, value] of [["operationId", null], ["episodeMapDigest", ""], ["provisionalPrincipalAction", "forged"], ["expectedAffectedRows", null], ["expectedAffectedRows", [{ table: "executions", key: "forged", beforeDigest: null }]], ["unknown", "forged"]] as const) {
      const f = setup(); f.store.mergeTradeData({ executions: parsed().records.map(e => ({ ...e, accountId: `tradingview:${fp}`, accountLabel: "旧账户" })) });
      const plan = f.changes.prepare({ kind: "tradingview-account-migration", operationId: randomUUID() }), p = plan.tradingView as TradingViewMigrationPreview;
      expect(p.status).toBe("ready");
      const request = { operationId: p.operationId, idempotencyKey: randomUUID(), planDigest: p.planDigest, baseSnapshotDigest: p.baseSnapshotDigest };
      Reflect.set(request, field, value);
      const before = publicBook(f), all = snapshot(f.db, true);
      expect(() => f.changes.commit({ requestId: randomUUID(), planId: plan.planId, choices: {}, maintenanceRequest: request }), field).toThrowError(expect.objectContaining({ code: "migration-blocked" }));
      expect(publicBook(f)).toEqual(before); expect(snapshot(f.db, true)).toEqual(all);
    }
  });
  it("preserves real execution IDs during account migration while still blocking unknown account references in revisions", () => {
    for (const accountInReason of [false, true]) {
      const f = setup(), legacy = parsed().records.map(e => ({ ...e, accountId: `tradingview:${fp}`, accountLabel: "旧账户" }));
      f.store.mergeTradeData({ executions: legacy });
      if (accountInReason) {
        const before = f.store.getExecutions()[0];
        commit(f, f.changes.prepare({ kind: "revision", revision: { id: randomUUID(), instrumentId: before.instrument.id, accountId: before.accountId, reason: `核对账户 ${before.accountId}`, changes: [{ before, after: before }] } }));
      }
      const before = publicBook(f), plan = f.changes.prepare({ kind: "tradingview-account-migration", operationId: randomUUID() });
      const migration = plan.tradingView as TradingViewMigrationPreview;
      expect.soft(migration.status, `accountInReason=${accountInReason}`).toBe(accountInReason ? "blocked" : "ready");
      if (accountInReason) expect(migration.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unknown-reference", table: "trade_revisions", fieldPath: "$.revision.reason" })]));
      expect(publicBook(f)).toEqual(before);
    }
  });
  it("rejects proven import and browser finance contradictions before any plan and preserves the formal revision journey", () => {
    const f = setup(); f.store.mergeTradeData({ executions: parsed().records });
    const changed = parsed().records.map(e => ({ ...e, price: "999" })), before = snapshot(f.db, true);
    expect(() => f.changes.prepare({ kind: "import", candidates: changed })).toThrowError(expect.objectContaining({ code: "TRADINGVIEW_SOURCE_FINANCIAL_MISMATCH" }));
    expect(snapshot(f.db, true)).toEqual(before);
    expect(() => f.store.mergeBrowserState(browser(changed))).toThrowError(expect.objectContaining({ code: "TRADINGVIEW_SOURCE_FINANCIAL_MISMATCH" }));
    expect(snapshot(f.db, true)).toEqual(before);
    const original = f.store.getExecutions()[0], { revision, receipt } = revise(f, original, "999");
    expect(receipt.result.revision).toMatchObject({ id: revision.id, reason: revision.reason });
    expect(f.store.getTradeRevisions(original.instrument.id)).toEqual(expect.arrayContaining([expect.objectContaining({ id: revision.id, changes: [{ before: original, after: { ...original, price: "999" } }] })]));
    expect(f.store.getExecutions().find(e => e.id === original.id)?.price).toBe("999"); expect(readBookVersion(f.db)).toEqual(receipt.bookVersion);
  });
  it("reviews the unchanged W15 weak seed and commits only a bound independent reprepare", () => reviewAndIndependent("W15"));
  it("reviews the unchanged W16 roleless seed and commits only a bound independent reprepare", () => reviewAndIndependent("W16"));
  it("reviews the unchanged W17 cross-account price collision without a finance veto", () => reviewAndIndependent("W17"));
  it("deduplicates only strict unique same-scope legacy shapes without rewriting stored rows", () => {
    for (const shape of ["role-id", "roleless-row-id"] as const) {
      const f = setup(), rows = parsed().records.map(e => shape === "role-id" ? { ...e, id: `tradingview:${fp}:CN-SH:600330:1:${e.source.simulationRole}` } : { ...e, source: { ...e.source, simulationRole: undefined } });
      f.store.mergeTradeData({ executions: rows }); const before = snapshot(f.db);
      const p = f.changes.prepare(intent()); expect(p.status).toBe("ready"); expect(p.summary.tradingViewImport?.facts.duplicate).toBe(2);
      expect(commit(f, p).result.report).toMatchObject({ inserted: 0, duplicate: 2, conflict: 0 }); expect(snapshot(f.db)).toEqual(before);
    }
  });
  it("uses a real formal migration receipt and the complete operation closure as source proof", () => {
    const f = formal(), before = snapshot(f.db); expect(f.changes.getCommit("formal:request")).toEqual(f.maintenanceReceipt);
    const p = f.changes.prepare({ kind: "import", candidates: f.legacy }); expect(p.status).toBe("ready"); expect(p.summary.tradingViewImport?.facts.duplicate).toBe(2);
    const receipt = commit(f, p); expect(receipt.result.report.duplicate).toBe(2); expect(snapshot(f.db)).toEqual(before);
    const ledger = f.db.prepare("select * from tradingview_account_migration_rows where operation_id='formal:forward'").all(); expect(ledger.length).toBeGreaterThan(2);
    expect(count(f.db, "tradingview_account_migration_operations")).toBe(1);
  });
  it("downgrades every incomplete or no-longer-current operation proof to identity review", () => {
    const cases = ["missing-ledger-row", "ledger-before-or-after-content-changed", "another-affected-execution-current-afterimage-changed", "affected-instrument-current-afterimage-changed", "affected-material-version-or-head-changed", "affected-observation-or-link-changed", "source-account-mapping-set-changed", "unexplained-request-alias", "dependency-set-or-digest-changed", "plan-request-receipt-choices-result-binding-changed", "rollback-committed", "competing-forward-operation"] as const;
    for (const name of cases) {
      const f = formal(); expect(f.changes.prepare({ kind: "import", candidates: f.legacy }).status, name).toBe("ready");
      const old = f.store.getExecutions(), m = sourceMaterial(old, `changed:${name}`);
      if (name === "missing-ledger-row") f.db.exec("delete from tradingview_account_migration_rows where rowid=(select rowid from tradingview_account_migration_rows where operation_id='formal:forward' limit 1)");
      else if (name === "ledger-before-or-after-content-changed") f.db.exec("update tradingview_account_migration_rows set after_json='{}' where table_name='executions' and primary_key=(select min(primary_key) from tradingview_account_migration_rows where table_name='executions')");
      else if (name === "another-affected-execution-current-afterimage-changed") revise(f, old[1], "41");
      else if (name === "affected-instrument-current-afterimage-changed") f.store.putInstrumentName({ instrumentId: old[0].instrument.id, name: "已核对的新名称" });
      else if (name === "affected-material-version-or-head-changed") saveMaterial(f, m);
      else if (name === "affected-observation-or-link-changed") { m.observations[0].raw = { changed: true }; saveMaterial(f, m); }
      else if (name === "source-account-mapping-set-changed") { m.accountMappings = [{ originalAccountId: f.legacy[0].accountId, canonicalAccountId: old[0].accountId, reason: "explicit material mapping", auditReference: "formal:forward", recordedAt: m.recordedAt }]; saveMaterial(f, m); }
      else if (name === "unexplained-request-alias") f.db.prepare("insert into trade_change_requests(request_id,request_digest,receipt_id) values(?,?,?)").run("unexplained", "bad", f.maintenanceReceipt.receiptId);
      else if (name === "dependency-set-or-digest-changed") f.db.exec("delete from tradingview_account_migration_dependencies where operation_id='formal:forward'");
      else if (name === "plan-request-receipt-choices-result-binding-changed") alterPlan(f, f.maintenancePlan.planId, body => { body.review.summary = { inputDigest: "changed-original-input" }; });
      else if (name === "rollback-committed") {
        const result = f.maintenanceReceipt.result.tradingView!;
        const plan = f.changes.prepare({ kind: "tradingview-account-migration-rollback", operationId: result.operationId, rollbackOperationId: "formal:inverse", expectedAfterSnapshotDigest: result.afterSnapshotDigest });
        f.changes.commit({ requestId: "inverse", planId: plan.planId, choices: {}, maintenanceRequest: { operationId: result.operationId, rollbackOperationId: "formal:inverse", expectedAfterSnapshotDigest: result.afterSnapshotDigest } });
      } else {
        f.db.exec("insert into tradingview_account_migration_operations select 'competitor',operation_kind,parent_operation_id,'competitor-key',plan_digest,base_snapshot_digest,after_snapshot_digest,status,request_json,result_json,created_at,updated_at from tradingview_account_migration_operations where operation_id='formal:forward'");
        f.db.exec("insert into tradingview_account_migration_rows select 'competitor',table_name,primary_key,before_json,after_json,before_digest,after_digest from tradingview_account_migration_rows where operation_id='formal:forward'");
      }
      const before = snapshot(f.db); const plan = f.changes.prepare({ kind: "import", candidates: f.legacy });
      expect(plan.status, name).toBe("review-required"); expect(snapshot(f.db), name).toEqual(before);
    }
  });
  it("keeps account instrument nature and exact raw sourceRun namespaces isolated", () => {
    const names = ["different-account", "different-instrument", "different-nature", "different-present-run", "prefixed-vs-unprefixed", "absent-vs-present", "whole-account-business-run-null-no-collapse"] as const;
    for (const name of names) for (const currency of name === "different-instrument" ? [false, true] : [false]) {
      const f = setup(), records = parsed().records; f.store.mergeTradeData({ executions: records });
      const rows = structuredClone(records);
      for (const e of rows) {
        if (name === "different-account") e.accountId = "another-account";
        if (name === "different-instrument") e.instrument = currency ? { ...e.instrument, currency: "USD" } : { ...e.instrument, id: "HK:600330", market: "HK", currency: "HKD" };
        if (name === "different-nature") { e.source.tradeNature = "live"; delete e.source.simulationRunId; delete e.source.sourceTradeId; delete e.source.simulationRole; delete e.source.simulationSignal; delete e.source.sourceReport; }
        if (name === "different-present-run") e.source.simulationRunId = "other-exact-run";
        if (name === "prefixed-vs-unprefixed") e.source.simulationRunId = e.source.simulationRunId!.replace(/^tradingview:/, "");
        if (name === "absent-vs-present" || name === "whole-account-business-run-null-no-collapse") delete e.source.simulationRunId;
      }
      const before = snapshot(f.db), visible = publicBook(f);
      if (name === "absent-vs-present" || name === "whole-account-business-run-null-no-collapse") {
        expect(() => f.changes.prepare({ kind: "import", candidates: rows }), name).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
        expect(publicBook(f)).toEqual(visible); expect(snapshot(f.db)).toEqual(before); continue;
      }
      const p = f.changes.prepare({ kind: "import", candidates: rows });
      expect(p.status, name).toBe("review-required"); expect(snapshot(f.db)).toEqual(before); expect(p.summary.tradingViewImport?.facts.duplicate).toBe(0);
    }
  });
  it("partitions exact locator groups and non-TV residuals without losing fill multiplicity", () => {
    const f = setup(), tv = parsed().records; f.store.mergeTradeData({ executions: tv });
    const non = ordinary(), same1 = { ...non, id: "new-file:7", source: { ...non.source, row: 7, sourceOrder: 7, fileFingerprint: "new-file" } }, same2 = { ...same1, id: "new-file:8", source: { ...same1.source, row: 8, sourceOrder: 8 } };
    f.store.mergeTradeData({ executions: [non] });
    const p = f.changes.prepare({ kind: "import", candidates: [...tv, same1, same2] }); expect(p.status).toBe("ready"); expect(p.summary.tradingViewImport?.facts.duplicate).toBe(2); expect(p.conflicts).toHaveLength(1);
    commit(f, p, { conflicts: [{ conflictId: p.conflicts[0].id, decision: "keep-both" }] });
    expect(f.store.getExecutions().map(e => e.id).sort()).toEqual([...tv.map(e => e.id), non.id, same1.id, same2.id].sort());
  });
  it("recognizes TV without an envelope and never invents decoded evidence for normalized-only input", () => {
    for (const field of ["platform", "inputKind"] as const) {
      const f = setup(), records = parsed().records.map(e => field === "platform" ? e : ({ ...e, source: { ...e.source, platform: "legacy", inputKind: "tradingview" as const } }));
      const p = f.changes.prepare({ kind: "import", candidates: records }); expect(p.tvImportGuard?.policy).toBe("tv-compat-v1");
      expect(commit(f, p).result.tradingViewImport?.material.kind).toBe("normalized-only"); expect(count(f.db, "source_observations")).toBe(0);
    }
    const legacy = parseTradingViewCsv({ bytes, fileName: "回放交易_SSE_600330.csv", fileFingerprint: fp }), legacyStore = setup();
    expect(legacy.blocked).toBe(false); expect(legacy.tradingViewEvidence).toBeUndefined();
    expect(legacy.records[0].source.simulationSignal).toBe("signal, quoted");
    expect(legacy.records.some(record => record.source.simulationReport !== undefined)).toBe(true);
    const legacyReceipt = commit(legacyStore, legacyStore.changes.prepare({ kind: "import", candidates: legacy.records }));
    expect(legacyReceipt.result.tradingViewImport?.material.kind).toBe("normalized-only");
    expect(legacyStore.store.getExecutions()).toEqual(legacy.records);
    expect(readStoredTradeSnapshot(legacyStore.db).materials).toEqual([]);
    const f = setup(), p = f.changes.prepare({ kind: "import", candidates: [ordinary()], tradingViewImport: { policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" } } });
    expect(p.tvImportGuard).toBeUndefined(); commit(f, p); expect(count(f.db, "source_observations")).toBe(0);
  });
  it("keeps mixed review batches domain-read-only and rejects mixed proven vetoes before saving any plan", () => {
    const f = setup(); f.store.mergeTradeData({ executions: weak("W16") }); const before = snapshot(f.db);
    const p = f.changes.prepare({ kind: "import", candidates: [...parsed().records, ordinary()] }); expect(p.status).toBe("review-required"); expect(snapshot(f.db)).toEqual(before);
    expect(() => commit(f, p)).toThrow(); expect(snapshot(f.db)).toEqual(before);
    const g = setup(); g.store.mergeTradeData({ executions: parsed().records }); const all = snapshot(g.db, true);
    expect(() => g.changes.prepare({ kind: "import", candidates: [ordinary(), { ...parsed().records[0], price: "999" }] })).toThrowError(expect.objectContaining({ code: "TRADINGVIEW_SOURCE_FINANCIAL_MISMATCH" })); expect(snapshot(g.db, true)).toEqual(all);
  });
  it("commits an exact material reimport with only receipt consumption and request-management writes", () => {
    const f = setup(), first = commit(f, f.changes.prepare(intent(true))); expect(first.result.tradingViewImport?.material.kind).toBe("save-evidence");
    const before = snapshot(f.db), receipts = count(f.db, "trade_change_receipts"), p = f.changes.prepare(intent(true));
    expect(p.summary.tradingViewImport?.material.kind).toBe("reuse-exact"); expect(p.summary.changes).toEqual([]);
    const receipt = commit(f, p, {}, "exact"); expect(receipt.bookVersion).toEqual(first.bookVersion); expect(snapshot(f.db)).toEqual(before);
    expect(count(f.db, "trade_change_receipts")).toBe(receipts + 1); expect(f.changes.getCommit("exact")).toEqual(receipt);
    expect(count(f.db, "source_execution_links")).toBe(2); expect(count(f.db, "source_observations")).toBe(parsed().tradingViewEvidence!.rows.length);
  });
  it("versions first saved source evidence and preserves explicit independent and replacement material choices", () => {
    const f = setup(); f.store.mergeTradeData({ executions: parsed().records }); const before = readBookVersion(f.db), factsBefore = readStoredTradeSnapshot(f.db).facts;
    const first = commit(f, f.changes.prepare(intent(true))), material = first.result.tradingViewImport!.material;
    expect(material.kind).toBe("save-evidence"); expect(first.bookVersion).toMatchObject({ databaseId: before.databaseId, epoch: before.epoch }); expect(first.bookVersion.sequence).toBeGreaterThan(before.sequence);
    expect(readStoredTradeSnapshot(f.db).facts).toEqual(factsBefore); expect(readStoredTradeSnapshot(f.db).materials).toHaveLength(1);
    expect(commit(f, f.changes.prepare(intent(true))).bookVersion).toEqual(first.bookVersion);
    if (material.kind !== "save-evidence") throw new Error("Expected first material");
    const altered = intent(true); altered.tradingViewImport!.evidence!.rows[0].entries.push({ key: "extra-observed", cell: { kind: "string", value: "changed" } });
    const domain = snapshot(f.db, true); expect(() => f.changes.prepare(altered)).toThrowError(expect.objectContaining({ code: "TRADINGVIEW_MATERIAL_CHOICE_REQUIRED" })); expect(snapshot(f.db, true)).toEqual(domain);
    const independent = structuredClone(altered); independent.tradingViewImport!.material = { kind: "independent" };
    const second = commit(f, f.changes.prepare(independent)); expect(second.result.tradingViewImport?.material).toMatchObject({ kind: "save-evidence", reason: "independent" });
    const replacement = structuredClone(altered); replacement.tradingViewImport!.material = { kind: "new-version", materialId: material.materialId, expectedCurrentVersionId: material.versionId };
    const third = commit(f, f.changes.prepare(replacement)); expect(third.result.tradingViewImport?.material).toMatchObject({ kind: "save-evidence", reason: "explicit-new-version", materialId: material.materialId });
    expect(count(f.db, "source_material_versions")).toBe(3); expect(count(f.db, "source_observations")).toBe(parsed().tradingViewEvidence!.rows.length * 3);
    const stale = snapshot(f.db, true); expect(() => f.changes.prepare(replacement)).toThrowError(expect.objectContaining({ code: "MATERIAL_HEAD_CHANGED" })); expect(snapshot(f.db, true)).toEqual(stale);
  });
  it("binds identity reprepare to the complete unchanged original input and candidate closure", () => {
    const f = setup(); f.store.mergeTradeData({ executions: weak("W16") }); const original = intent(true), parent = f.changes.prepare(original), selected = bound(original, parent);
    const mutations: [string, (value: ImportIntent) => void][] = [
      ["candidate-price", v => { v.candidates[0].price = "999"; }], ["candidate-account", v => { v.candidates[0].accountId = "other"; }], ["candidate-id", v => { v.candidates[0].id = "other"; }], ["source-raw-run", v => { v.candidates[0].source.simulationRunId = "other"; }], ["source-row-or-trade-id", v => { v.candidates[0].source.row = 900; }], ["instrument", v => { v.candidates[0].instrument.name = "other"; }],
      ["history-importedAt", v => { Object.assign(v, { importHistory: [{ importedAt: "2026-10-27", fileName: "fixture" }] }); }], ["history-fileName", v => { Object.assign(v, { importHistory: [{ importedAt: "2026-10-26", fileName: "other" }] }); }],
      ["material-intent", v => { v.tradingViewImport!.material = { kind: "independent" }; }], ["decoded-evidence", v => { v.tradingViewImport!.evidence!.sheet.name = "changed"; }], ["unknown-extra-input-field", v => { Object.assign(v, { extra: "unknown-but-bound" }); }],
    ];
    for (const [name, mutate] of mutations) { const bad = structuredClone(selected); mutate(bad); const before = snapshot(f.db, true); expect(() => f.changes.prepare(bad), name).toThrow(); expect(snapshot(f.db, true)).toEqual(before); }
    for (const name of ["forged-parent-id", "wrong-input-digest", "missing-candidate", "extra-candidate", "repeated-candidate", "split-entry-exit-pair"] as const) {
      const bad = structuredClone(selected), id = bad.tradingViewImport!.identity!;
      if (name === "forged-parent-id") id.reviewPlanId = "fake"; else if (name === "wrong-input-digest") id.inputDigest = "wrong";
      else if (name === "extra-candidate") id.candidateIds.push("extra"); else if (name === "repeated-candidate") id.candidateIds.push(id.candidateIds[0]); else id.candidateIds.pop();
      const before = snapshot(f.db, true); expect(() => f.changes.prepare(bad), name).toThrow(); expect(snapshot(f.db, true)).toEqual(before);
    }
    const child = f.changes.prepare(selected); const chain = bound(selected, child); expect(() => f.changes.prepare(chain)).toThrow();
    const ready = f.changes.prepare({ kind: "import", candidates: [ordinary()] }); const wrong = structuredClone(selected); wrong.tradingViewImport!.identity!.reviewPlanId = ready.planId; expect(() => f.changes.prepare(wrong)).toThrow();
    commit(f, child); expect(() => f.changes.prepare(selected)).toThrow();
  });
  it("rejects fresh stale TV parent proof material and policy before writing while preserving old non-TV plans", () => {
    // S15 ruling: precise management-row negatives only; no fact/operation/receipt fabrication.
    for (const name of ["missing-guard", "missing-v2", "expired", "base-version", "parent-body", "parent-policy", "proof-current", "material-current"] as const) {
      let now = 1000; const f = setup({ now: () => now, ttlMs: 100 }); let p: ReviewPlan;
      if (name.startsWith("parent")) { f.store.mergeTradeData({ executions: weak("W16") }); const original = intent(true), parent = f.changes.prepare(original); p = f.changes.prepare(bound(original, parent));
        if (name === "parent-body") alterPlan(f, parent.planId, body => { body.review.extra = "changed"; }); else corruptPlan(f, () => { f.db.prepare("update trade_change_plans set policy='obsolete' where id=?").run(parent.planId); });
      } else if (name === "material-current") { commit(f, f.changes.prepare(intent(true))); p = f.changes.prepare(intent(true)); const m = sourceMaterial(parsed().records, "other-head"); saveMaterial(f, m); }
      else if (name === "proof-current") { const g = formal(); p = g.changes.prepare({ kind: "import", candidates: g.legacy }); g.store.putInstrumentName({ instrumentId: g.legacy[0].instrument.id, name: "changed after prepare" }); const before = snapshot(g.db, true); expect(() => commit(g, p)).toThrow(); expect(snapshot(g.db, true)).toEqual(before); continue; }
      else { p = f.changes.prepare(intent()); if (name === "missing-guard") alterPlan(f, p.planId, body => { delete body.review.tvImportGuard; });
        if (name === "missing-v2") alterPlan(f, p.planId, body => { delete body.review.reviewContract; delete body.review.status; delete body.review.identityReviews; delete body.review.tvImportGuard; });
        if (name === "expired") now += 101; if (name === "base-version") f.store.mergeTradeData({ executions: [ordinary()] }); }
      const before = snapshot(f.db, true); expect(() => commit(f, p), name).toThrow(); expect(snapshot(f.db, true)).toEqual(before);
    }
    const f = setup(), p = f.changes.prepare({ kind: "import", candidates: [ordinary()] }); alterPlan(f, p.planId, body => { delete body.review.reviewContract; delete body.review.status; delete body.review.identityReviews; });
    expect(commit(f, p).result.report.inserted).toBe(1); expect(f.store.getExecutions()).toHaveLength(1);
  });
  it("returns saved receipts before new policy checks and preserves consumed-plan replay priorities", () => {
    let now = 1000; const f = setup({ now: () => now, ttlMs: 100 }), p = f.changes.prepare(intent()), input = { requestId: "saved", planId: p.planId, choices: {} };
    const first = f.changes.commit(input); now = 10000; f.store.mergeTradeData({ executions: [ordinary()] });
    const before = snapshot(f.db); expect(f.changes.commit(input)).toEqual(first); expect(f.changes.getCommit("saved")).toEqual(first);
    expect(f.changes.commit({ ...input, requestId: "alias" })).toEqual(first); expect(snapshot(f.db)).toEqual(before);
    expect(() => f.changes.commit({ ...input, planId: "other" })).toThrowError(expect.objectContaining({ code: "REQUEST_CONFLICT" }));
    expect(() => f.changes.commit({ ...input, requestId: "different-choices", choices: { conflicts: [{ conflictId: "fake", decision: "keep-existing", reason: "reason cannot replace identity policy" }] } })).toThrow();
  });
  it.each(["keep-existing", "use-incoming", "keep-both"] as const)("resolves the unchanged ordinary W24 overlap with %s", decision => {
    const f = setup(), old = ordinary(); f.store.mergeTradeData({ executions: [old] });
    const incoming = [7, 8].map(row => ({ ...old, id: `new-file:${row}`, source: { ...old.source, row, sourceOrder: row, fileFingerprint: "new-file" } }));
    const p = f.changes.prepare({ kind: "import", candidates: incoming }); expect(p.conflicts).toHaveLength(1); expect(p.tvImportGuard).toBeUndefined(); expect(p.conflicts[0].allowed).toContain(decision);
    const receipt = commit(f, p, { conflicts: [{ conflictId: p.conflicts[0].id, decision, ...(decision === "use-incoming" ? { reason: "已核对来源，明确替换" } : {}) }] });
    expect(f.store.getExecutions().map(e => e.id).sort()).toEqual((decision === "keep-existing" ? [old.id, incoming[1].id] : decision === "use-incoming" ? incoming.map(e => e.id) : [old.id, ...incoming.map(e => e.id)]).sort()); expect(readBookVersion(f.db)).toEqual(receipt.bookVersion);
  });
});
