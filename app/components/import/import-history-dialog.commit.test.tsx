import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { DatabaseSync, backup } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import type { ImportPreview } from "../../lib/import/import-preview";
import type { ImportHistoryEntry } from "../../lib/storage/import-history";
import { readHomepageStoredCollection } from "../../lib/storage/homepage-source-snapshot";
import { readStoredTradeSnapshot } from "../../lib/storage/stored-trade-snapshot";
import { getSqliteStore } from "../../lib/storage/sqlite-store";
import { createSqliteHttpClient } from "../../lib/storage/sqlite-http-client";
import { readBookVersion } from "../../lib/storage/trade-book-version";
import { createImportHistoryCommitHandler } from "../../api/storage/import-history/commit/handler";
import { createTradeChanges } from "../../lib/storage/trade-changes";
import type { TradeChangeChoices, TradeChangeIntent } from "../../lib/storage/sqlite-contracts";
import type { TradeExecution } from "../../lib/trades/types";
import { ImportHistoryDialog } from "./import-history-dialog";
import { importIntentForPreview } from "./trade-import-plan";

const databases: DatabaseSync[] = [];
const directories: string[] = [];
afterEach(() => {
  cleanup();
  for (const db of databases.splice(0)) if (db.isOpen) db.close();
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
function setup(path = ":memory:") {
  const db = new DatabaseSync(path);
  databases.push(db);
  initializeSqlite(db);
  return { db, changes: createTradeChanges(db) };
}
const execution: TradeExecution = {
  id: "fill-1", accountId: "A", accountLabel: "账户 A",
  instrument: { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" },
  side: "buy", quantity: "1", price: "123.45", fee: "0", executedAt: "2026-10-01",
  source: { platform: "broker", row: 1, fileFingerprint: "same-file" },
};
function preview(id: string, records = [execution], duplicateTradeCount = 0): ImportPreview {
  return {
    id, fileName: `${id}.csv`, sourceLabel: "测试导入", sourceKind: "screenshot",
    records, instruments: [], unresolved: [], exclusionGroups: [], tradeCount: records.length,
    instrumentCount: 1, duplicateTradeCount, unresolvedInstrumentCount: 0,
    excludedInstrumentCount: 0, blocked: false,
  };
}
function commit(fixture: ReturnType<typeof setup>, intent: TradeChangeIntent, requestId: string, choices: TradeChangeChoices = {}) {
  const plan = fixture.changes.prepare(intent);
  return { plan, receipt: fixture.changes.commit({ requestId, planId: plan.planId, choices }) };
}
function history(db: DatabaseSync) {
  return readHomepageStoredCollection(db).bootstrap.importHistory.map(entry => ({ ...entry, ...getSqliteStore(db).getImportHistoryCommit(entry.id) }));
}
async function renderHistory(entries: ImportHistoryEntry[], db: DatabaseSync) {
  const handler = createImportHistoryCommitHandler(() => db);
  const client = createSqliteHttpClient((url, init) => handler(new Request(`http://local${url}`, init)));
  render(<ImportHistoryDialog entries={entries} onClose={() => {}} loadCommit={(id, signal) => client.readImportHistoryCommit(id, readBookVersion(db), signal)} />);
  await waitFor(() => expect(screen.queryByText(/实际核对重复 核验中/)).not.toBeInTheDocument());
  return within(screen.getByRole("table", { name: "导入批次历史" }));
}

describe("import history formal duplicate result", async () => {
  it.each(["unresolved retry", "repeated statement"])("shows the actual duplicate after %s through reload and selected-history HTTP", async journey => {
    const directory = mkdtempSync(join(tmpdir(), "import-history-public-journey-"));
    directories.push(directory);
    const path = join(directory, "isolated.sqlite"), first = setup(path);
    commit(first, { kind: "import", candidates: [execution] }, "seed");
    const beforeRetry = importIntentForPreview(preview("selected"));
    if (journey === "unresolved retry") first.changes.prepare(beforeRetry);
    const resolved = { ...execution, id: "resolved-fill", instrument: { ...execution.instrument, id: "US:MSFT", symbol: "MSFT", name: "Microsoft" } };
    const nextPreview = preview("selected", journey === "unresolved retry" ? [execution, resolved] : [execution]);
    nextPreview.unresolvedInstrumentCount = journey === "unresolved retry" ? 1 : 0;
    const intent = importIntentForPreview(nextPreview);
    const saved = commit(first, intent, "confirmed");
    expect(saved.receipt.result.report).toEqual({ inserted: journey === "unresolved retry" ? 1 : 0, duplicate: 1, conflict: 0 });
    const second = setup(path);
    const entries = readHomepageStoredCollection(second.db).bootstrap.importHistory;
    const rawBefore = second.db.prepare("select reconciliation_json from import_batches").all();
    expect(entries[0]).toMatchObject({ duplicateTradeCount: 0 });
    expect(entries[0]).not.toHaveProperty("committedDuplicateTradeCount");
    const table = await renderHistory(entries, second.db);
    expect(table.getByRole("cell", { name: "1 / 0" })).toBeInTheDocument();
    expect(screen.getByText(/导入前重复预估 0 笔/)).toBeInTheDocument();
    expect(screen.getByText(/实际核对重复 1 笔/)).toBeInTheDocument();
    expect(second.db.prepare("select reconciliation_json from import_batches").all()).toEqual(rawBefore);
  });
  it("shows the persisted receipt after a reload while preserving the original preview evidence", async () => {
    const directory = mkdtempSync(join(tmpdir(), "import-history-receipt-"));
    directories.push(directory);
    const path = join(directory, "isolated.sqlite"), first = setup(path);
    commit(first, { kind: "import", candidates: [execution] }, "seed");
    const intent = importIntentForPreview(preview("duplicate"));
    const original = structuredClone(intent.kind === "import" ? intent.importHistory![0] : undefined);
    const saved = commit(first, intent, "duplicate");
    expect(saved.receipt.result.report).toEqual({ inserted: 0, duplicate: 1, conflict: 0 });
    const second = setup(path), entries = history(second.db);
    expect(readHomepageStoredCollection(second.db).bootstrap.importHistory[0]).not.toHaveProperty("committedDuplicateTradeCount");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ duplicateTradeCount: 0, committedDuplicateTradeCount: 1 });
    const material = readStoredTradeSnapshot(second.db).materials[0];
    expect(material.version.content.historyProjection).toEqual({ batchId: "duplicate", reconciliation: original });
    expect(second.changes.getCommit("duplicate")).toEqual(saved.receipt);
    const table = await renderHistory(entries, second.db);
    expect(table.getByRole("cell", { name: "1 / 0" })).toBeInTheDocument();
    expect(table.getByRole("cell", { name: "已核对重复" })).toBeInTheDocument();
    expect(screen.getByText(/导入前重复预估 0 笔/)).toBeInTheDocument();
    expect(screen.getByText(/实际核对重复 1 笔/)).toBeInTheDocument();
  });

  it("does not add an overlapping preview estimate to formal duplicates or count receipt aliases again", async () => {
    const f = setup();
    const saved = commit(f, importIntentForPreview(preview("same-batch", [execution, execution], 1)), "original");
    expect(saved.receipt.result.report).toEqual({ inserted: 1, duplicate: 1, conflict: 0 });
    expect(f.changes.commit({ requestId: "alias", planId: saved.plan.planId, choices: {} })).toEqual(saved.receipt);
    expect(f.changes.commit({ requestId: "original", planId: saved.plan.planId, choices: {} })).toEqual(saved.receipt);
    const entries = history(f.db);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ duplicateTradeCount: 1, committedDuplicateTradeCount: 1 });
    expect((await renderHistory(entries, f.db)).getByRole("cell", { name: "1 / 0" })).toBeInTheDocument();
  });

  it("keeps separate batch receipts separate and does not treat a conflict decision as a duplicate", async () => {
    const f = setup();
    commit(f, importIntentForPreview(preview("first")), "first");
    commit(f, importIntentForPreview(preview("second")), "second");
    const conflictIntent = importIntentForPreview(preview("conflict", [{ ...execution, price: "130" }]));
    const plan = f.changes.prepare(conflictIntent);
    const receipt = f.changes.commit({ requestId: "conflict", planId: plan.planId, choices: { conflicts: [{ conflictId: plan.conflicts[0].id, decision: "keep-existing" }] } });
    expect(receipt.result.report).toEqual({ inserted: 0, duplicate: 0, conflict: 1 });
    const entries = history(f.db);
    expect(entries.find(entry => entry.id === "first")).toMatchObject({ committedDuplicateTradeCount: 0 });
    expect(entries.find(entry => entry.id === "second")).toMatchObject({ committedDuplicateTradeCount: 1 });
    expect(entries.find(entry => entry.id === "conflict")).toMatchObject({ committedDuplicateTradeCount: 0 });
  });

  it("does not assign an aggregate receipt to multiple import batches", async () => {
    const f = setup();
    const left = importIntentForPreview(preview("left", [execution, execution]));
    const right = importIntentForPreview(preview("right", [{ ...execution, id: "fill-2", executedAt: "2026-10-02" }]));
    if (left.kind !== "import" || right.kind !== "import") throw new Error("Invalid test fixture");
    const saved = commit(f, { kind: "import", candidates: [...left.candidates, ...right.candidates], importHistory: [...left.importHistory!, ...right.importHistory!] }, "combined");
    expect(saved.receipt.result.report.duplicate).toBe(1);
    const entries = history(f.db);
    expect(entries).toHaveLength(2);
    for (const entry of entries) expect(entry).not.toHaveProperty("committedDuplicateTradeCount");
    const table = await renderHistory(entries, f.db);
    expect(table.getByRole("cell", { name: "未知 / 0" })).toBeInTheDocument();
    expect(table.getByRole("cell", { name: "选中后核验 / 0" })).toBeInTheDocument();
  });

  it("keeps a legacy preview estimate as evidence without claiming an actual skip count", async () => {
    const f = setup();
    const intent = importIntentForPreview(preview("legacy", [], 3));
    if (intent.kind !== "import") throw new Error("Invalid test fixture");
    const original = intent.importHistory![0];
    f.db.prepare("insert into import_batches(id,source_name,source_type,imported_at,record_count,reconciliation_json) values(?,?,?,?,?,?)")
      .run(original.id, original.fileName, "screenshot", original.importedAt, original.tradeCount, JSON.stringify(original));
    const entries = history(f.db);
    expect(entries).toEqual([original]);
    expect((await renderHistory(entries, f.db)).getByRole("cell", { name: "未知 / 0" })).toBeInTheDocument();
    expect(screen.getByText(/导入前重复预估 3 笔/)).toBeInTheDocument();
    expect(screen.getByText(/实际核对重复 未知/)).toBeInTheDocument();
    expect(history(f.db)).toEqual([original]);
  });

  it("does not claim a receipt when the candidates have no batch provenance", async () => {
    const f = setup(), intent = importIntentForPreview(preview("unscoped", [execution, execution]));
    if (intent.kind !== "import") throw new Error("Invalid test fixture");
    const saved = commit(f, { ...intent, candidates: [execution, execution] }, "unscoped");
    expect(saved.receipt.result.report.duplicate).toBe(1);
    const entries = history(f.db);
    expect(entries[0]).not.toHaveProperty("committedDuplicateTradeCount");
    expect((await renderHistory(entries, f.db)).getByRole("cell", { name: "未知 / 0" })).toBeInTheDocument();
  });

  it("leaves repeated batch identities unknown when more than one committed plan matches the same evidence", async () => {
    const f = setup(), intent = importIntentForPreview(preview("reused"));
    const first = commit(f, intent, "first"), second = commit(f, intent, "second");
    expect(first.receipt.result.report.duplicate).toBe(0);
    expect(second.receipt.result.report.duplicate).toBe(1);
    const entries = history(f.db);
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty("committedDuplicateTradeCount");
    expect((await renderHistory(entries, f.db)).getByRole("cell", { name: "未知 / 0" })).toBeInTheDocument();
  });

  it("keeps history readable when unrelated retained content has an unsupported history projection", async () => {
    const f = setup(), intent = importIntentForPreview(preview("legacy", [], 3));
    if (intent.kind !== "import") throw new Error("Invalid test fixture");
    const original = intent.importHistory![0];
    f.db.prepare("insert into import_batches(id,source_name,source_type,imported_at,record_count,reconciliation_json) values(?,?,?,?,?,?)")
      .run(original.id, original.fileName, "screenshot", original.importedAt, original.tradeCount, JSON.stringify(original));
    // Seed retained legacy evidence allowed by the database's JSON constraints.
    // The current writer rejects this reserved content shape; no existing evidence is edited.
    f.db.prepare("insert into source_materials(id,created_at) values(?,?)").run("unrelated", "2026-10-27");
    f.db.prepare("insert into source_material_versions(id,material_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,recorded_at) values(?,?,?,?,?,?,?,?,?)")
      .run("unrelated-v1", "unrelated", "unsupported", "statement", "{}", JSON.stringify({ accounts: { values: [], unknown: true }, markets: { values: [], unknown: true }, instruments: { values: [], unknown: true }, periods: { values: [], unknown: true } }), "[]", JSON.stringify({ historyProjection: "{unsupported" }), "2026-10-27");
    f.db.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)")
      .run("unrelated-plan", "trade-changes-v1", "2026-10-27", "2026-10-28", "{}", createHash("sha256").update("{}").digest("hex"));
    const receipt = { receiptId: "unrelated-receipt", planId: "unrelated-plan", policy: "trade-changes-v1", committedAt: "2026-10-27T00:00:00Z", bookVersion: { databaseId: "legacy", epoch: "legacy", sequence: 1 }, result: { report: { inserted: 0, duplicate: 0, conflict: 0 }, appliedChanges: [{ kind: "material-version", materialId: "unrelated", versionId: "unrelated-v1" }] } };
    f.db.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run("unrelated-receipt", "unrelated-plan", JSON.stringify(receipt));
    f.db.prepare("update trade_change_plans set receipt_id=?,choices_digest=? where id=?").run("unrelated-receipt", "legacy", "unrelated-plan");
    expect(history(f.db)).toEqual([original]);
    expect((await renderHistory(history(f.db), f.db)).getByRole("cell", { name: "未知 / 0" })).toBeInTheDocument();
  });

  it("reads current evidence after receipt rollback and rowid reuse, another connection, reopen and backup restoration", async () => {
    const directory = mkdtempSync(join(tmpdir(), "import-history-rollback-"));
    directories.push(directory);
    const path = join(directory, "isolated.sqlite"), restoredPath = join(directory, "restored.sqlite");
    const writer = setup(path), reader = setup(path);
    const saved = commit(writer, importIntentForPreview(preview("first")), "first");
    expect(history(reader.db)[0]).toMatchObject({ id: "first", committedDuplicateTradeCount: 0 });
    const attemptedRowids: number[] = [];
    writer.db.function("capture_receipt_rowid", value => { attemptedRowids.push(Number(value)); return null; });
    writer.db.exec("create trigger fail_receipt after insert on trade_change_receipts begin select capture_receipt_rowid(new.rowid); select raise(abort,'receipt rollback test'); end");
    const plan = writer.changes.prepare(importIntentForPreview(preview("second")));
    expect(() => writer.changes.commit({ requestId: "second", planId: plan.planId, choices: {} })).toThrow();
    expect(history(reader.db)).toHaveLength(1);
    expect(writer.changes.getCommit("first")).toEqual(saved.receipt);
    writer.db.exec("drop trigger fail_receipt");
    const receipt = writer.changes.commit({ requestId: "second", planId: plan.planId, choices: {} });
    expect(writer.db.prepare("select rowid from trade_change_receipts where id=?").get(receipt.receiptId)?.rowid).toBe(attemptedRowids[0]);
    expect(history(reader.db).find(entry => entry.id === "second")).toMatchObject({ committedDuplicateTradeCount: 1 });
    await backup(reader.db, restoredPath);
    reader.db.close();
    const reopened = setup(path);
    expect(history(reopened.db)).toHaveLength(2);
    commit(writer, importIntentForPreview(preview("third")), "third");
    expect(history(reopened.db)).toHaveLength(3);
    reopened.db.close();
    const restored = setup(restoredPath);
    expect(history(restored.db)).toHaveLength(2);
    expect(history(restored.db).find(entry => entry.id === "second")).toMatchObject({ committedDuplicateTradeCount: 1 });
  });
});
