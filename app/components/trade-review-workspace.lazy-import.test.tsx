import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";
import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import type { StatementDispatchResult } from "../lib/import/dispatcher";
import type { ScreenshotReviewDialogProps } from "./import/screenshot-review-dialog";

// A cancellation callback probe exercises the workspace's existing cancellation
// handler while the parser module is unresolved. It is not browser UI evidence.
vi.mock("./import/use-screenshot-import", () => ({
  useScreenshotImport: () => ({
    open: true, completing: false,
    state: { batchId: "cancellation-probe", images: [], drafts: [], deletedDraftIds: new Set() },
    images: [], decisions: new Map(), cancel: vi.fn(),
  }),
}));
vi.mock("./import/screenshot-review-dialog", () => ({
  ScreenshotReviewDialog: ({ onCancel }: ScreenshotReviewDialogProps) =>
    <button onClick={onCancel}>取消请求探针</button>,
}));

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const contextRequired: StatementDispatchResult = {
  broker: "unknown", records: [], candidates: [], exclusions: [], blocked: true,
  diagnostics: [{ severity: "error", code: "tradingview-missing-instrument-context", message: "请选择证券" }],
};
const initialFrame: DemoReplayFrame = {
  cursorIndex: 0, cursor: "2025-01-02T14:30:00.000Z", candles15m: [],
  executions: [], canGoBack: false, canGoForward: false,
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, "", "/home");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ aliases: [] })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.doUnmock("../lib/import/dispatcher"); });

async function mountWorkspace() {
  const { TradeReviewWorkspace } = await import("./trade-review-workspace");
  render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false}
    storageClient={createLegacySqliteClient()} legacyStateExporter={async () => null} />);
  return screen.findByLabelText("导入 TradingView 模拟交易", { selector: "input" });
}
function select(input: HTMLElement, name: string) {
  // Models concurrently dispatched file selections at the existing event seam.
  // Physical input availability is verified separately in browser acceptance.
  fireEvent.change(input, { target: { files: [new File(["csv"], name, { type: "text/csv" })] } });
}

it("does not start parsing after cancellation while the parser module is loading", async () => {
  const gate = deferred<void>();
  const parseBrokerStatement = vi.fn().mockResolvedValue(contextRequired);
  const loading = vi.fn();
  vi.doMock("../lib/import/dispatcher", async () => {
    loading(); await gate.promise; return { parseBrokerStatement };
  });
  const input = await mountWorkspace();
  select(input, "cancelled.csv");
  await waitFor(() => expect(loading).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "取消请求探针" }));
  await act(async () => { gate.resolve(); await vi.dynamicImportSettled(); });
  expect(parseBrokerStatement).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog", { name: "确认证券信息" })).not.toBeInTheDocument();
  expect(input).not.toBeDisabled();
});

it("parses only the latest file when another selection supersedes an unresolved module load", async () => {
  const gate = deferred<void>();
  const parseBrokerStatement = vi.fn().mockResolvedValue(contextRequired);
  const loading = vi.fn();
  vi.doMock("../lib/import/dispatcher", async () => {
    loading(); await gate.promise; return { parseBrokerStatement };
  });
  const input = await mountWorkspace();
  select(input, "old.csv");
  await waitFor(() => expect(loading).toHaveBeenCalledOnce());
  select(input, "latest.csv");
  await act(async () => { gate.resolve(); await vi.dynamicImportSettled(); });
  await screen.findByRole("dialog", { name: "确认证券信息" });
  expect(parseBrokerStatement).toHaveBeenCalledTimes(1);
  expect(parseBrokerStatement.mock.calls[0][0].name).toBe("latest.csv");
  expect(screen.getByText("latest.csv")).toBeInTheDocument();
  expect(screen.queryByText("old.csv")).not.toBeInTheDocument();
});

it("ignores an older parse result after a newer preview has opened", async () => {
  const old = deferred<StatementDispatchResult>();
  const parseBrokerStatement = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue(contextRequired);
  vi.doMock("../lib/import/dispatcher", () => ({ parseBrokerStatement }));
  const input = await mountWorkspace();
  select(input, "old.csv");
  await waitFor(() => expect(parseBrokerStatement).toHaveBeenCalledOnce());
  select(input, "latest.csv");
  await screen.findByText("latest.csv");
  await act(async () => { old.resolve(contextRequired); await old.promise; });
  expect(screen.getByText("latest.csv")).toBeInTheDocument();
  expect(screen.queryByText("old.csv")).not.toBeInTheDocument();
});

it("keeps refresh guidance and unlocks input across repeated rejection of the same module load", async () => {
  let failedLoad: Promise<never> | undefined;
  vi.doMock("../lib/import/dispatcher", () => {
    failedLoad ??= Promise.reject(new Error("chunk unavailable"));
    return failedLoad;
  });
  const input = await mountWorkspace();
  select(input, "failed.csv");
  expect(await screen.findByText("导入组件加载失败，请刷新页面后重试。", { selector: "p[role=alert]" })).toBeInTheDocument();
  await waitFor(() => expect(input).not.toBeDisabled());
  expect(screen.queryByRole("dialog", { name: "确认证券信息" })).not.toBeInTheDocument();
  // Vitest may rerun a rejected factory. Return its identical failed Promise
  // across selections to model a persistent failure without claiming browser
  // network recovery or replacing the unavailable module with a working mock.
  select(input, "still-unavailable.csv");
  expect(await screen.findByText("导入组件加载失败，请刷新页面后重试。", { selector: "p[role=alert]" })).toBeInTheDocument();
  await waitFor(() => expect(input).not.toBeDisabled());
  expect(screen.queryByRole("dialog", { name: "确认证券信息" })).not.toBeInTheDocument();
});

it("preserves file parsing errors and accepts another file through the same loaded module", async () => {
  const parseBrokerStatement = vi.fn().mockRejectedValueOnce(new Error("文件格式无效"))
    .mockResolvedValue(contextRequired);
  vi.doMock("../lib/import/dispatcher", () => ({ parseBrokerStatement }));
  const input = await mountWorkspace();
  select(input, "invalid.csv");
  expect(await screen.findByText("文件格式无效", { selector: "p[role=alert]" })).toBeInTheDocument();
  expect(screen.queryByText("导入组件加载失败，请刷新页面后重试。")).not.toBeInTheDocument();
  await waitFor(() => expect(input).not.toBeDisabled());
  select(input, "recovered.csv");
  await screen.findByText("recovered.csv");
  expect(parseBrokerStatement).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("文件格式无效")).not.toBeInTheDocument();
});

it("does not publish a module failure after the pending import was cancelled", async () => {
  const gate = deferred<void>();
  const loading = vi.fn();
  vi.doMock("../lib/import/dispatcher", async () => {
    loading(); await gate.promise; return { parseBrokerStatement: vi.fn() };
  });
  const input = await mountWorkspace();
  select(input, "cancelled.csv");
  await waitFor(() => expect(loading).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "取消请求探针" }));
  await act(async () => { gate.reject(new Error("late module failure")); await vi.dynamicImportSettled(); });
  expect(screen.queryByText("导入组件加载失败，请刷新页面后重试。")).not.toBeInTheDocument();
  expect(screen.queryByText("late module failure")).not.toBeInTheDocument();
  expect(input).not.toBeDisabled();
});
