import { webcrypto } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../../../db/sqlite", async original => ({
  ...await original<typeof import("../../../db/sqlite")>(),
  openSqliteDatabase: vi.fn(),
}));
import { openSqliteDatabase } from "../../../db/sqlite";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { POST as prepareRoute } from "../../api/storage/trades/plans/route";
import { POST as commitRoute } from "../../api/storage/trades/commit/route";
import { POST as readRoute } from "../../api/storage/trades/read/route";
import { GET as receiptRoute } from "../../api/storage/trades/receipts/route";
import { SqliteStore } from "../../lib/storage/sqlite-store";
import { readBookVersion } from "../../lib/storage/trade-book-version";
import { createTradeChanges } from "../../lib/storage/trade-changes";
import { createSqliteHttpClient } from "../../lib/storage/sqlite-http-client";
import { submitReviewedTrade } from "../../lib/storage/trade-change-submission";
import type { TradeExecution } from "../../lib/trades/types";
import type { TradeRevisionRequest } from "../../lib/storage/trade-revisions";
import { StockDataDialog, type RevisionReviewContext } from "./stock-data-dialog";

const instrument = { id: "US:I1", symbol: "I1", name: "Unknown fee fixture", market: "US", currency: "USD" };
const original: TradeExecution = {
  id: "historical", instrument, accountId: "I1-A", accountLabel: "I1 synthetic account",
  side: "buy", quantity: "1.0000000000000001", price: "123.456789012345678901",
  fee: "7.2500", executedAt: "2026-10-01T13:30:00.123Z",
  source: { platform: "broker", row: 1, feeStatus: "unknown", timePrecision: "second" },
};
let directory: string, path: string, db: DatabaseSync;
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  directory = mkdtempSync(join(tmpdir(), "tradereview-i1-unknown-fee-"));
  path = join(directory, "synthetic.sqlite");
  db = new DatabaseSync(path);
  initializeSqlite(db);
  vi.mocked(openSqliteDatabase).mockImplementation(() => db);
});
afterEach(() => {
  cleanup();
  if (db.isOpen) db.close();
  rmSync(directory, { recursive: true, force: true });
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
async function dispatch(url: string, init?: RequestInit) {
  const request = new Request(`http://localhost${url}`, init);
  if (url === "/api/storage/trades/plans") return prepareRoute(request);
  if (url === "/api/storage/trades/commit") return commitRoute(request);
  if (url === "/api/storage/trades/read") return readRoute(request);
  if (url.startsWith("/api/storage/trades/receipts?")) return receiptRoute(request);
  throw new Error(`Unexpected route ${url}`);
}
function seed(rawFee: string | null, feeStatus: "unknown" | "reported" = "unknown") {
  const changes = createTradeChanges(db);
  const plan = changes.prepare({ kind: "import", candidates: [{ ...original, source: { ...original.source, feeStatus } }] });
  changes.commit({ requestId: "seed", planId: plan.planId, choices: {} });
  // Create legacy evidence only in a fresh synthetic database. No business DB is opened.
  db.prepare("update executions set fee=? where id=?").run(rawFee, original.id);
  return new SqliteStore(db).getExecutions()[0];
}
function revision(before: TradeExecution, after: TradeExecution | null): TradeRevisionRequest {
  return { id: "quantity-revision", instrumentId: instrument.id, accountId: original.accountId,
    reason: "Only correct quantity; original fee remains unverified", changes: [{ before, after }] };
}
function rawFact() {
  return db.prepare("select quantity,price,executed_at,fee,evidence_json from executions where id=?").get(original.id);
}
async function rawPrepare(intent: unknown) {
  return prepareRoute(new Request("http://localhost/api/storage/trades/plans", { method: "POST", body: JSON.stringify(intent) }));
}

// Break caught: rejecting a legal historical unknown placeholder, replacing its raw NULL
// with display empty text, coercing it to zero, or certifying it during an unrelated edit.
it.each([null, ""])("I1 prepares and persists a quantity-only revision while preserving raw unknown fee %j", async rawFee => {
  seed(rawFee);
  const client = createSqliteHttpClient(dispatch);
  const beforeRead = await client.readTradeBook();
  const before = beforeRead.executions[0];
  expect(before.fee).toBe("");
  expect(before.source.feeStatus).toBe("unknown");
  const plan = await client.prepareTradeChanges({ kind: "revision", revision: revision(before, { ...before, quantity: "2.0000000000000002" }) });
  expect(plan.summary.changes).toContainEqual(expect.objectContaining({ kind: "revise", before: expect.objectContaining({ fee: rawFee }), after: expect.objectContaining({ fee: rawFee, quantity: "2.0000000000000002" }) }));
  const result = await submitReviewedTrade(client, { envelope: { planId: plan.planId, requestId: "I1-commit", choices: {} } });
  expect(result.executions[0]).toMatchObject({ quantity: "2.0000000000000002", fee: "", source: { feeStatus: "unknown" } });
  expect(rawFact()).toMatchObject({ fee: rawFee, quantity: "2.0000000000000002", price: "123.456789012345678901", executed_at: "2026-10-01T13:30:00.123Z" });
  expect(new SqliteStore(db).getTradeRevisions(instrument.id).find(item => item.id === "quantity-revision")?.changes[0]).toMatchObject({
    before: { fee: "", source: { feeStatus: "unknown" } },
    after: { fee: "", source: { feeStatus: "unknown" } },
  });
  db.close();
  db = new DatabaseSync(path);
  initializeSqlite(db);
  const reloaded = await client.readTradeBook({ version: { atLeast: result.bookVersion } });
  expect(reloaded.executions[0]).toMatchObject({ quantity: "2.0000000000000002", fee: "", source: { feeStatus: "unknown" } });
  expect(reloaded.pages[0].snapshot.facts[0].fee).toBe(rawFee);
  expect(rawFact()?.fee).toBe(rawFee);
});

// Break caught: UI rejecting a legal unverified historical placeholder before it
// reaches the real prepare/commit/read path. These are synthetic DOM events, not browser evidence.
it.each([null, ""])("I1 submits an actual review plan from the editor for historical unknown fee %j", async rawFee => {
  seed(rawFee);
  const client = createSqliteHttpClient(dispatch);
  const initial = await client.readTradeBook();
  let saved: Awaited<ReturnType<typeof client.readTradeBook>> | undefined;
  async function revise(_input: TradeRevisionRequest, review?: RevisionReviewContext) {
    if (!review) throw new Error("Reviewed plan required");
    saved = await submitReviewedTrade(client, { envelope: { planId: review.plan.planId, requestId: review.requestId, choices: review.choices } });
  }
  const user = userEvent.setup();
  render(<StockDataDialog instrument={instrument} initialAccountId={original.accountId} executions={initial.executions}
    marketSummary="Synthetic isolated test" marketDetails={[]} refreshing={false} onRefresh={() => {}} onClose={() => {}}
    onRevise={revise} prepareRevision={input => client.prepareTradeChanges({ kind: "revision", revision: input })}
    loadHistory={async () => new SqliteStore(db).getTradeRevisions(instrument.id)} onSupplement={() => {}} retainedReviews={[]} />);
  await user.click(screen.getByRole("button", { name: "编辑成交" }));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("textbox", { name: /费用/ })).toBeDisabled();
  await user.clear(screen.getByLabelText("数量"));
  await user.type(screen.getByLabelText("数量"), "2.0000000000000002");
  await user.type(screen.getByLabelText("修订原因"), "仅修正数量，历史费用仍未知");
  await user.click(screen.getByRole("button", { name: "预览修改" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("确认本次修订")).toBeInTheDocument();
  expect(saved).toBeUndefined();
  await user.click(screen.getByRole("button", { name: "确认保存修订" }));
  expect(await screen.findByText("修订已保存，成交与回合已更新。")).toBeInTheDocument();
  expect(saved?.executions[0]).toMatchObject({ quantity: "2.0000000000000002", fee: "", source: { feeStatus: "unknown" } });
  expect(rawFact()?.fee).toBe(rawFee);
});

// Break caught: extending legacy preservation to brand-new candidates or supplement records.
it.each([null, ""])("I1 rejects a new import with unknown fee %j as HTTP 400 without writes", async fee => {
  const version = readBookVersion(db);
  const response = await rawPrepare({ kind: "import", candidates: [{ ...original, fee }] });
  expect(response.status).toBe(400);
  expect(readBookVersion(db)).toEqual(version);
  expect(new SqliteStore(db).getExecutions()).toEqual([]);
});
it.each([null, ""])("I1 rejects a new supplement with unknown fee %j as HTTP 400 without writes", async fee => {
  seed(null);
  const version = readBookVersion(db);
  const before = rawFact();
  const response = await rawPrepare({ kind: "revision", revision: { id: "new-supplement", instrumentId: instrument.id,
    accountId: original.accountId, reason: "Supplement", changes: [{ before: null, after: { ...original, id: "new", fee } }] } });
  expect(response.status).toBe(400);
  expect(readBookVersion(db)).toEqual(version);
  expect(rawFact()).toEqual(before);
});

// Break caught: a client fabricating an unknown before/after to downgrade reported money.
it.each([null, ""])("I1 rejects reported-fee downgrade to unknown fee %j and preserves the stored fact", async fee => {
  const before = seed("7.2500", "reported");
  const version = readBookVersion(db), raw = rawFact();
  const response = await rawPrepare({ kind: "revision", revision: { ...revision(before, before), changes: [{ before,
    after: { ...before, quantity: "2", fee, source: { ...before.source, feeStatus: "unknown" } } }] } });
  expect(response.status).toBe(400);
  expect(rawFact()).toEqual(raw);
  expect(readBookVersion(db)).toEqual(version);
});
it("I1 rejects a forged unknown before for a stored reported fee", async () => {
  const stored = seed("7.2500", "reported");
  const forged = { ...stored, fee: "", source: { ...stored.source, feeStatus: "unknown" as const } };
  const version = readBookVersion(db), raw = rawFact();
  const response = await rawPrepare({ kind: "revision", revision: revision(forged, { ...forged, quantity: "2" }) });
  // Existing baseline mismatches are typed domain rejections (HTTP 422).
  expect(response.status).toBe(422);
  expect(rawFact()).toEqual(raw);
  expect(readBookVersion(db)).toEqual(version);
});
it("I1 rejects a stale historical before after quantity changed", async () => {
  const before = seed(null);
  db.prepare("update executions set quantity='9' where id=?").run(original.id);
  const version = readBookVersion(db), raw = rawFact();
  const response = await rawPrepare({ kind: "revision", revision: revision(before, { ...before, quantity: "2" }) });
  expect(response.status).toBe(422);
  expect(rawFact()).toEqual(raw);
  expect(readBookVersion(db)).toEqual(version);
});

it.each([null, ""])("I1 permits an explicit reported fee correction of historical unknown fee %j", async rawFee => {
  const before = seed(rawFee);
  const client = createSqliteHttpClient(dispatch);
  const after = { ...before, fee: "8.2500", source: { ...before.source, feeStatus: "reported" as const } };
  const plan = await client.prepareTradeChanges({ kind: "revision", revision: revision(before, after) });
  expect(plan.summary.changes).toContainEqual(expect.objectContaining({ kind: "revise", before: expect.objectContaining({ fee: rawFee }), after: expect.objectContaining({ fee: "8.2500" }) }));
  const result = await submitReviewedTrade(client, { envelope: { planId: plan.planId, requestId: "fee-correction", choices: {} } });
  expect(result.executions[0]).toMatchObject({ fee: "8.2500", source: { feeStatus: "reported" } });
  expect(rawFact()?.fee).toBe("8.2500");
});

it.each([null, ""])("I1 withdraws and revises a withdrawn fact without changing its raw unknown fee %j or activating it", async rawFee => {
  const before = seed(rawFee);
  const client = createSqliteHttpClient(dispatch);
  const withdrawal = await client.prepareTradeChanges({ kind: "revision", revision: { ...revision(before, null), id: "withdrawal" } });
  expect(withdrawal.summary.changes).toContainEqual(expect.objectContaining({ kind: "withdraw", before: expect.objectContaining({ fee: rawFee }), after: null }));
  const withdrawn = await submitReviewedTrade(client, { envelope: { planId: withdrawal.planId, requestId: "withdrawal", choices: {} } });
  expect(withdrawn.executions).toEqual([]);
  expect(rawFact()?.fee).toBe(rawFee);
  const stateBefore = db.prepare("select * from execution_fact_states where execution_id=?").get(original.id);
  expect(stateBefore).toMatchObject({ state: "withdrawn" });
  const plan = await client.prepareTradeChanges({ kind: "revision", revision: revision(before, { ...before, quantity: "3" }) });
  expect(plan.reactivateExecutionIds).toEqual([]);
  expect(plan.summary.changes).toContainEqual(expect.objectContaining({ kind: "revise", before: expect.objectContaining({ fee: rawFee }), after: expect.objectContaining({ fee: rawFee, quantity: "3" }) }));
  const result = await submitReviewedTrade(client, { envelope: { planId: plan.planId, requestId: "still-withdrawn", choices: {} } });
  expect(result.executions).toEqual([]);
  expect(rawFact()).toMatchObject({ fee: rawFee, quantity: "3" });
  expect(db.prepare("select * from execution_fact_states where execution_id=?").get(original.id)).toEqual(stateBefore);
});

it.each([null, ""])("I1 rejects a stale unknown-fee plan %j without committing the inherited raw fee", async rawFee => {
  const before = seed(rawFee);
  const client = createSqliteHttpClient(dispatch);
  const plan = await client.prepareTradeChanges({ kind: "revision", revision: revision(before, { ...before, quantity: "2" }) });
  db.prepare("update executions set price='99.125' where id=?").run(original.id);
  const version = readBookVersion(db), raw = rawFact();
  await expect(client.commitTradeChanges({ planId: plan.planId, requestId: "stale-plan", choices: {} })).rejects.toMatchObject({ status: 409, code: "BOOK_VERSION_CHANGED", category: "conflict" });
  expect(rawFact()).toEqual(raw);
  expect(readBookVersion(db)).toEqual(version);
  expect(await client.getTradeCommit("stale-plan")).toBeNull();
});

it("I1 rejects a null fee in the revision DTO while retaining the string projection protocol", async () => {
  const before = seed(null), version = readBookVersion(db), raw = rawFact();
  const response = await rawPrepare({ kind: "revision", revision: { ...revision(before, before), changes: [{ before, after: { ...before, fee: null } }] } });
  expect(response.status).toBe(400);
  expect(rawFact()).toEqual(raw);
  expect(readBookVersion(db)).toEqual(version);
});

it("I1 rejects a stored reported raw NULL even when the display projection marks it unknown", async () => {
  seed(null, "reported");
  const client = createSqliteHttpClient(dispatch);
  const before = (await client.readTradeBook()).executions[0];
  expect(before).toMatchObject({ fee: "", source: { feeStatus: "unknown" } });
  const version = readBookVersion(db), raw = rawFact();
  const response = await rawPrepare({ kind: "revision", revision: revision(before, { ...before, quantity: "2" }) });
  expect(response.status).toBe(422);
  expect(rawFact()).toEqual(raw);
  expect(readBookVersion(db)).toEqual(version);
});
