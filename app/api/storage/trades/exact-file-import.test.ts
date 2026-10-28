import { webcrypto } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../db/sqlite", async original => ({ ...await original<typeof import("../../../../db/sqlite")>(), openSqliteDatabase: vi.fn() }));
import { openSqliteDatabase } from "../../../../db/sqlite";
import { createSqliteHttpClient } from "../../../lib/storage/sqlite-http-client";
import type { StandardTradeChangeIntent } from "../../../lib/storage/sqlite-contracts";
import { parseBrokerStatement } from "../../../lib/import/dispatcher";
import { enrichStatementImport } from "../../../lib/import/enrich-import";
import { createImportPreview } from "../../../lib/import/import-preview";
import { CHINA_MERCHANTS_PAGES, CHINA_MERCHANTS_POSITION_EVIDENCE, CHINA_MERCHANTS_MISSING_SECURITY_BALANCE } from "../../../lib/import/__fixtures__/china-merchants-pages";
import { CHINA_MERCHANTS_S3A_LEGACY } from "../../../lib/import/__fixtures__/china-merchants-s3a";
import { columnStatement } from "../../../lib/import/__fixtures__/china-merchants-columns";
import { TIGER_SHORT_PAGES } from "../../../lib/import/__fixtures__/tiger-pages";
import { legacyPages as tigerLegacyPages } from "../../../lib/import/__fixtures__/tiger-legacy-pages";
import { legacy as futuLegacyPages } from "../../../lib/import/__fixtures__/futu-pdf-layouts";
import { canonicalInstrumentId } from "../../../lib/instruments/display-name";
import type { PdfTextPage } from "../../../lib/import/pdf-text";
import { monthlyImportIntent } from "../../../components/import/trade-import-material";
import { csv as tradingViewCsv, fileFor, row as tradingViewRow } from "../../../lib/import/__fixtures__/tradingview";
import { importIntentForPreview } from "../../../components/import/trade-import-plan";
import type { MaterialVersionInput } from "../../../lib/storage/source-materials";
import { POST as prepare } from "./plans/route";
import { POST as commit } from "./commit/route";
import { GET as receipt } from "./receipts/route";
import { POST as read } from "./read/route";

const original = await vi.importActual<typeof import("../../../../db/sqlite")>("../../../../db/sqlite");
let directory: string, path: string, db: DatabaseSync;
const fact = { id: "exact-file-E0", accountId: "A", accountLabel: "主账户", instrument: { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" }, side: "buy" as const, executedAt: "2026-10-01", quantity: "1", price: "123", fee: "0", source: { platform: "broker", fileFingerprint: "1234567890abcdef", row: 1, timePrecision: "date-only" as const } };
const identity = { sha256: "a".repeat(64), byteLength: 123, complete: true };
const intent = (fileImport = identity, candidates = [fact]) => ({ kind: "import", candidates, fileImport }) as StandardTradeChangeIntent;
async function dispatch(input: string, init?: RequestInit) {
  const request = new Request(`http://localhost${input}`, init);
  if (input === "/api/storage/trades/plans") return prepare(request);
  if (input === "/api/storage/trades/commit") return commit(request);
  if (input.startsWith("/api/storage/trades/receipts?")) return receipt(request);
  if (input === "/api/storage/trades/read") return read(request);
  throw new Error(`Unexpected URL ${input}`);
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  directory = mkdtempSync(join(tmpdir(), "trade-exact-file-")); path = join(directory, "isolated.sqlite");
  db = original.openSqliteDatabase(path); vi.mocked(openSqliteDatabase).mockImplementation(() => db);
});
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }); vi.clearAllMocks(); vi.unstubAllGlobals(); });


async function statementPreview(pages: PdfTextPage[], name = "招商证券.pdf") {
  const bytes = new TextEncoder().encode(`%PDF-1.7\nfixture:${JSON.stringify(pages)}`);
  const parsed = await parseBrokerStatement({ name, arrayBuffer: async () => bytes.buffer }, { extractPdfPages: async () => pages });
  if (parsed.broker === "unknown") throw new Error("fixture must parse");
  const enriched = await enrichStatementImport(parsed, { resolver: async () => ({ resolved: new Map(), unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve() }) });
  return createImportPreview(name, enriched);
}

describe("successful exact file imports through the public HTTP client", () => {
  it.each(["complete", "bad-date", "bad-date-no-business"])("distinguishes normal page footers from malformed trades through commit and retry: %s", async state => {
    const malformed = state !== "complete";
    const pages = columnStatement({ continuation: true });
    for (const page of pages) page.items.push({ text: `第${page.pageNumber}页/共${pages.length}页`, x: 390, y: 580, width: 70, height: 8 });
    if (malformed) pages[1].items.find(item => item.y === 182 && item.x === 20)!.text = "not-a-date";
    if (state === "bad-date-no-business") pages[1].items.find(item => item.y === 182 && item.text === "证券卖出")!.text = "";
    const preview = await statementPreview(pages);
    expect(preview.records).toHaveLength(malformed ? 1 : 2);
    expect(importIntentForPreview(preview).fileImport?.complete).toBe(!malformed);
    const input = importIntentForPreview(preview);
    input.fileImport!.complete = true;
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: `footer-${malformed}`, planId: plan.planId, choices: {} });
    if (malformed) expect(saved.result).not.toHaveProperty("importedFile");
    else expect(saved.result.importedFile).toEqual(preview.fileContent);
    db.close(); db = original.openSqliteDatabase(path);
    const retry = client.prepareTradeChanges(importIntentForPreview({ ...preview, fileName: "renamed-footer.pdf" }));
    if (malformed) await expect(retry).resolves.toBeDefined();
    else await expect(retry).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
    expect((await client.readTradeBook()).facts).toHaveLength(preview.records.length);
  });

  it.each(["china-merchants", "china-merchants-legacy", "tiger", "tiger-legacy-bad-time", "futu", "futu-bad-time", "futu-missing-time"])("preserves retry when %s drops a malformed trade before row validation", async broker => {
    let pages: PdfTextPage[];
    if (broker === "china-merchants") {
      pages = structuredClone(CHINA_MERCHANTS_POSITION_EVIDENCE);
      pages[1].items.find(item => item.y === 234 && item.x === 36)!.text = "2025-01-03";
    } else if (broker === "china-merchants-legacy") {
      pages = structuredClone(CHINA_MERCHANTS_S3A_LEGACY);
      pages[1].items.push(...pages[1].items.filter(item => item.y === 216).map(item => ({ ...item, y: 198 })));
      pages[1].items.find(item => item.y === 216 && item.x === 36)!.text = "2026-03-09 深圳";
    } else if (broker === "tiger") {
      pages = structuredClone(TIGER_SHORT_PAGES);
      for (const item of pages[0].items) if (item.y === 142 && (item.x === 342 || item.x === 420)) item.text = "bad";
    } else if (broker === "tiger-legacy-bad-time") {
      pages = tigerLegacyPages();
      pages[0].items.push(...pages[0].items.filter(item => item.y === 250).map(item => ({ ...item, y: 350 })));
      for (const item of pages[0].items) if (item.y === 250 && [370, 440, 1010].includes(item.x)) item.text = "bad";
    } else {
      pages = futuLegacyPages("F1");
      const child = pages[0].items.filter(item => item.y === 102 && item.x > 200).map(item => ({ ...item, y: 120, text: item.x + item.width < 390 ? (broker === "futu-bad-time" ? "bad-time" : broker === "futu-missing-time" ? "" : "2020/01/27 11:31:42") : "bad" }));
      for (const item of pages[0].items) if (item.y >= 120) item.y += 18;
      pages[0].items.push(...child);
    }
    const name = `${broker}.pdf`;
    const bytes = new TextEncoder().encode(`%PDF-1.7\nfixture:${JSON.stringify(pages)}`);
    const parsed = await parseBrokerStatement({ name, arrayBuffer: async () => bytes.buffer }, { extractPdfPages: async () => pages });
    if (parsed.broker === "unknown") throw new Error("fixture must parse");
    expect(parsed.records).toHaveLength(1);
    const enriched = await enrichStatementImport(parsed, { resolver: async lookups => ({ resolved: new Map(lookups.map(lookup => [canonicalInstrumentId(lookup.symbol, lookup.market), { ...lookup, name: "测试证券", assetType: "stock" as const, source: "tencent" as const, confidence: "portal" as const, resolvedAt: "2026-09-07T00:00:00Z" }])), unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve() }) });
    const preview = createImportPreview(name, enriched);
    expect(preview.unresolvedInstrumentCount).toBe(0);
    const client = createSqliteHttpClient(dispatch);
    const input = importIntentForPreview(preview);
    input.fileImport!.complete = true; // The server must independently reject strong success for pending raw evidence.
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: `partial-parser-${broker}`, planId: plan.planId, choices: {} });
    expect(saved.result).not.toHaveProperty("importedFile");
    expect(importIntentForPreview(preview).fileImport?.complete).toBe(false);
    db.close(); db = original.openSqliteDatabase(path);
    await expect(client.prepareTradeChanges(importIntentForPreview({ ...preview, fileName: `renamed-${name}` }))).resolves.toBeDefined();
    expect((await client.readTradeBook()).facts).toHaveLength(preview.records.length);
  });

  it.each([
    { name: "invalid-row", extra: tradingViewRow(9, "多头进场", "not-a-date", "10") },
    { name: "duplicate-role", extra: tradingViewRow(1, "多头进场", "2021-02-19", "10") },
  ])("preserves retry for a partially parsed TradingView file with $name", async ({ name, extra }) => {
    const client = createSqliteHttpClient(dispatch);
    const file = fileFor(`${tradingViewCsv}\r\n${extra}`);
    const parsed = await parseBrokerStatement(file);
    if (parsed.broker === "unknown") throw new Error("fixture must parse");
    const enriched = await enrichStatementImport(parsed, { resolver: async () => ({ resolved: new Map([["CN-SH:600330", { market: "CN-SH", symbol: "600330", name: "天通股份", assetType: "stock", source: "tencent", confidence: "portal", resolvedAt: "2026-09-07T00:00:00Z" }]]), unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve() }) });
    const preview = createImportPreview(file.name, enriched);
    expect(preview.records).toHaveLength(2);
    const input = importIntentForPreview(preview);
    input.fileImport!.complete = true; // Even optimistic callers must retain pending parser evidence.
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: `partial-tv-${name}`, planId: plan.planId, choices: {} });
    expect(saved.result).not.toHaveProperty("importedFile");
    expect(importIntentForPreview(preview).fileImport?.complete).toBe(false);
    db.close(); db = original.openSqliteDatabase(path);
    await expect(client.prepareTradeChanges(importIntentForPreview({ ...preview, fileName: "改名_SSE_600330.csv" }))).resolves.toBeDefined();
    expect((await client.readTradeBook()).facts).toHaveLength(2);
  });

  it("blocks the same content before confirmation after reopen and preserves same-request recovery", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges(intent());
    const request = { requestId: "first", planId: plan.planId, choices: {} };
    const saved = await client.commitTradeChanges(request);
    db.close(); db = original.openSqliteDatabase(path);
    expect(await client.commitTradeChanges(request)).toEqual(saved);
    expect(await client.commitTradeChanges({ ...request, requestId: "alias" })).toEqual(saved);
    await expect(client.prepareTradeChanges(intent())).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED", status: 409 });
    expect((await client.readTradeBook()).facts).toHaveLength(1);
    expect(db.prepare("select count(*) n from trade_change_receipts").get()).toMatchObject({ n: 1 });
  });
  it("allows cancelled and rolled-back attempts, and records success only after commit", async () => {
    const client = createSqliteHttpClient(dispatch);
    await client.prepareTradeChanges(intent()); // Cancelled: no commit.
    const plan = await client.prepareTradeChanges(intent());
    db.exec("create trigger fail_import_receipt before insert on trade_change_receipts begin select raise(abort, 'fixture failure'); end");
    const request = { requestId: "retry-failure", planId: plan.planId, choices: {} };
    await expect(client.commitTradeChanges(request)).rejects.toBeDefined();
    expect((await client.readTradeBook()).facts).toHaveLength(0);
    await client.prepareTradeChanges(intent());
    db.exec("drop trigger fail_import_receipt");
    await client.commitTradeChanges(request);
    await expect(client.prepareTradeChanges(intent())).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
  });
  it("rechecks a racing no-op plan inside commit even when the book did not advance", async () => {
    const client = createSqliteHttpClient(dispatch);
    const seed = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    await client.commitTradeChanges({ requestId: "legacy", planId: seed.planId, choices: {} });
    const first = await client.prepareTradeChanges(intent()), second = await client.prepareTradeChanges(intent());
    const saved = await client.commitTradeChanges({ requestId: "first", planId: first.planId, choices: {} });
    expect(saved.bookVersion).toEqual(second.baseVersion);
    await expect(client.commitTradeChanges({ requestId: "racing", planId: second.planId, choices: {} })).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
    expect((await client.readTradeBook()).facts).toHaveLength(1);
  });
  it("keeps different content and partial overlaps in normal reconciliation, and does not mark incomplete imports successful", async () => {
    const client = createSqliteHttpClient(dispatch);
    const partial = await client.prepareTradeChanges(intent({ ...identity, complete: false }));
    const partialReceipt = await client.commitTradeChanges({ requestId: "partial", planId: partial.planId, choices: {} });
    expect(partialReceipt.result).not.toHaveProperty("importedFile");
    const complete = await client.prepareTradeChanges(intent());
    await client.commitTradeChanges({ requestId: "complete", planId: complete.planId, choices: {} });
    const newFact = { ...fact, id: "exact-file-E1", executedAt: "2026-10-02", source: { ...fact.source, row: 2 } };
    const other = await client.prepareTradeChanges(intent({ ...identity, sha256: "b".repeat(64) }, [fact, newFact]));
    expect(other.summary.importDuplicates?.count).toBe(1);
    expect(other.summary.changes.filter(change => change.kind === "add")).toHaveLength(1);
  });
  it("uses legacy statement evidence only to report all existing trades, without claiming byte identity", async () => {
    const client = createSqliteHttpClient(dispatch);
    const old = { ...fact, source: { ...fact.source, platform: "futu", formatRuleId: "futu/pdf/f0-contract-date@1" } };
    const seed = await client.prepareTradeChanges({ kind: "import", candidates: [old] });
    await client.commitTradeChanges({ requestId: "old", planId: seed.planId, choices: {} });
    await expect(client.prepareTradeChanges({ kind: "import", candidates: [old] })).rejects.toMatchObject({ code: "FILE_TRADES_ALREADY_EXIST", status: 409 });
    const renamed = { ...old, source: { ...old.source, fileName: "renamed.pdf" } };
    await expect(client.prepareTradeChanges(intent(identity, [renamed]))).rejects.toMatchObject({ code: "FILE_TRADES_ALREADY_EXIST" });
    const newFact = { ...old, id: "exact-file-E1", executedAt: "2026-10-02", source: { ...old.source, row: 2 } };
    const overlap = await client.prepareTradeChanges({ kind: "import", candidates: [old, newFact] });
    expect(overlap.summary.changes.some(change => change.kind === "add")).toBe(true);
    await client.prepareTradeChanges({ kind: "import", candidates: [{ ...old, source: { ...old.source, fileFingerprint: "abcdef1234567890" } }] });
    await client.prepareTradeChanges({ kind: "import", candidates: [{ ...old, source: { ...old.source, formatRuleId: "manual/verified-ipo-allotment@1" } }] });
  });
  it("preserves an explicit legacy material revision even when all its trades already exist", async () => {
    const client = createSqliteHttpClient(dispatch);
    const old = { ...fact, source: { ...fact.source, platform: "futu", formatRuleId: "futu/pdf/f0-contract-date@1" } };
    const material: MaterialVersionInput = { materialId: "M", versionId: "V1", parserVersion: "fixture", sourceKind: "statement", recordedAt: "2026-10-01T00:00:00Z", fileFingerprint: old.source.fileFingerprint, locator: {}, scope: { accounts: { values: ["A"], unknown: false }, markets: { values: [], unknown: true }, instruments: { values: [], unknown: true }, periods: { values: [], unknown: true } }, diagnostics: [], content: {}, observations: [{ id: "O1", locator: {}, raw: {}, originalAccountId: "A", executionIds: [old.id], linkReason: "fixture" }] };
    const seed = await client.prepareTradeChanges({ kind: "import", candidates: [old], materials: [material] });
    await client.commitTradeChanges({ requestId: "material-first", planId: seed.planId, choices: {} });
    const revision = await client.prepareTradeChanges({ kind: "import", candidates: [old], materials: [{ ...material, versionId: "V2", observations: [{ ...material.observations[0], id: "O2" }] }] });
    expect(revision.summary.changes.some(change => change.kind === "material-version")).toBe(true);
    await client.commitTradeChanges({ requestId: "material-second", planId: revision.planId, choices: {} });
    expect(db.prepare("select count(*) n from source_material_versions").get()).toMatchObject({ n: 2 });
    expect((await client.readTradeBook()).facts).toHaveLength(1);
  });
  it("keeps incomplete legacy material reports and multiple source files reviewable", async () => {
    const client = createSqliteHttpClient(dispatch);
    const old = { ...fact, source: { ...fact.source, platform: "futu", formatRuleId: "futu/pdf/f0-contract-date@1" } };
    const other = { ...old, id: "other-file-E0", executedAt: "2026-10-02", source: { ...old.source, fileFingerprint: "abcdef1234567890" } };
    const seed = await client.prepareTradeChanges({ kind: "import", candidates: [old, other] });
    await client.commitTradeChanges({ requestId: "old-files", planId: seed.planId, choices: {} });
    const multiple = await client.prepareTradeChanges({ kind: "import", candidates: [old, other] });
    expect(multiple.summary.importDuplicates?.count).toBe(2);
    const material: MaterialVersionInput = { materialId: "partial-M", versionId: "partial-V1", parserVersion: "fixture", sourceKind: "statement", recordedAt: "2026-10-01T00:00:00Z", fileFingerprint: old.source.fileFingerprint, locator: {}, scope: { accounts: { values: ["A"], unknown: false }, markets: { values: [], unknown: true }, instruments: { values: [], unknown: true }, periods: { values: [], unknown: true } }, diagnostics: [], content: {}, observations: [{ id: "partial-O1", locator: {}, raw: {}, originalAccountId: "A", executionIds: [old.id], linkReason: "fixture" }], historyProjection: { batchId: "partial-history", reconciliation: { id: "partial-history", fileName: "partial.pdf", sourceLabel: "富途", importedAt: "2026-10-01T00:00:00Z", tradeCount: 1, instrumentCount: 1, unresolvedInstrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0 } } };
    await expect(client.prepareTradeChanges({ kind: "import", candidates: [old], materials: [material] })).resolves.toBeDefined();
    const preparedPartial = await client.prepareTradeChanges({ kind: "import", candidates: [old], materials: [material], fileImport: identity });
    expect(preparedPartial.summary.importDuplicates?.count).toBe(1);
    const saved = await client.commitTradeChanges({ requestId: "partial-material", planId: preparedPartial.planId, choices: {} });
    expect(saved.result).not.toHaveProperty("importedFile");
    expect((await client.readTradeBook()).facts).toHaveLength(2);
  });

  it("allows another review after the user retained an existing conflicted trade", async () => {
    const client = createSqliteHttpClient(dispatch);
    const seed = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    await client.commitTradeChanges({ requestId: "conflict-seed", planId: seed.planId, choices: {} });
    const conflicted = intent(identity, [{ ...fact, price: "999" }]);
    const plan = await client.prepareTradeChanges(conflicted);
    expect(plan.conflicts).toHaveLength(1);
    const saved = await client.commitTradeChanges({ requestId: "retain-old", planId: plan.planId, choices: { conflicts: plan.conflicts.map(conflict => ({ conflictId: conflict.id, decision: "keep-existing" })) } });
    expect(saved.result).not.toHaveProperty("importedFile");
    await client.prepareTradeChanges(conflicted);
    expect((await client.readTradeBook()).facts[0].price).toBe(fact.price);
  });


  it("records complete ordinary statements containing recognized non-trade exclusions", async () => {
    const client = createSqliteHttpClient(dispatch);
    const pages = CHINA_MERCHANTS_POSITION_EVIDENCE.map(page => page.pageNumber === 2 ? { ...page, items: [...page.items, ...CHINA_MERCHANTS_PAGES[1].items.filter(item => item.y >= 324 && item.y !== 396)] } : page);
    const preview = await statementPreview(pages);
    expect(preview.exclusionGroups.length).toBeGreaterThan(0);
    expect(preview.monthly?.incompleteInstruments ?? []).toEqual([]);
    expect(preview.monthly?.historyIncomplete).not.toBe(true);
    const plan = await client.prepareTradeChanges(monthlyImportIntent(preview, null, "mixed-V", "2026-10-01T00:00:00Z"));
    const saved = await client.commitTradeChanges({ requestId: "mixed", planId: plan.planId, choices: {} });
    expect(saved.result.importedFile).toEqual(preview.fileContent);
    db.close(); db = original.openSqliteDatabase(path);
    await expect(client.prepareTradeChanges(monthlyImportIntent({ ...preview, fileName: "renamed.pdf" }, null, "mixed-V2", "2026-10-02T00:00:00Z"))).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
  });

  it.each(["incompleteInstruments", "historyIncomplete"] as const)("preserves retry when monthly %s is pending despite optimistic counts and complete", async gap => {
    const client = createSqliteHttpClient(dispatch);
    const preview = await statementPreview(CHINA_MERCHANTS_MISSING_SECURITY_BALANCE);
    expect(preview.exclusionGroups).toEqual([]);
    if (gap === "historyIncomplete") preview.monthly = { ...preview.monthly!, incompleteInstruments: [], historyIncomplete: true };
    expect(importIntentForPreview(preview).fileImport?.complete).toBe(false);
    const input = monthlyImportIntent(preview, null, `gap-${gap}`, "2026-10-01T00:00:00Z");
    input.fileImport!.complete = true; // Server must inspect retained raw monthly evidence.
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: gap, planId: plan.planId, choices: {} });
    expect(saved.result).not.toHaveProperty("importedFile");
    await expect(client.prepareTradeChanges(monthlyImportIntent(preview, null, `gap-${gap}-retry`, "2026-10-02T00:00:00Z"))).resolves.toBeDefined();
  });

  it("keeps unknown parser exclusions pending when aggregate history counts are zeroed", async () => {
    const client = createSqliteHttpClient(dispatch);
    const pages = CHINA_MERCHANTS_POSITION_EVIDENCE.map(page => page.pageNumber === 2 ? { ...page, items: [...page.items, ...CHINA_MERCHANTS_PAGES[1].items.filter(item => item.y === 360).map(item => item.text === "利息归本" ? { ...item, text: "未知业务" } : item)] } : page);
    const preview = await statementPreview(pages);
    expect(preview.exclusionGroups).toEqual(expect.arrayContaining([expect.objectContaining({ category: "invalid-row" })]));
    const input = importIntentForPreview(preview);
    input.fileImport!.complete = true;
    input.importHistory = input.importHistory!.map(row => ({ ...row, excludedInstrumentCount: 0, excludedRecordCount: 0 }));
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: "unknown-excluded", planId: plan.planId, choices: {} });
    expect(saved.result).not.toHaveProperty("importedFile");
    await expect(client.prepareTradeChanges(input)).resolves.toBeDefined();
  });

  it("records a complete no-trade monthly material but never an empty material-free import", async () => {
    const client = createSqliteHttpClient(dispatch);
    const pages = CHINA_MERCHANTS_PAGES.map(page => ({ ...page, items: page.items.filter(item => item.y < 200 || item.y >= 306) }));
    const preview = await statementPreview(pages);
    expect(preview.records).toHaveLength(0);
    expect(preview.monthly).toBeDefined();
    const empty = await client.prepareTradeChanges(importIntentForPreview(preview));
    const noMaterial = await client.commitTradeChanges({ requestId: "empty", planId: empty.planId, choices: {} });
    expect(noMaterial.result).not.toHaveProperty("importedFile");
    const plan = await client.prepareTradeChanges(monthlyImportIntent(preview, null, "only-material", "2026-10-01T00:00:00Z"));
    const saved = await client.commitTradeChanges({ requestId: "no-trades", planId: plan.planId, choices: {} });
    expect(saved.result.importedFile).toEqual(preview.fileContent);
    db.close(); db = original.openSqliteDatabase(path);
    expect(db.prepare("select count(*) n from source_material_versions where id='only-material'").get()).toMatchObject({ n: 1 });
    await expect(client.prepareTradeChanges(monthlyImportIntent({ ...preview, fileName: "renamed.pdf" }, null, "another-material", "2026-10-02T00:00:00Z"))).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
  });

  it("blocks a legacy ordinary XLSX with its automatic history adapter while preserving explicit revisions", async () => {
    const client = createSqliteHttpClient(dispatch);
    const old = { ...fact, source: { ...fact.source, platform: "futu", formatRuleId: "futu/xlsx/trades-v1", batchId: `import:${fact.source.fileFingerprint}` } };
    const input: Extract<StandardTradeChangeIntent, { kind: "import" }> = { kind: "import", candidates: [old], importHistory: [{ id: old.source.batchId, fileName: "old.xlsx", sourceLabel: "富途", importedAt: "2026-10-01T00:00:00Z", tradeCount: 1, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0 }] };
    const seed = await client.prepareTradeChanges(input);
    await client.commitTradeChanges({ requestId: "old-xlsx", planId: seed.planId, choices: {} });
    await expect(client.prepareTradeChanges({ ...input, fileImport: identity })).rejects.toMatchObject({ code: "FILE_TRADES_ALREADY_EXIST" });
  });

  it("carries original-byte identity through local parsing, metadata, preview and HTTP, including a renamed file", async () => {
    const client = createSqliteHttpClient(dispatch);
    const file = fileFor(), parsed = await parseBrokerStatement(file);
    if (parsed.broker === "unknown") throw new Error("fixture must parse");
    const enriched = await enrichStatementImport(parsed, { resolver: async () => ({ resolved: new Map([["CN-SH:600330", { market: "CN-SH", symbol: "600330", name: "天通股份", assetType: "stock", source: "tencent", confidence: "portal", resolvedAt: "2026-09-07T00:00:00Z" }]]), unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve() }) });
    const preview = createImportPreview(file.name, enriched);
    const incomplete = { ...preview, exclusionGroups: [{ category: "invalid-row" as const, label: "未解析成交", count: 1 }] };
    expect(importIntentForPreview(incomplete).fileImport?.complete).toBe(false);
    const plan = await client.prepareTradeChanges(importIntentForPreview(preview));
    const saved = await client.commitTradeChanges({ requestId: "parsed", planId: plan.planId, choices: {} });
    expect(saved.result.importedFile).toEqual(parsed.fileContent);
    const renamed = { ...preview, fileName: "改名_SSE_600330.csv" };
    await expect(client.prepareTradeChanges(importIntentForPreview(renamed))).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
    expect((await client.readTradeBook()).facts).toHaveLength(2);
  });
});
