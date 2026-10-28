import { webcrypto } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import * as XLSX from "xlsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openSqliteDatabase } from "../../../../db/sqlite";
import { monthlyImportIntent } from "../../../components/import/trade-import-material";
import { importIntentForPreview } from "../../../components/import/trade-import-plan";
import { legacyPages } from "../../../lib/import/__fixtures__/tiger-legacy-pages";
import type { ImportExclusion } from "../../../lib/import/contracts";
import { parseBrokerStatement } from "../../../lib/import/dispatcher";
import { enrichStatementImport } from "../../../lib/import/enrich-import";
import { completionHasPendingEvidence } from "../../../lib/import/import-completion";
import { createImportPreview, type ImportPreview } from "../../../lib/import/import-preview";
import type { PdfTextPage } from "../../../lib/import/pdf-text";
import { canonicalInstrumentId } from "../../../lib/instruments/display-name";
import { createSqliteHttpClient } from "../../../lib/storage/sqlite-http-client";
import { POST as commit } from "./commit/route";
import { POST as prepare } from "./plans/route";
import { POST as read } from "./read/route";
import { GET as receipt } from "./receipts/route";

type Broker = "futu" | "tiger";
type Fixture = { broker: Broker; name: string; bytes: ArrayBuffer; pages?: PdfTextPage[]; ruleId: string; tradeCount: number };

function fixtureFor(broker: Broker): Fixture {
  if (broker === "tiger") {
    const pages = legacyPages();
    const fund = legacyPages()[0];
    fund.pageNumber = 2;
    // Reuse the existing parser test's fund-table classification with the same layout.
    fund.items = fund.items.map(item => item.text === "股票" ? { ...item, text: "基金" } : item);
    pages.push(fund);
    return {
      broker, name: "tiger-with-fund.pdf", pages, tradeCount: 1,
      // This exercises the production parser from extracted PDF text, not PDF decoding.
      bytes: new TextEncoder().encode(`%PDF-1.7\nfixture:${JSON.stringify(pages)}`).buffer,
      ruleId: "tiger/pdf/fund-section@1",
    };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["成交时间", "账户名称", "账户号码", "品类", "代码名称", "交易所/市场", "方向", "交收日期", "币种", "数量/面值", "价格", "成交金额", "总费用", "变动金额"],
    ["2025-03-13 00:38:57", "测试美股账户", "SYNTH0855", "证券", "BABA", "US", "买入开仓", "20250313", "USD", "20", "137.65", "-2753", "2.05", "-2755.05"],
    ["2025-04-11 15:00:00", "测试基金账户", "SYNTH0955", "基金", "880022", "FD", "赎回", "-", "USD", "-8.127779", "11.33309", "92.11285091", "0", "92.11285091"],
  ]), "证券-交易流水");
  return {
    broker, name: "futu-with-fund.xlsx", tradeCount: 1,
    bytes: XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    ruleId: "futu/xlsx/non-security/fund@1",
  };
}

async function previewFor(fixture: Fixture, name = fixture.name) {
  const parsed = await parseBrokerStatement({ name, arrayBuffer: async () => fixture.bytes }, {
    sourceTimezone: "Asia/Shanghai",
    ...(fixture.pages ? { extractPdfPages: async () => structuredClone(fixture.pages!) } : {}),
  });
  if (parsed.broker === "unknown") throw new Error("Fixture must match its real parser");
  expect(parsed.broker).toBe(fixture.broker);
  expect(parsed.blocked, JSON.stringify(parsed.diagnostics)).toBe(false);
  expect(parsed.records).toHaveLength(fixture.tradeCount);
  expect(parsed.exclusions).toEqual([expect.objectContaining({
    category: "fund", count: 1, disposition: "ignored", ruleId: fixture.ruleId,
  })]);
  const enriched = await enrichStatementImport(parsed, {
    // Keep optional metadata lookup local; the dispatcher, parser and enrichment are real.
    resolver: async lookups => ({
      resolved: new Map(lookups.map(lookup => [canonicalInstrumentId(lookup.symbol, lookup.market), {
        ...lookup, name: `Synthetic ${lookup.symbol}`, assetType: lookup.symbol === "SPY" ? "etf" as const : "stock" as const,
        source: "tencent" as const, confidence: "portal" as const, resolvedAt: "2026-10-01T00:00:00Z",
      }])),
      unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve(),
    }),
  });
  const preview = createImportPreview(name, enriched);
  expect(preview.records).toHaveLength(fixture.tradeCount);
  expect(preview.unresolvedInstrumentCount).toBe(0);
  expect(preview.completionEvidence?.exclusions).toEqual(parsed.exclusions);
  expect(preview.fileContent).toEqual({ sha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: fixture.bytes.byteLength });
  expect(importIntentForPreview(preview).fileImport?.complete).toBe(true);
  return preview;
}

function reviewedIntent(preview: ImportPreview, attempt: "first" | "retry") {
  const recordedAt = attempt === "first" ? "2026-10-01T00:00:00Z" : "2026-10-02T00:00:00Z";
  if (preview.monthly) return monthlyImportIntent(preview, null, `${preview.id}:${attempt}`, recordedAt);
  const input = importIntentForPreview(preview);
  return { ...input, importHistory: input.importHistory?.map(row => ({ ...row, importedAt: recordedAt })) };
}

async function dispatch(input: string, init?: RequestInit) {
  // The client serializes normally; Request/Response routes run in memory without fetch/listening sockets.
  const request = new Request(`http://memory.invalid${input}`, init);
  if (input === "/api/storage/trades/plans") return prepare(request);
  if (input === "/api/storage/trades/commit") return commit(request);
  if (input === "/api/storage/trades/read") return read(request);
  if (input.startsWith("/api/storage/trades/receipts?")) return receipt(request);
  throw new Error(`Unexpected in-memory route: ${input}`);
}

let directory: string;
let database: DatabaseSync;
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  const isolatedRoot = resolve(".scratch/import-exact-file-block-2026-10-27/evidence/futu-tiger-tests-2026-10-28/tmp");
  mkdirSync(isolatedRoot, { recursive: true });
  directory = mkdtempSync(join(isolatedRoot, "case-"));
  vi.stubEnv("TMPDIR", directory);
  vi.stubEnv("TRADEREVIEW_DB_PATH", join(directory, "isolated.sqlite"));
  // Bind the real route opener through explicit configuration, without mocking SQLite.
  database = openSqliteDatabase();
});
afterEach(() => {
  if (database?.isOpen) database.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function reopen() {
  database.close();
  database = openSqliteDatabase();
}

describe("Futu/Tiger parser-proven exclusions through prepare, commit and reopen", () => {
  it.each(["futu", "tiger"] as const)("records a complete %s file with a legitimately ignored fund and blocks its renamed bytes after reopen", async broker => {
    const fixture = fixtureFor(broker);
    const preview = await previewFor(fixture);
    const client = createSqliteHttpClient(dispatch);
    const input = reviewedIntent(preview, "first");
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: `complete-${broker}`, planId: plan.planId, choices: {} });
    expect(saved.result.importedFile).toEqual(preview.fileContent);
    reopen();
    expect((await client.getTradeCommit(`complete-${broker}`))?.result.importedFile).toEqual(preview.fileContent);
    const persisted = await client.readTradeBook();
    expect(persisted.facts).toHaveLength(fixture.tradeCount);
    expect(database.prepare("select count(*) n from source_material_versions").get()).toMatchObject({ n: 1 });
    const renamed = await previewFor(fixture, `renamed-${fixture.name}`);
    expect(renamed.fileContent).toEqual(preview.fileContent);
    await expect(client.prepareTradeChanges(reviewedIntent(renamed, "retry"))).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED", status: 409 });
    const unchanged = await client.readTradeBook();
    expect(unchanged.facts).toEqual(persisted.facts);
    expect(unchanged.bookVersion).toEqual(persisted.bookVersion);
    expect(database.prepare("select count(*) n from trade_change_receipts").get()).toMatchObject({ n: 1 });
    expect(database.prepare("select count(*) n from source_material_versions").get()).toMatchObject({ n: 1 });
  });

  it.each([
    { broker: "futu", name: "unrecognized rule", change: { ruleId: "futu/xlsx/non-security/fund@999" } },
    { broker: "futu", name: "rule broker mismatch", change: { ruleId: "tiger/pdf/fund-section@1" } },
    { broker: "tiger", name: "rule category mismatch", change: { category: "cash" } },
  ] satisfies { broker: Broker; name: string; change: Partial<ImportExclusion> }[])("keeps a real $broker import retryable for $name despite an optimistic complete flag", async ({ broker, name, change }) => {
    const fixture = fixtureFor(broker);
    const preview = await previewFor(fixture);
    const changed = (value: ImportPreview): ImportPreview => {
      if (!value.completionEvidence) throw new Error("Parser completion evidence is required");
      return { ...value, completionEvidence: {
        ...value.completionEvidence,
        exclusions: value.completionEvidence.exclusions.map(exclusion => ({ ...exclusion, ...change })),
      } };
    };
    const tampered = changed(preview);
    expect(tampered.completionEvidence?.broker).toBe(broker);
    expect(tampered.records.every(record => record.source.platform === broker)).toBe(true);
    expect(completionHasPendingEvidence(tampered.completionEvidence!)).toBe(true);
    const input = reviewedIntent(tampered, "first");
    expect(input.fileImport?.complete).toBe(false);
    // Counts stay consistent, so a different guard cannot mask the evidence mismatch.
    expect(input.fileImport?.evidence?.exclusions.reduce((sum, item) => sum + item.count, 0)).toBe(1);
    const reports = input.importHistory ?? input.materials?.flatMap(material => material.historyProjection ? [material.historyProjection.reconciliation] : []);
    expect(reports).toEqual([expect.objectContaining({ excludedInstrumentCount: 1, excludedRecordCount: 1, unresolvedInstrumentCount: 0 })]);
    input.fileImport!.complete = true;
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: name, planId: plan.planId, choices: {} });
    expect(saved.result).not.toHaveProperty("importedFile");
    reopen();
    expect(await client.getTradeCommit(name)).toMatchObject({ result: saved.result });
    const persisted = await client.readTradeBook();
    expect(persisted.facts).toHaveLength(fixture.tradeCount);
    const renamed = await previewFor(fixture, `renamed-${fixture.name}`);
    expect(renamed.fileContent).toEqual(preview.fileContent);
    await expect(client.prepareTradeChanges(reviewedIntent(changed(renamed), "retry"))).resolves.toMatchObject({ status: "ready" });
    const unchanged = await client.readTradeBook();
    expect(unchanged.facts).toEqual(persisted.facts);
    expect(unchanged.bookVersion).toEqual(persisted.bookVersion);
    expect(database.prepare("select count(*) n from trade_change_receipts").get()).toMatchObject({ n: 1 });
    expect(database.prepare("select count(*) n from source_material_versions").get()).toMatchObject({ n: 1 });
  });
});
