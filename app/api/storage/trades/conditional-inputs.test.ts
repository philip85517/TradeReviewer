import { webcrypto } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { extractPdfPages } from "../../../lib/import/pdf-text";
import { parseFutuPdfPages } from "../../../lib/import/futu-pdf";
import { fingerprintBytes } from "../../../lib/import/file-fingerprint";
import { createImportPreview } from "../../../lib/import/import-preview";
import { monthlyImportIntent, importMaterialOptions } from "../../../components/import/trade-import-material";
vi.mock("../../../../db/sqlite", async original => ({ ...await original<typeof import("../../../../db/sqlite")>(), openSqliteDatabase: vi.fn() }));
import { openSqliteDatabase } from "../../../../db/sqlite";
import { createSqliteHttpClient } from "../../../lib/storage/sqlite-http-client";
import { POST as prepare } from "./plans/route";
import { POST as commit } from "./commit/route";
import { POST as read } from "./read/route";

class FileBinaryDataFactory {
  constructor(private urls: Record<string, string | null | undefined>) {}
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    return new Uint8Array(await readFile(new URL(filename, this.urls[kind]!)));
  }
}
const fixtureDirectory = join(process.cwd(), ".scratch/database-b-development-2026-10-26/evidence/task-7/fixtures");
async function preview(name: string, trailingComment = "") {
  const originalBytes = await readFile(join(fixtureDirectory, name));
  const bytes = new Uint8Array(Buffer.concat([originalBytes, Buffer.from(trailingComment)]));
  const fileFingerprint = fingerprintBytes(bytes);
  const pages = await extractPdfPages(bytes.buffer, { staticAssetBaseUrl: pathToFileURL(`${join(process.cwd(), "public")}/`).href, pdfjsLoader: () => import("pdfjs-dist/legacy/build/pdf.mjs"), binaryDataFactory: FileBinaryDataFactory });
  const parsed = parseFutuPdfPages(pages, { fileName: name, fileFingerprint });
  expect(parsed.blocked, JSON.stringify(parsed.diagnostics)).toBe(false);
  expect(parsed.records.length).toBeGreaterThan(0);
  return createImportPreview(name, { ...parsed, importable: parsed.records, unresolved: [], cacheHits: 0 });
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("uses real parsed PDF evidence, explicitly versions a selected material, withdraws and restores the original fact", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const original = await vi.importActual<typeof import("../../../../db/sqlite")>("../../../../db/sqlite");
  const directory = await mkdtemp(join(tmpdir(), "monthly-input-"));
  const path = join(directory, "isolated.sqlite");
  let db = original.openSqliteDatabase(path);
  vi.mocked(openSqliteDatabase).mockImplementation(() => db);
  const client = createSqliteHttpClient(async (url, init) => {
    const req = new Request(`http://localhost${url}`, init);
    if (url.endsWith("/plans")) return prepare(req);
    if (url.endsWith("/commit")) return commit(req);
    if (url.endsWith("/read")) return read(req);
    throw new Error(url);
  });
  try {
    const complete = await preview("monthly-01-complete.pdf");
    const missing = await preview("monthly-02-missing.pdf");
    expect(complete.records).toHaveLength(2); expect(missing.records).toHaveLength(1);
    expect(complete.monthly?.documentId).not.toBe(missing.monthly?.documentId);
    expect(complete.monthly?.accountId).toBe(missing.monthly?.accountId);
    const first = await client.prepareTradeChanges(monthlyImportIntent(complete, null, "version-1", "2026-10-26T00:00:00Z"));
    await client.commitTradeChanges({ requestId: "first", planId: first.planId, choices: {} });
    const book = await client.readTradeBook();
    const options = importMaterialOptions(book);
    expect(options).toHaveLength(1);
    expect(options[0].label).toContain("monthly-01-complete.pdf");
    const independent = await client.prepareTradeChanges(monthlyImportIntent(missing, null, "version-independent", "2026-10-26T00:00:01Z"));
    expect(independent.missingExecutions).toEqual([]);
    const replacement = await client.prepareTradeChanges(monthlyImportIntent(missing, options[0].id, "version-2", "2026-10-26T00:00:02Z", book));
    expect(replacement.missingExecutions.length).toBeGreaterThan(0);
    const executionId = complete.records.find(e => e.side === "sell")!.id;
    expect(replacement.missingExecutions.map(item => item.executionId)).toContain(executionId);
    await client.commitTradeChanges({ requestId: "withdraw", planId: replacement.planId, choices: { conflicts: replacement.conflicts.map(c => ({ conflictId: c.id, decision: "keep-existing" })), missingExecutions: replacement.missingExecutions.map(item => item.executionId === executionId ? { executionId, action: "withdraw", reason: "合成原件已核对，确认撤回" } : { executionId: item.executionId, action: "keep" }) } });
    const withdrawn = await client.readTradeBook();
    expect(withdrawn.executions).toHaveLength(1);
    const originalVersion = structuredClone(withdrawn.pages[0].snapshot.materialHistory[0].versions.find(v => v.id === "version-1"));
    const restoreIntent = monthlyImportIntent(complete, options[0].id, "version-3", "2026-10-26T00:00:03Z", withdrawn);
    const restore = await client.prepareTradeChanges(restoreIntent);
    expect(restore.reactivateExecutionIds).toEqual([executionId]);
    const receipt = await client.commitTradeChanges({ requestId: "restore", planId: restore.planId, choices: { reactivateExecutions: [{ executionId, action: "activate", reason: "重读同一原文件后确认恢复" }] } });
    db.close(); db = original.openSqliteDatabase(path);
    const final = await client.readTradeBook({ version: { exact: receipt.bookVersion } });
    expect(final.executions).toHaveLength(2);
    expect(final.pages[0].snapshot.materialHistory[0].versions).toHaveLength(3);
    expect(final.pages[0].snapshot.materialHistory[0].versions[0].fileFingerprint).toBe(complete.records[0].source.fileFingerprint);
    expect(final.pages[0].snapshot.materialHistory[0].versions.find(v => v.id === "version-1")).toEqual(originalVersion);
    expect(final.importHistory).toHaveLength(2); // compatibility batches; all three formal versions remain above
    expect(restoreIntent.materials![0].historyProjection?.batchId).toBe("import-attempt:version-1");
  } finally { db.close(); await rm(directory, { recursive: true, force: true }); }
}, 20_000);

it("blocks an identical legacy file, preserves independent evidence from different bytes, then versions it", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const original = await vi.importActual<typeof import("../../../../db/sqlite")>("../../../../db/sqlite");
  const directory = await mkdtemp(join(tmpdir(), "monthly-independent-"));
  const path = join(directory, "isolated.sqlite");
  let db = original.openSqliteDatabase(path);
  vi.mocked(openSqliteDatabase).mockImplementation(() => db);
  const client = createSqliteHttpClient(async (url, init) => {
    const req = new Request(`http://localhost${url}`, init);
    if (url.endsWith("/plans")) return prepare(req);
    if (url.endsWith("/commit")) return commit(req);
    if (url.endsWith("/read")) return read(req);
    throw new Error(url);
  });
  try {
    const complete = await preview("monthly-01-complete.pdf");
    const conflict = await preview("monthly-04-conflict.pdf");
    const seed = await client.prepareTradeChanges(monthlyImportIntent(complete, null, "original-v1", "2026-10-26T00:00:00Z"));
    await client.commitTradeChanges({ requestId: "original", planId: seed.planId, choices: {} });
    const before = await client.readTradeBook();
    const originalMaterial = structuredClone(before.pages[0].snapshot.materialHistory[0]);
    await expect(client.prepareTradeChanges(monthlyImportIntent(complete, null, "blocked-v1", "2026-10-26T00:00:01Z", before))).rejects.toMatchObject({ code: "FILE_TRADES_ALREADY_EXIST" });
    const distinct = await preview("monthly-01-complete.pdf", "\n% separately issued evidence copy\n");
    const duplicateIntent = monthlyImportIntent(distinct, null, "independent-v1", "2026-10-26T00:00:01Z", before);
    const duplicate = await client.prepareTradeChanges(duplicateIntent);
    expect(duplicate.missingExecutions).toEqual([]);
    const independentReceipt = await client.commitTradeChanges({ requestId: "independent", planId: duplicate.planId, choices: { conflicts: duplicate.conflicts.map(conflict => ({ conflictId: conflict.id, decision: "keep-existing" })) } });
    db.close(); db = original.openSqliteDatabase(path);
    const independentBook = await client.readTradeBook({ version: { exact: independentReceipt.bookVersion } });
    expect(independentBook.pages[0].snapshot.materialHistory.find(m => m.id === originalMaterial.id)).toEqual(originalMaterial);
    expect(independentBook.pages[0].snapshot.materialHistory).toHaveLength(2);
    expect(independentBook.importHistory).toHaveLength(2);
    expect(independentBook.executions).toHaveLength(2);
    expect(duplicateIntent.materials![0].historyProjection?.batchId).toBe("import-attempt:independent-v1");
    expect(duplicateIntent.materials![0].content.existingFileDisplayReference).toBeUndefined();
    expect(duplicateIntent.candidates.every(e => e.source.batchId === "import-attempt:independent-v1")).toBe(true);
    const replacement = await client.prepareTradeChanges(monthlyImportIntent(conflict, "material:independent-v1", "independent-v2", "2026-10-26T00:00:02Z", independentBook));
    expect(replacement.conflicts.length).toBeGreaterThan(0);
    const receipt = await client.commitTradeChanges({ requestId: "independent-replace", planId: replacement.planId, choices: { conflicts: replacement.conflicts.map(c => ({ conflictId: c.id, decision: "keep-existing" })), missingExecutions: replacement.missingExecutions.map(m => ({ executionId: m.executionId, action: "keep" })) } });
    db.close(); db = original.openSqliteDatabase(path);
    const final = await client.readTradeBook({ version: { exact: receipt.bookVersion } });
    expect(final.pages[0].snapshot.materialHistory.find(m => m.id === originalMaterial.id)).toEqual(originalMaterial);
    const independent = final.pages[0].snapshot.materialHistory.find(m => m.id === "material:independent-v1")!;
    expect(independent.versions).toHaveLength(2);
    expect(independent.versions.find(v => v.id === "independent-v1")?.observations).toHaveLength(2);
    expect(final.importHistory).toHaveLength(3);
  } finally { db.close(); await rm(directory, { recursive: true, force: true }); }
}, 20_000);
