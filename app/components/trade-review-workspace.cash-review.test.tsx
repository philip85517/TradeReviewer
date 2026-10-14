import "fake-indexeddb/auto";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLayoutEffect } from "react";
import type { ComponentProps, ReactNode } from "react";
import type { CashSummary } from "../lib/cash/cash-model";
import { createCashClient } from "../lib/cash/cash-client";
import type { FxState } from "../lib/fx/room-contracts";
import type { RoomFxSnapshot } from "../lib/reviews/trading-room-scope";
import type { ReviewDashboard } from "./dashboard/review-dashboard";
import type { CashBaselinePanel } from "./data-management/cash-baseline-panel";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";

const fxProbe = vi.hoisted(() => ({ state: null as FxState | null }));
vi.mock("../lib/fx/use-fx-rates", () => ({
  useFxRates: () => ({
    state: fxProbe.state,
    loading: false,
    refreshing: false,
    error: null,
    refresh: async () => undefined,
  }),
}));

const probe = vi.hoisted(() => ({ dashboard: null as ComponentProps<typeof ReviewDashboard> | null, panel: null as ComponentProps<typeof CashBaselinePanel> | null, cashClient: null as object | null }));
type JournalMoneyView = {
  baseCurrency: "CNY";
  originalByCurrency: Readonly<Record<string, string>>;
  convertedCny: string | null;
  converted: string | null;
  convertedHkd: string | null;
  targetCurrency: "CNY" | "HKD" | null;
  conversion: "same-currency" | "complete" | "partial" | "missing";
  fxSnapshotId: string | null;
  note: string;
};
type JournalFxSnapshot = {
  id: string;
  baseCurrency: "CNY";
  asOf: string;
  source: string;
  status: "complete" | "partial" | "missing";
  rates: Readonly<Record<string, string>>;
  publishedAt: string | null;
  publishedAtByCurrency: Readonly<Record<string, string>>;
  fetchedAt: string | null;
  error: string | null;
  lastAttemptDay: string | null;
};
type JournalSummary = {
  todayProceeds: JournalMoneyView | null;
  cashTotal: JournalMoneyView | null;
  todayProceedsStatus: CashSummary["todayProceedsStatus"] | null;
  cashTotalStatus: CashSummary["cashTotalStatus"] | null;
  coverage: { included: number; excluded: number; missing: number } | null;
  missingReasons: readonly string[];
  asOf: string | null;
  updatedAt: string | null;
  byScope: Readonly<Record<string, { currency: string; amount: string; status: string }>>;
  fxSnapshot: JournalFxSnapshot | null;
};
type JournalBaselineRecord = {
  id: string;
  scope: { nature: "live" | "simulation"; simulationRunId: string | null };
  accountId: string;
  currency: string;
  balance: string;
  asOf: string;
  updatedAt: string;
  source: string | null;
  revision: number | null;
};
type JournalBaselineState = {
  version: number;
  records: readonly JournalBaselineRecord[];
};
type JournalSharedScope = {
  nature: "live" | "simulation" | "unknown";
  accountIds: readonly string[];
  reportCurrency: "original" | "CNY" | "HKD";
  simulationRunId: string | null;
} | null;
type CommittedCashRender = {
  cashSummary: CashSummary | null;
  summarySnapshot: JournalSummary;
  baselineState: JournalBaselineState;
  cashLoading: ComponentProps<typeof ReviewDashboard>["cashLoading"];
  cashError: string | null;
  cashRefreshNotice: string | null;
  baselineBalance: string | null;
  sharedScope: JournalSharedScope;
  cashClient: object | null;
};
const committedRenderJournal = vi.hoisted(() => ({ entries: [] as CommittedCashRender[] }));

type CashPanelState = ComponentProps<typeof CashBaselinePanel>["state"];

function snapshotMoneyView(view: CashSummary["cashTotal"] | null | undefined): JournalMoneyView | null {
  if (!view) return null;
  return {
    baseCurrency: view.baseCurrency,
    originalByCurrency: { ...view.originalByCurrency },
    convertedCny: view.convertedCny,
    converted: view.converted ?? null,
    convertedHkd: view.convertedHkd ?? null,
    targetCurrency: view.targetCurrency ?? null,
    conversion: view.conversion,
    fxSnapshotId: view.fxSnapshotId,
    note: view.note,
  };
}

function snapshotFxSnapshot(snapshot: RoomFxSnapshot | null | undefined): JournalFxSnapshot | null {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    baseCurrency: snapshot.baseCurrency,
    asOf: snapshot.asOf,
    source: snapshot.source,
    status: snapshot.status,
    rates: { ...snapshot.rates },
    publishedAt: snapshot.publishedAt ?? null,
    publishedAtByCurrency: { ...(snapshot.publishedAtByCurrency ?? {}) },
    fetchedAt: snapshot.fetchedAt ?? null,
    error: snapshot.error ?? null,
    lastAttemptDay: snapshot.lastAttemptDay ?? null,
  };
}

function snapshotCashSummary(summaryValue: CashSummary | null): JournalSummary {
  if (!summaryValue) {
    return {
      todayProceeds: null,
      cashTotal: null,
      todayProceedsStatus: null,
      cashTotalStatus: null,
      coverage: null,
      missingReasons: [],
      asOf: null,
      updatedAt: null,
      byScope: {},
      fxSnapshot: null,
    };
  }
  return {
    todayProceeds: snapshotMoneyView(summaryValue.todayProceeds),
    cashTotal: snapshotMoneyView(summaryValue.cashTotal),
    todayProceedsStatus: summaryValue.todayProceedsStatus,
    cashTotalStatus: summaryValue.cashTotalStatus,
    coverage: { ...summaryValue.coverage },
    missingReasons: [...summaryValue.missingReasons],
    asOf: summaryValue.asOf,
    updatedAt: summaryValue.updatedAt,
    byScope: Object.fromEntries(Object.entries(summaryValue.byScope).map(([key, value]) => [key, { ...value }])),
    fxSnapshot: snapshotFxSnapshot(summaryValue.fxSnapshot),
  };
}

function snapshotBaselineState(state: CashPanelState): JournalBaselineState {
  return {
    version: state.version,
    records: state.records.map(record => ({
      id: record.id,
      scope: { nature: record.scope.nature, simulationRunId: record.scope.simulationRunId },
      accountId: record.accountId,
      currency: record.currency,
      balance: record.balance,
      asOf: record.asOf,
      updatedAt: record.updatedAt,
      source: record.source ?? null,
      revision: record.revision ?? null,
    })),
  };
}

function snapshotSharedScope(scope: ComponentProps<typeof ReviewDashboard>["sharedScope"]): JournalSharedScope {
  if (!scope) return null;
  return {
    nature: scope.nature,
    accountIds: [...scope.accountIds],
    reportCurrency: scope.reportCurrency,
    simulationRunId: scope.simulationRunId,
  };
}

vi.mock("./dashboard/review-dashboard", () => ({ ReviewDashboard: (props: ComponentProps<typeof ReviewDashboard>) => {
  probe.dashboard = props;
  useLayoutEffect(() => {
    const dashboard = probe.dashboard;
    const panel = probe.panel;
    if (!dashboard || !panel) return;
    const cashSummary = dashboard.cashSummary ?? null;
    committedRenderJournal.entries.push({
      cashSummary,
      summarySnapshot: snapshotCashSummary(cashSummary),
      baselineState: snapshotBaselineState(panel.state),
      cashLoading: dashboard.cashLoading,
      cashError: dashboard.cashError ?? null,
      cashRefreshNotice: dashboard.cashRefreshNotice ?? null,
      baselineBalance: panel.state.records[0]?.balance ?? null,
      sharedScope: snapshotSharedScope(dashboard.sharedScope),
      cashClient: probe.cashClient,
    });
  });
  return <output data-testid="cash-probe">{JSON.stringify({ loading: props.cashLoading, error: props.cashError, summary: props.cashSummary })}</output>;
} }));
vi.mock("./data-management/data-management", () => ({ DataManagement: ({ cashSlot }: { cashSlot: ReactNode }) => <>{cashSlot}</> }));
vi.mock("./data-management/cash-baseline-panel", () => ({ CashBaselinePanel: (props: ComponentProps<typeof CashBaselinePanel>) => { probe.panel = props; return null; } }));
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const empty = { version: 1, records: [] };
const baseline = (balance: string, revision = 1) => ({
  version: 1 as const,
  records: [{
    id: "cash-a-cny",
    scope: { nature: "live" as const, simulationRunId: null },
    accountId: "a",
    currency: "CNY" as const,
    balance,
    asOf: "2026-10-10T16:00:00.000Z",
    updatedAt: "2026-10-10T16:00:00.000Z",
    source: "workspace-test",
    revision,
  }],
});
const cashFxState = (id: string, rate: string, publishedAt: string): FxState => ({
  id,
  baseCurrency: "CNY",
  source: "BOC",
  publishedAt,
  publishedAtByCurrency: { USD: publishedAt, HKD: publishedAt },
  fetchedAt: `${publishedAt.slice(0, 10)}T12:00:00.000Z`,
  rates: { USD: rate, HKD: "0.9" },
  lastAttemptDay: publishedAt.slice(0, 10),
  status: "complete",
  error: null,
});
const cashFxSnapshot = (id: string, rate: string, publishedAt: string): RoomFxSnapshot => ({
  id,
  baseCurrency: "CNY",
  asOf: publishedAt,
  source: "BOC",
  status: "complete",
  rates: { "USD/CNY": rate, "HKD/CNY": "0.9" },
  publishedAt,
  publishedAtByCurrency: { USD: publishedAt, HKD: publishedAt },
  fetchedAt: `${publishedAt.slice(0, 10)}T12:00:00.000Z`,
  error: null,
  lastAttemptDay: publishedAt.slice(0, 10),
});
const summary = (value: string, fxSnapshot?: RoomFxSnapshot): CashSummary => {
  const amount = ({ A: "1", B: "2", C: "3", A2: "4", C1: "101", C2: "202" } as Record<string, string>)[value] ?? value;
  const money = {
    baseCurrency: "CNY" as const,
    originalByCurrency: { CNY: amount },
    convertedCny: amount,
    converted: amount,
    convertedHkd: null,
    targetCurrency: "CNY" as const,
    conversion: "same-currency" as const,
    fxSnapshotId: fxSnapshot?.id ?? null,
    note: "test",
  };
  return {
    todayProceeds: money,
    cashTotal: money,
    todayProceedsStatus: "zero",
    cashTotalStatus: "available",
    coverage: { included: 0, excluded: 0, missing: 0 },
    asOf: null,
    missingReasons: [],
    byScope: {},
    updatedAt: null,
    ...(fxSnapshot ? { fxSnapshot } : {}),
  };
};
const frame = { cursorIndex: 0, cursor: "2025-01-02T14:30:00.000Z", candles15m: [], executions: [], canGoBack: false, canGoForward: false };
let getCash: (url: string) => Promise<Response>;
let getBaselines: () => Promise<Response>;
let putCash: () => Promise<Response>;
const testLegacyStateExporter = async () => null;
let workspaceStorageClient: ReturnType<typeof createLegacySqliteClient> | undefined;
let workspaceCashClient: ReturnType<typeof createCashClient> | undefined;
beforeEach(() => {
  window.localStorage.clear(); probe.dashboard = null; probe.panel = null; probe.cashClient = null; committedRenderJournal.entries.length = 0; fxProbe.state = null;
  workspaceStorageClient = createLegacySqliteClient();
  getCash = async () => Response.json(summary("A"));
  getBaselines = async () => Response.json(empty);
  putCash = async () => Response.json(empty);
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/cash/baselines")) return init?.method === "PUT" ? putCash() : getBaselines();
    if (url.includes("/trading-room/cash?")) return getCash(url);
    return Promise.resolve(Response.json({}));
  }));
  workspaceCashClient = createCashClient();
  probe.cashClient = workspaceCashClient;
});
afterEach(() => { cleanup(); probe.cashClient = null; workspaceCashClient = undefined; vi.unstubAllGlobals(); });
async function mount(expectedSummary: CashSummary = summary("A")) {
  probe.cashClient = workspaceCashClient!;
  const view = render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={workspaceStorageClient!} cashClient={workspaceCashClient!} legacyStateExporter={testLegacyStateExporter} />);
  await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
  await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(expectedSummary));
  return view;
}
function switchAccount(id: string) { act(() => probe.dashboard?.onSharedScopeChange?.({ accountIds: [id] })); }
type CashCommitExpectation = readonly [CashSummary | null, CashPanelState];
function journalBundleKey(summaryValue: CashSummary | null, state: CashPanelState): string {
  return JSON.stringify({ summary: snapshotCashSummary(summaryValue), baselineState: snapshotBaselineState(state) });
}
function actualJournalBundleKey(entry: CommittedCashRender): string {
  return JSON.stringify({ summary: entry.summarySnapshot, baselineState: entry.baselineState });
}
function expectCommittedPairs(entries: readonly CommittedCashRender[], allowed: readonly CashCommitExpectation[]) {
  expect(entries.length).toBeGreaterThan(0);
  expect(workspaceCashClient).toBeDefined();
  const allowedKeys = allowed.map(([summaryValue, state]) => journalBundleKey(summaryValue, state));
  entries.forEach(entry => {
    expect(entry.cashClient).toBe(workspaceCashClient);
    expect(entry.sharedScope).toEqual({ nature: "live", accountIds: [], reportCurrency: "original", simulationRunId: null });
    expect(entry).toHaveProperty("cashLoading");
    expect(entry).toHaveProperty("cashError");
    expect(entry).toHaveProperty("cashRefreshNotice");
    expect(entry.summarySnapshot).toEqual(snapshotCashSummary(entry.cashSummary));
    expect(entry.summarySnapshot).toHaveProperty("todayProceeds");
    expect(entry.summarySnapshot).toHaveProperty("cashTotal");
    expect(entry.summarySnapshot).toHaveProperty("todayProceedsStatus");
    expect(entry.summarySnapshot).toHaveProperty("cashTotalStatus");
    expect(entry.summarySnapshot).toHaveProperty("coverage");
    expect(entry.summarySnapshot).toHaveProperty("missingReasons");
    expect(entry.summarySnapshot).toHaveProperty("asOf");
    expect(entry.summarySnapshot).toHaveProperty("updatedAt");
    expect(entry.summarySnapshot).toHaveProperty("fxSnapshot");
    expect(entry.baselineState.records).toEqual(expect.any(Array));
    entry.baselineState.records.forEach(record => {
      expect(record).toHaveProperty("source");
      expect(record).toHaveProperty("revision");
    });
    expect(allowedKeys).toContain(actualJournalBundleKey(entry));
  });
}

describe("independent workspace cash race acceptance", () => {
  it("offers a GET-only retry after an initial cash read failure without creating a saved fact", async () => {
    const recoveredSummary = summary("A");
    let cashReads = 0;
    let saveCalls = 0;
    getBaselines = async () => Response.json(empty);
    getCash = async () => {
      cashReads += 1;
      return cashReads === 1
        ? Response.json({ error: { message: "现金服务暂不可用" } }, { status: 503 })
        : Response.json(recoveredSummary);
    };
    putCash = async () => {
      saveCalls += 1;
      return Response.json(empty);
    };

    probe.cashClient = workspaceCashClient!;
    render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={workspaceStorageClient!} cashClient={workspaceCashClient!} legacyStateExporter={testLegacyStateExporter} />);
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    await waitFor(() => expect(probe.dashboard?.cashError).toBe("现金服务暂不可用"));
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashRefreshNotice).toBeNull();
    expect(probe.dashboard?.onRetryCashSummary).toBeTypeOf("function");
    expect(probe.dashboard?.cashRetryDisabled).toBe(false);

    act(() => { probe.dashboard?.onRetryCashSummary?.(); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(recoveredSummary));
    expect(probe.dashboard?.cashError).toBeNull();
    expect(probe.dashboard?.cashRefreshNotice).toBeNull();
    expect(cashReads).toBe(2);
    expect(saveCalls).toBe(0);
  });

  it("retains the accepted summary, FX identity, and baseline through a same-business failed reread", async () => {
    const f1State = cashFxState("fx-f1", "7.1", "2026-10-14T00:00:00.000Z");
    const f2State = cashFxState("fx-f2", "7.2", "2026-10-15T00:00:00.000Z");
    const f1Summary = summary("C1", cashFxSnapshot("fx-f1", "7.1", "2026-10-14T00:00:00.000Z"));
    const f2Summary = summary("C2", cashFxSnapshot("fx-f2", "7.2", "2026-10-15T00:00:00.000Z"));
    let saveCalls = 0;
    fxProbe.state = f1State;
    getBaselines = async () => Response.json(baseline("101"));
    getCash = async () => Response.json(f1Summary);
    putCash = async () => {
      saveCalls += 1;
      return Response.json(baseline("202", 2));
    };
    const view = await mount(f1Summary);
    await waitFor(() => expect(probe.panel?.state.records[0]?.balance).toBe("101"));

    getBaselines = async () => Response.json(baseline("202", 2));
    getCash = async () => Response.json({ error: { message: "同范围现金读取失败" } }, { status: 503 });
    fxProbe.state = f2State;
    probe.cashClient = workspaceCashClient!;
    view.rerender(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={workspaceStorageClient!} cashClient={workspaceCashClient!} legacyStateExporter={testLegacyStateExporter} />);
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    await waitFor(() => expect(probe.dashboard?.cashError).toBe("同范围现金读取失败"));

    expect(probe.dashboard?.cashSummary?.cashTotal.fxSnapshotId).toBe("fx-f1");
    expect(probe.dashboard?.cashSummary).toEqual(f1Summary);
    expect(probe.panel?.state.records[0]?.balance).toBe("101");
    expect(probe.dashboard?.cashRefreshNotice).toBeNull();
    expect(probe.dashboard?.onRetryCashSummary).toBeTypeOf("function");
    expect(saveCalls).toBe(0);

    getCash = async () => Response.json(f2Summary);
    act(() => { probe.dashboard?.onRetryCashSummary?.(); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(f2Summary));
    expect(probe.panel?.state.records[0]?.balance).toBe("202");
    expect(saveCalls).toBe(0);
  });

  it("does not expose another account's accepted cash value after a failed scope read", async () => {
    const accountASummary = summary("A", cashFxSnapshot("fx-a", "7.1", "2026-10-14T00:00:00.000Z"));
    const accountBSummary = summary("B", cashFxSnapshot("fx-b", "7.2", "2026-10-15T00:00:00.000Z"));
    let saveCalls = 0;
    getBaselines = async () => Response.json(baseline("101"));
    getCash = async () => Response.json(accountASummary);
    putCash = async () => {
      saveCalls += 1;
      return Response.json(empty);
    };
    await mount(accountASummary);

    const accountBBaseline = {
      ...baseline("101"),
      records: [{ ...baseline("101").records[0], id: "cash-b-cny", accountId: "b" }],
    };
    getBaselines = async () => Response.json(accountBBaseline);
    getCash = async url => url.includes("accountId=b")
      ? Response.json({ error: { message: "B 账户现金读取失败" } }, { status: 503 })
      : Response.json(accountASummary);
    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    await waitFor(() => expect(probe.dashboard?.cashError).toBe("B 账户现金读取失败"));

    expect(probe.dashboard?.sharedScope?.accountIds).toEqual(["b"]);
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashSummary?.cashTotal.fxSnapshotId).not.toBe(accountASummary.cashTotal.fxSnapshotId);
    expect(probe.dashboard?.cashRefreshNotice).toBeNull();
    expect(probe.dashboard?.onRetryCashSummary).toBeTypeOf("function");
    expect(saveCalls).toBe(0);

    getCash = async url => url.includes("accountId=b") ? Response.json(accountBSummary) : Response.json(accountASummary);
    act(() => { probe.dashboard?.onRetryCashSummary?.(); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(accountBSummary));
    expect(saveCalls).toBe(0);
  });

  it("journals one committed initial-effect replacement from retained F1 to F2", async () => {
    const f1State = cashFxState("fx-f1", "7.1", "2026-10-14T00:00:00.000Z");
    const f2State = cashFxState("fx-f2", "7.2", "2026-10-15T00:00:00.000Z");
    const f1Summary = summary("C1", cashFxSnapshot("fx-f1", "7.1", "2026-10-14T00:00:00.000Z"));
    const f2Summary = summary("C2", cashFxSnapshot("fx-f2", "7.2", "2026-10-15T00:00:00.000Z"));
    fxProbe.state = f1State;
    getBaselines = async () => Response.json(baseline("101"));
    getCash = async () => Response.json(f1Summary);
    const view = await mount(f1Summary);
    const transitionStart = committedRenderJournal.entries.length;

    const pendingF2 = deferred<Response>();
    getBaselines = async () => Response.json(baseline("202", 2));
    getCash = () => pendingF2.promise;
    fxProbe.state = f2State;
    probe.cashClient = workspaceCashClient!;
    view.rerender(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={workspaceStorageClient!} cashClient={workspaceCashClient!} legacyStateExporter={testLegacyStateExporter} />);
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    const pendingEntries = committedRenderJournal.entries.slice(transitionStart);
    expectCommittedPairs(pendingEntries, [[f1Summary, baseline("101")]]);
    expect(pendingEntries.some(entry => entry.cashLoading)).toBe(true);

    const resolveStart = committedRenderJournal.entries.length;
    await act(async () => { pendingF2.resolve(Response.json(f2Summary)); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(f2Summary));
    await waitFor(() => expect(probe.panel?.state.records[0]?.balance).toBe("202"));
    const resolvedEntries = committedRenderJournal.entries.slice(resolveStart);
    const f2Entries = resolvedEntries.filter(entry => entry.cashSummary?.cashTotal.fxSnapshotId === "fx-f2");
    expectCommittedPairs(resolvedEntries, [[f1Summary, baseline("101")], [f2Summary, baseline("202", 2)]]);
    expect(f2Entries.length).toBeGreaterThan(0);
    expect(f2Entries.every(entry => entry.baselineBalance === "202")).toBe(true);
  });

  it("retains the accepted baseline through a deferred and failed FX revision, then replaces it atomically after success", async () => {
    const f1State = cashFxState("fx-f1", "7.1", "2026-10-14T00:00:00.000Z");
    const f2State = cashFxState("fx-f2", "7.2", "2026-10-15T00:00:00.000Z");
    const f1Summary = summary("C1", cashFxSnapshot("fx-f1", "7.1", "2026-10-14T00:00:00.000Z"));
    const f2Summary = summary("C2", cashFxSnapshot("fx-f2", "7.2", "2026-10-15T00:00:00.000Z"));
    fxProbe.state = f1State;
    getBaselines = async () => Response.json(baseline("101"));
    getCash = async () => Response.json(f1Summary);
    const view = await mount(f1Summary);
    await waitFor(() => expect(probe.panel?.state.records[0]?.balance).toBe("101"));

    const pendingF2 = deferred<Response>();
    const transitionStart = committedRenderJournal.entries.length;
    getCash = () => pendingF2.promise;
    fxProbe.state = f2State;
    probe.cashClient = workspaceCashClient!;
    view.rerender(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={workspaceStorageClient!} cashClient={workspaceCashClient!} legacyStateExporter={testLegacyStateExporter} />);
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    const pendingEntries = committedRenderJournal.entries.slice(transitionStart);
    expectCommittedPairs(pendingEntries, [[f1Summary, baseline("101")]]);
    expect(pendingEntries.some(entry => entry.cashLoading)).toBe(true);
    expect(probe.dashboard?.cashSummary).toEqual(f1Summary);
    expect(probe.panel?.state.records[0]?.balance).toBe("101");

    const failureStart = committedRenderJournal.entries.length;
    await act(async () => { pendingF2.reject(new Error("F2 unavailable")); });
    await waitFor(() => expect(probe.dashboard?.cashError).toBe("F2 unavailable"));
    expectCommittedPairs(committedRenderJournal.entries.slice(failureStart), [[f1Summary, baseline("101")]]);
    expect(probe.dashboard?.cashSummary).toEqual(f1Summary);
    expect(probe.panel?.state.records[0]?.balance).toBe("101");

    // The existing save/retry path gives the failed read a visible, user-owned
    // retry receipt without changing the production retry contract.
    getBaselines = async () => Response.json(baseline("202", 2));
    let putCalls = 0;
    putCash = async () => { putCalls += 1; return Response.json(baseline("202", 2)); };
    getCash = async () => { throw new Error("F2 unavailable after save"); };
    const saveStart = committedRenderJournal.entries.length;
    let saved!: Promise<unknown>;
    act(() => {
      saved = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "202", asOf: "2026-10-15T00:00:00.000Z", source: "workspace-test", expectedRevision: null });
    });
    await act(async () => { await saved; });
    await waitFor(() => expect(probe.dashboard?.cashRefreshNotice).toBe("已保存现金基准，摘要暂未刷新"));
    expect(probe.dashboard?.cashSummary).toEqual(f1Summary);
    expect(probe.dashboard?.cashError).toBe("F2 unavailable after save");
    expect(probe.panel?.state.records[0]?.balance).toBe("202");
    expect(putCalls).toBe(1);
    const savedEntries = committedRenderJournal.entries.slice(saveStart);
    expectCommittedPairs(savedEntries, [[f1Summary, baseline("101")], [f1Summary, baseline("202", 2)]]);
    expect(savedEntries.some(entry => entry.cashSummary?.cashTotal.fxSnapshotId === "fx-f1" && entry.baselineBalance === "202" && entry.cashRefreshNotice === "已保存现金基准，摘要暂未刷新")).toBe(true);

    const refreshStart = committedRenderJournal.entries.length;
    getCash = async () => Response.json(f2Summary);
    act(() => { probe.dashboard?.onRetryCashSummary?.(); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(f2Summary));
    await waitFor(() => expect(probe.panel?.state.records[0]?.balance).toBe("202"));
    expect(probe.dashboard?.cashRefreshNotice).toBeNull();
    expect(probe.dashboard?.cashError).toBeNull();
    expect(putCalls).toBe(1);
    const refreshEntries = committedRenderJournal.entries.slice(refreshStart);
    const refreshedF2Entries = refreshEntries.filter(entry => entry.cashSummary?.cashTotal.fxSnapshotId === "fx-f2");
    expectCommittedPairs(refreshEntries, [[f1Summary, baseline("202", 2)], [f2Summary, baseline("202", 2)]]);
    expect(refreshedF2Entries.length).toBeGreaterThan(0);
    expect(refreshedF2Entries.every(entry => entry.baselineBalance === "202")).toBe(true);
  });

  it.each(["source", "rate"] as const)("retains F1 after save when the real cash client rejects malformed FX %s", async malformedField => {
    const f1State = cashFxState("fx-f1", "7.1", "2026-10-14T00:00:00.000Z");
    const f1Summary = summary("C1", cashFxSnapshot("fx-f1", "7.1", "2026-10-14T00:00:00.000Z"));
    fxProbe.state = f1State;
    getBaselines = async () => Response.json(baseline("101"));
    getCash = async () => Response.json(f1Summary);
    await mount(f1Summary);

    // Send a wire-level defect through the real createCashClient parser. The
    // accepted F1 object must remain the display bundle when this read fails.
    const malformedPayload = JSON.parse(JSON.stringify(f1Summary)) as Record<string, unknown>;
    const malformedSnapshot = malformedPayload.fxSnapshot as Record<string, unknown>;
    if (malformedField === "source") {
      malformedSnapshot.source = null;
    } else {
      const malformedRates = malformedSnapshot.rates as Record<string, unknown>;
      malformedRates["USD/CNY"] = "NaN";
    }

    getBaselines = async () => Response.json(baseline("202", 2));
    let putCalls = 0;
    putCash = async () => { putCalls += 1; return Response.json(baseline("202", 2)); };
    getCash = async () => Response.json(malformedPayload);
    const saveStart = committedRenderJournal.entries.length;
    let saved!: Promise<unknown>;
    act(() => {
      saved = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "202", asOf: "2026-10-15T00:00:00.000Z", source: "workspace-test", expectedRevision: null });
    });
    await act(async () => { await saved; });
    await waitFor(() => expect(probe.dashboard?.cashError).toBe("现金摘要响应格式无效"));
    await waitFor(() => expect(probe.dashboard?.cashRefreshNotice).toBe("已保存现金基准，摘要暂未刷新"));

    expect(probe.dashboard?.cashSummary).toEqual(f1Summary);
    expect(probe.panel?.state.records[0]?.balance).toBe("202");
    expect(putCalls).toBe(1);
    expect(screen.getByTestId("cash-probe")).toHaveTextContent("现金摘要响应格式无效");
    const savedEntries = committedRenderJournal.entries.slice(saveStart);
    expectCommittedPairs(savedEntries, [[f1Summary, baseline("101")], [f1Summary, baseline("202", 2)]]);
    expect(savedEntries.some(entry => entry.cashSummary?.cashTotal.fxSnapshotId === "fx-f1" && entry.baselineBalance === "202" && entry.cashError === "现金摘要响应格式无效" && entry.cashRefreshNotice === "已保存现金基准，摘要暂未刷新")).toBe(true);
  });

  it("does not reread or clear the saved notice for canonical-equivalent FX metadata and map-order changes", async () => {
    const f1State = cashFxState("fx-f1", "7.1", "2026-10-14T00:00:00.000Z");
    const f1Summary = summary("C1", cashFxSnapshot("fx-f1", "7.1", "2026-10-14T00:00:00.000Z"));
    fxProbe.state = f1State;
    getBaselines = async () => Response.json(baseline("101"));
    getCash = async () => Response.json(f1Summary);
    const view = await mount(f1Summary);
    let cashReads = 0;
    getBaselines = async () => Response.json(baseline("101", 2));
    putCash = async () => Response.json(baseline("101", 2));
    getCash = async () => {
      cashReads += 1;
      throw new Error("summary unavailable");
    };
    let saved!: Promise<unknown>;
    act(() => {
      saved = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "101", asOf: "2026-10-14T00:00:00.000Z", source: "workspace-test", expectedRevision: null });
    });
    await act(async () => { await saved; });
    await waitFor(() => expect(probe.dashboard?.cashRefreshNotice).toBe("已保存现金基准，摘要暂未刷新"));
    const readsBeforeMetadata = cashReads;
    const noticeBeforeMetadata = probe.dashboard?.cashRefreshNotice;

    fxProbe.state = {
      ...f1State,
      publishedAtByCurrency: { HKD: "2026-10-14T00:00:00.000Z", USD: "2026-10-14T00:00:00.000Z" },
      rates: { HKD: "0.9", USD: "7.1" },
      fetchedAt: "2026-10-15T12:00:00.000Z",
      lastAttemptDay: "2026-10-15",
      error: "provider unavailable",
    };
    probe.cashClient = workspaceCashClient!;
    view.rerender(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={workspaceStorageClient!} cashClient={workspaceCashClient!} legacyStateExporter={testLegacyStateExporter} />);
    await waitFor(() => expect(probe.dashboard?.cashRefreshNotice).toBe(noticeBeforeMetadata));
    expect(cashReads).toBe(readsBeforeMetadata);
    expect(probe.dashboard?.cashSummary).toEqual(f1Summary);
  });

  it("clears the previous amount while the next identity GET waits, and ignores an older successful GET", async () => {
    await mount();
    const b = deferred<Response>(); const c = deferred<Response>();
    getCash = url => url.includes("accountId=b") ? b.promise : c.promise;
    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();
    switchAccount("c");
    await act(async () => { c.resolve(Response.json(summary("C"))); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("C")));
    await act(async () => { b.resolve(Response.json(summary("B"))); });
    expect(probe.dashboard?.cashSummary).toEqual(summary("C"));
    expect(screen.getByTestId("cash-probe")).not.toHaveTextContent('"2"');
  });
  it("keeps a previously loaded identity pending while its new GET waits after an A-to-B-to-A switch", async () => {
    await mount();
    const b = deferred<Response>(); const returnedA = deferred<Response>();
    getCash = url => url.includes("accountId=b") ? b.promise : returnedA.promise;

    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();

    act(() => probe.dashboard?.onSharedScopeChange?.({ accountIds: [] }));
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();

    await act(async () => { returnedA.resolve(Response.json(summary("A2"))); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("A2")));
    expect(probe.dashboard?.cashLoading).toBe(false);

    await act(async () => { b.resolve(Response.json(summary("B"))); });
    expect(probe.dashboard?.cashSummary).toEqual(summary("A2"));
  });
  it("attributes a failed reload after an A-to-B-to-A switch to the returned identity", async () => {
    await mount();
    const b = deferred<Response>(); const returnedA = deferred<Response>();
    getCash = url => url.includes("accountId=b") ? b.promise : returnedA.promise;

    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    act(() => probe.dashboard?.onSharedScopeChange?.({ accountIds: [] }));
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();

    await act(async () => { returnedA.resolve(Response.json({ error: { message: "A unavailable" } }, { status: 503 })); });
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashError).toBe("A unavailable");

    await act(async () => { b.resolve(Response.json(summary("B"))); });
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashError).toBe("A unavailable");
  });
  it("attributes a failed current GET to the new identity without retaining the old amount", async () => {
    await mount();
    const b = deferred<Response>(); getCash = () => b.promise;
    switchAccount("b");
    await act(async () => { b.resolve(Response.json({ error: { message: "B unavailable" } }, { status: 503 })); });
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashError).toBe("B unavailable");
  });
  it("does not publish a late PUT rejection from the previous identity into the new identity", async () => {
    await mount();
    await waitFor(() => expect(probe.panel).not.toBeNull());
    const put = deferred<Response>(); putCash = () => put.promise;
    let saved!: Promise<unknown>;
    act(() => { saved = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "1", asOf: "2026-09-01T00:00:00.000Z", source: "caller-test", expectedRevision: null }); });
    getCash = async () => Response.json(summary("B")); switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("B")));
    await act(async () => { put.reject(new Error("old account write failed")); await expect(saved).rejects.toThrow("old account write failed"); });
    expect(probe.dashboard?.cashError).toBeNull();
    expect(probe.panel?.error).toBeNull();
    expect(probe.dashboard?.cashSummary).toEqual(summary("B"));
  });

  it("does not let an older same-scope reload acknowledgement clear a newer write error", async () => {
    await mount();
    await waitFor(() => expect(probe.panel).not.toBeNull());

    const firstPut = deferred<Response>();
    putCash = () => firstPut.promise;
    let firstSave!: Promise<unknown>;
    act(() => {
      firstSave = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "1", asOf: "2026-09-01T00:00:00.000Z", source: "caller-test", expectedRevision: null });
    });
    await act(async () => {
      firstPut.reject(new Error("first write failed"));
      await expect(firstSave).rejects.toThrow("first write failed");
    });
    await waitFor(() => expect(probe.panel?.error).toBe("first write failed"));
    const oldAcknowledgement = probe.panel?.onReloadConflict;
    expect(oldAcknowledgement).toBeTypeOf("function");

    const secondPut = deferred<Response>();
    putCash = () => secondPut.promise;
    let secondSave!: Promise<unknown>;
    act(() => {
      secondSave = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "2", asOf: "2026-09-01T00:00:00.000Z", source: "caller-test", expectedRevision: null });
    });
    await act(async () => {
      secondPut.reject(new Error("second write failed"));
      await expect(secondSave).rejects.toThrow("second write failed");
    });
    await waitFor(() => expect(probe.panel?.error).toBe("second write failed"));

    act(() => { oldAcknowledgement?.(); });
    expect(probe.panel?.error).toBe("second write failed");
    act(() => { probe.panel?.onReloadConflict?.(); });
    await waitFor(() => expect(probe.panel?.error).toBeNull());
  });

  it("rejects a reload acknowledgement from an older cash scope", async () => {
    await mount();
    await waitFor(() => expect(probe.panel).not.toBeNull());

    const firstPut = deferred<Response>();
    putCash = () => firstPut.promise;
    let firstSave!: Promise<unknown>;
    act(() => {
      firstSave = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "1", asOf: "2026-09-01T00:00:00.000Z", source: "caller-test", expectedRevision: null });
    });
    await act(async () => {
      firstPut.reject(new Error("scope A write failed"));
      await expect(firstSave).rejects.toThrow("scope A write failed");
    });
    await waitFor(() => expect(probe.panel?.error).toBe("scope A write failed"));
    const oldAcknowledgement = probe.panel?.onReloadConflict;
    expect(oldAcknowledgement).toBeTypeOf("function");

    getCash = url => url.includes("accountId=b") ? Promise.resolve(Response.json(summary("B"))) : Promise.resolve(Response.json(summary("A")));
    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("B")));
    await waitFor(() => expect(probe.panel?.error).toBeNull());

    const secondPut = deferred<Response>();
    putCash = () => secondPut.promise;
    let secondSave!: Promise<unknown>;
    act(() => {
      secondSave = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "b", currency: "CNY", balance: "2", asOf: "2026-09-01T00:00:00.000Z", source: "caller-test", expectedRevision: null });
    });
    await act(async () => {
      secondPut.reject(new Error("scope B write failed"));
      await expect(secondSave).rejects.toThrow("scope B write failed");
    });
    await waitFor(() => expect(probe.panel?.error).toBe("scope B write failed"));

    act(() => { oldAcknowledgement?.(); });
    expect(probe.panel?.error).toBe("scope B write failed");
    act(() => { probe.panel?.onReloadConflict?.(); });
    await waitFor(() => expect(probe.panel?.error).toBeNull());
  });

  it("rejects a reload acknowledgement from an older cash client", async () => {
    const clientA = createCashClient();
    const clientB = createCashClient();
    const storageClient = createLegacySqliteClient();
    probe.cashClient = clientA;
    const view = render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={storageClient} cashClient={clientA} legacyStateExporter={testLegacyStateExporter} />);
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    await waitFor(() => expect(probe.panel).not.toBeNull());

    const firstPut = deferred<Response>();
    putCash = () => firstPut.promise;
    let firstSave!: Promise<unknown>;
    act(() => {
      firstSave = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "1", asOf: "2026-09-01T00:00:00.000Z", source: "caller-test", expectedRevision: null });
    });
    await act(async () => {
      firstPut.reject(new Error("client A write failed"));
      await expect(firstSave).rejects.toThrow("client A write failed");
    });
    await waitFor(() => expect(probe.panel?.error).toBe("client A write failed"));
    const oldAcknowledgement = probe.panel?.onReloadConflict;
    expect(oldAcknowledgement).toBeTypeOf("function");

    probe.cashClient = clientB;
    view.rerender(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={storageClient} cashClient={clientB} legacyStateExporter={testLegacyStateExporter} />);
    await waitFor(() => expect(probe.panel?.error).toBeNull());

    const secondPut = deferred<Response>();
    putCash = () => secondPut.promise;
    let secondSave!: Promise<unknown>;
    act(() => {
      secondSave = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "2", asOf: "2026-09-01T00:00:00.000Z", source: "caller-test", expectedRevision: null });
    });
    await act(async () => {
      secondPut.reject(new Error("client B write failed"));
      await expect(secondSave).rejects.toThrow("client B write failed");
    });
    await waitFor(() => expect(probe.panel?.error).toBe("client B write failed"));

    act(() => { oldAcknowledgement?.(); });
    expect(probe.panel?.error).toBe("client B write failed");
    act(() => { probe.panel?.onReloadConflict?.(); });
    await waitFor(() => expect(probe.panel?.error).toBeNull());
  });
});
