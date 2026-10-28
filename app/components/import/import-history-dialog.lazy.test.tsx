import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ImportHistoryEntry } from "../../lib/storage/import-history-contract";
import { ImportHistoryDialog } from "./import-history-dialog";

afterEach(cleanup);
const entry = (id: string): ImportHistoryEntry => ({ id, fileName: `${id}.csv`, sourceLabel: id, importedAt: "2026-10-27", tradeCount: 1, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 3, unresolvedInstrumentCount: 0 });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
type Result = { batchId: string; committedDuplicateTradeCount?: number };

it("loads only the selected batch, discards stale responses and aborts on close", async () => {
  const a = deferred<Result>(), b = deferred<Result>();
  const loadCommit = vi.fn((id: string, _signal: AbortSignal) => id === "A" ? a.promise : b.promise);
  const view = render(<ImportHistoryDialog entries={[entry("A"), entry("B")]} onClose={() => {}} loadCommit={loadCommit} />);
  await waitFor(() => expect(loadCommit).toHaveBeenCalledTimes(1));
  expect(loadCommit.mock.calls[0][0]).toBe("A");
  expect(screen.getByText(/实际核对重复 核验中/)).toBeInTheDocument();
  const rows = screen.getAllByRole("row");
  expect(within(rows[2]).getByText("选中后核验 / 0")).toBeInTheDocument();
  fireEvent.keyDown(rows[2], { key: "Enter" });
  await waitFor(() => expect(loadCommit).toHaveBeenCalledTimes(2));
  expect(loadCommit.mock.calls[0][1].aborted).toBe(true);
  a.resolve({ batchId: "A", committedDuplicateTradeCount: 9 });
  b.resolve({ batchId: "B", committedDuplicateTradeCount: 1 });
  await waitFor(() => expect(screen.getByText(/实际核对重复 1 笔/)).toBeInTheDocument());
  expect(screen.queryByText(/实际核对重复 9 笔/)).not.toBeInTheDocument();
  expect(screen.getByText(/导入前重复预估 3 笔/)).toBeInTheDocument();
  view.unmount();
  expect(loadCommit.mock.calls[1][1].aborted).toBe(true);
});

it("distinguishes failed reads from evidence unknown and retries without retaining prior counts", async () => {
  const loadCommit = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ batchId: "A" });
  render(<ImportHistoryDialog entries={[entry("A")]} onClose={() => {}} loadCommit={loadCommit} />);
  const retry = await screen.findByRole("button", { name: "重试核验实际数量" });
  expect(screen.getByText(/实际核对重复 读取失败/)).toBeInTheDocument();
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByText(/实际核对重复 未知/)).toBeInTheDocument());
  expect(loadCommit).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: "重试核验实际数量" })).not.toBeInTheDocument();
});

it("does not trust a supplied projected count or a result for another batch", async () => {
  const loadCommit = vi.fn().mockResolvedValue({ batchId: "B", committedDuplicateTradeCount: 8 });
  render(<ImportHistoryDialog entries={[{ ...entry("A"), committedDuplicateTradeCount: 99 }]} onClose={() => {}} loadCommit={loadCommit} />);
  await screen.findByRole("button", { name: "重试核验实际数量" });
  expect(screen.queryByText(/实际核对重复 99/)).not.toBeInTheDocument();
  expect(screen.queryByText(/实际核对重复 8/)).not.toBeInTheDocument();
});

it("explains a changed book version without displaying a stored estimate as actual", async () => {
  const loadCommit = vi.fn().mockRejectedValue(Object.assign(new Error("stale"), { code: "BOOK_VERSION_CHANGED" }));
  render(<ImportHistoryDialog entries={[entry("A")]} onClose={() => {}} loadCommit={loadCommit} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("账本版本已变化，请刷新页面后重试。");
  expect(screen.getByText(/实际核对重复 读取失败/)).toBeInTheDocument();
  expect(screen.queryByText(/实际核对重复 3 笔/)).not.toBeInTheDocument();
});

it("cancels and rechecks the same ID when its server-owned summary is replaced", async () => {
  const first = deferred<Result>(), second = deferred<Result>();
  const loadCommit = vi.fn((_id: string, _signal: AbortSignal) => loadCommit.mock.calls.length === 1 ? first.promise : second.promise);
  const view = render(<ImportHistoryDialog entries={[entry("A")]} onClose={() => {}} loadCommit={loadCommit} />);
  await waitFor(() => expect(loadCommit).toHaveBeenCalledTimes(1));
  view.rerender(<ImportHistoryDialog entries={[{ ...entry("A"), duplicateTradeCount: 4 }]} onClose={() => {}} loadCommit={loadCommit} />);
  await waitFor(() => expect(loadCommit).toHaveBeenCalledTimes(2));
  expect(loadCommit.mock.calls[0][1].aborted).toBe(true);
  second.resolve({ batchId: "A", committedDuplicateTradeCount: 2 });
  await waitFor(() => expect(screen.getByText(/实际核对重复 2 笔/)).toBeInTheDocument());
  first.resolve({ batchId: "A", committedDuplicateTradeCount: 9 });
  await Promise.resolve();
  expect(screen.queryByText(/实际核对重复 9 笔/)).not.toBeInTheDocument();
  expect(screen.getByText(/导入前重复预估 4 笔/)).toBeInTheDocument();
});
