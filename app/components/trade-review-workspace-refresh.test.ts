import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { withGlobalMarketRefreshLock } from "../lib/market/refresh-lock";
import { RefreshCancellationService } from "../lib/market/refresh-cancellation";

const source = readFileSync(resolve(process.cwd(), "app/components/trade-review-workspace.tsx"), "utf8");

type HarnessActiveRun = {
  key: string;
  controller: AbortController;
  promise: Promise<void>;
  snapshotIds: ReadonlySet<string>;
  batch: boolean;
  includeIntraday: boolean;
  subscriberCounts: Map<string, number>;
};

type HarnessProducer = {
  ids: Set<string>;
  options: Record<string, unknown>;
  includeIntraday: boolean;
  subscriberCounts: Map<string, number>;
  promise: Promise<boolean>;
  resolve: (value: boolean) => void;
  started: boolean;
  activeRun?: HarnessActiveRun;
  cancelled: boolean;
  settled: boolean;
};

type HarnessPendingRequest = {
  ids: ReadonlySet<string>;
  options: Record<string, unknown>;
  cancelled: boolean;
  bindings: ReadonlyArray<{ producer: HarnessProducer; ids: ReadonlySet<string> }>;
  promise?: Promise<boolean>;
};

type CoordinatorHarness = {
  start: (ids: readonly string[], options?: Record<string, unknown>) => Promise<boolean>;
  cancel: (ids?: readonly string[]) => void;
  cancelQueued: (ids?: readonly string[]) => void;
  active: { current: Map<string, HarnessActiveRun> };
  pending: { current: Map<number, HarnessPendingRequest> };
  runs: Array<{ ids: string[]; options: Record<string, unknown> }>;
  releaseFirst: () => void;
  releaseDeferred: () => void;
  cancellation: RefreshCancellationService;
};

function createCoordinatorHarness(): CoordinatorHarness {
  const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations: string[] = [];
  const wanted = new Set(["startMarketDataUpdate", "executeMarketDataUpdate", "cancelMarketDataUpdate", "cancelQueuedMarketDataUpdate", "cancelSubscriber"]);
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text && wanted.has(node.name.text)) declarations.push(node.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const compiled = ts.transpileModule(
    `${declarations.join("\n")}\nreturn { start: startMarketDataUpdate, execute: executeMarketDataUpdate, cancel: cancelMarketDataUpdate, cancelQueued: cancelQueuedMarketDataUpdate };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const active = { current: new Map<string, HarnessActiveRun>() };
  const pending = { current: new Map<number, HarnessPendingRequest>() };
  const producers = { current: new Map<number, HarnessProducer>() };
  const queue = { current: Promise.resolve() };
  const sequence = { current: 0 };
  const cancellation = new RefreshCancellationService();
  const controllers = { current: {} as Record<string, AbortController> };
  const runs: CoordinatorHarness["runs"] = [];
  let firstRelease!: () => void;
  let deferredRelease!: () => void;
  let first = true;

  const runMarketDataUpdate = async (ids: readonly string[] | undefined, options: Record<string, unknown>) => {
    const requested = [...(ids ?? [])];
    const key = `controlled:${runs.length}`;
    let complete!: () => void;
    const promise = new Promise<void>((resolve) => { complete = resolve; });
    const handle = cancellation.begin(key);
    const run: HarnessActiveRun = {
      key,
      snapshotIds: new Set(requested),
      includeIntraday: options.includeIntraday !== false,
      batch: options.batch === true,
      controller: handle.controller,
    subscriberCounts: new Map(requested.map((id) => [id, 1])),
      promise,
    };
    active.current.set(key, run);
    if (options.ownerCounts) run.subscriberCounts = new Map(options.ownerCounts as Map<string, number>);
    requested.forEach((id) => { controllers.current[id] ??= new AbortController(); });
    runs.push({ ids: requested, options });
    if (options.throw === true) {
      first = false;
      active.current.delete(key);
      cancellation.finish(key, handle.controller);
      throw new Error("controlled producer failure");
    }
    if (first) {
      first = false;
      firstRelease = () => {
        active.current.delete(key);
        cancellation.finish(key, handle.controller);
        complete();
      };
      await promise;
    } else if (options.defer === true) {
      deferredRelease = () => {
        active.current.delete(key);
        cancellation.finish(key, handle.controller);
        complete();
      };
      await promise;
    } else {
      active.current.delete(key);
      cancellation.finish(key, handle.controller);
      complete();
    }
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { locks: { request: async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) => callback({}) } },
  });
  const functions = new Function(
    "activeMarketRefreshRuns", "pendingMarketRefreshRequests", "marketRefreshProducers", "publicMarketRefreshQueue",
    "marketRefreshRequestSequence", "refreshCancellation", "marketDataAbortControllers",
    "withGlobalMarketRefreshLock", "runMarketDataUpdate", "setNavigationNotice",
    "currentExecutionSnapshot", "buildInstrumentTradeSummaries", compiled,
  )(
    active, pending, producers, queue, sequence, { current: cancellation }, controllers,
    withGlobalMarketRefreshLock, runMarketDataUpdate, () => undefined, () => [], () => [],
  ) as { start: CoordinatorHarness["start"]; cancel: CoordinatorHarness["cancel"]; cancelQueued: CoordinatorHarness["cancelQueued"] };
  return { ...functions, active, pending, runs, releaseFirst: () => firstRelease?.(), releaseDeferred: () => deferredRelease?.(), cancellation };
}

describe("workspace market refresh coordinator contract", () => {
  it("routes every public refresh surface through the lock owning entry point", () => {
    expect(source).toMatch(/async function startMarketDataUpdate\(/);
    expect(source).toMatch(/await withGlobalMarketRefreshLock\(/);
    expect(source).toMatch(/onRefreshHoldingsValuation=[\s\S]*startMarketDataUpdate/);
    expect(source).toMatch(/onRefresh: \(\) => void startMarketDataUpdate[\s\S]*/);
    expect(source).toMatch(/onRefreshMarketData=\{\(instrumentId\) => void startMarketDataUpdate[\s\S]*/);
    expect(source).toMatch(/startMarketDataUpdate\(automaticSyncIds,\s*\{/);
    expect(source).toMatch(/publicMarketRefreshQueue = useRef/);
    expect(source).toMatch(/pendingMarketRefreshRequests\.current\.set/);
    expect(source).toMatch(/executeMarketDataUpdate\(remaining, \{ \.\.\.options, coalesced: true \}\)/);
    expect(source).toMatch(/producer\.includeIntraday/);
    expect(source).toMatch(/ownerCounts/);
    const recoveryStart = source.indexOf("async function recoverUnfinishedMarketData");
    const recoveryEnd = source.indexOf("function previewForImport", recoveryStart);
    const recovery = source.slice(recoveryStart, recoveryEnd);
    expect(recovery).toMatch(/await startMarketDataUpdate\(summary\.unfinishedInstrumentIds/);
    expect(recovery).not.toMatch(/runMarketDataUpdate\(summary\.unfinishedInstrumentIds/);
  });

  it("routes unfinished recovery through the public coordinator entry", async () => {
    const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let declaration = "";
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "recoverUnfinishedMarketData") declaration = node.getText(ast);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    const compiled = ts.transpileModule(`${declaration}\nreturn recoverUnfinishedMarketData;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const calls: Array<{ ids: readonly string[]; options: Record<string, unknown> }> = [];
    const active = { current: new Map() };
    const notices: unknown[] = [];
    const summary = {
      total: 1, processed: 0, completed: 0, partial: 0, failed: 0, retryable: 1,
      retryableInstrumentIds: ["B"], unfinishedInstrumentIds: ["B"],
      failureDetails: [], unfinishedDetails: [],
    };
    const fn = new Function(
      "activeMarketRefreshRuns", "storageClient", "currentExecutionSnapshot", "buildInstrumentTradeSummaries",
      "summarizePersistedMarketDataJobs", "marketDataJobsRef", "setMarketDataJobs", "setFailedMarketDataIds",
      "setMarketDataRefresh", "setNavigationNotice", "startMarketDataUpdate", compiled,
    )(
      active,
      { getBootstrap: async () => ({ marketDataJobs: [{ instrumentId: "B" }] }) },
      () => [],
      () => [{ instrument: { id: "B", symbol: "B", market: "US" } }],
      () => summary,
      { current: {} }, () => undefined, () => undefined, () => undefined,
      (notice: unknown) => notices.push(notice),
      async (ids: readonly string[], options: Record<string, unknown>) => { calls.push({ ids, options }); return true; },
    ) as () => Promise<void>;
    await fn();
    expect(calls).toEqual([{ ids: ["B"], options: { refreshMetadata: true, batch: true } }]);
  });

  it("keeps shared subscribers from cancelling an instrument still owned by another request", () => {
    expect(source).toMatch(/subscriberCounts: Map<string, number>/);
    expect(source).toMatch(/function cancelQueuedMarketDataUpdate/);
    expect(source).toMatch(/request\.bindings/);
  });

  it("publishes a fresh in-memory storage-error receipt when terminal persistence fails", () => {
    expect(source).toMatch(/const failedJob: MarketDataJob = \{/);
    expect(source).toMatch(/status: "storage-error"/);
    expect(source).toMatch(/marketDataJobsRef\.current\[instrumentId\] = failedJob/);
  });

  it("runs the real public coordinator once for overlapping pending supplements", async () => {
    const harness = createCoordinatorHarness();
    const first = harness.start(["A", "B"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const second = harness.start(["B", "C"], { includeIntraday: false });
    const third = harness.start(["B", "D"], { includeIntraday: false });
    const fourth = harness.start(["B", "C"], { includeIntraday: false });
    harness.releaseFirst();
    await expect(Promise.all([first, second, third, fourth])).resolves.toEqual([true, true, true, true]);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A", "B"], ["C"], ["D"]]);
  });

  it("does not authenticate an old job when the shared producer was aborted", async () => {
    const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let callback: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "onRefreshHoldingsValuation") {
        callback = (node.initializer as ts.JsxExpression).expression;
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(callback).toBeDefined();
    const body = ts.transpileModule(`return (${callback!.getText(ast)});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const controller = new AbortController();
    controller.abort();
    const active = { current: new Map([["holdings:daily:A,B", {
      snapshotIds: new Set(["A", "B"]),
      controller,
    }]]) };
    const jobs = { current: { B: {
      requestedAt: "2020-01-01T00:00:00Z",
      status: "complete",
      intervals: [{ interval: "1D", status: "complete" }],
    } } };
    const callbackFn = new Function(
      "showDemo", "marketDataJobsRef", "activeMarketRefreshRuns", "startMarketDataUpdate", body,
    )(false, jobs, active, async () => true);
    await expect(callbackFn(["B"], "manual")).resolves.toEqual({ ok: false, reason: "cancelled" });
  });

  it("executes the extracted coordinator with real lock and cancellation ownership", async () => {
    const harness = createCoordinatorHarness();
    const first = harness.start(["A", "B"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const second = harness.start(["B", "C"], { includeIntraday: false });
    const third = harness.start(["B", "D"], { includeIntraday: false });
    harness.releaseFirst();
    await expect(Promise.all([first, second, third])).resolves.toEqual([true, true, true]);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A", "B"], ["C"], ["D"]]);
  });

  it("captures completed coverage across public and holdings arrivals", async () => {
    const harness = createCoordinatorHarness();
    const first = harness.start(["A", "B"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const publicD = harness.start(["D"], { includeIntraday: false, defer: true });
    const holdingsBC = harness.start(["B", "C"], { includeIntraday: false, holdingsScope: true, batch: true });
    harness.releaseFirst();
    for (let i = 0; i < 20 && harness.runs.length < 2; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    harness.releaseDeferred();
    await expect(Promise.all([first, publicD, holdingsBC])).resolves.toEqual([true, true, true]);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A", "B"], ["D"], ["C"]]);
  });

  it("lets a queued holdings daily request share a queued public full producer", async () => {
    const harness = createCoordinatorHarness();
    const first = harness.start(["E"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const publicFull = harness.start(["A", "B"], { includeIntraday: true, defer: true });
    const holdingsDaily = harness.start(["B"], { includeIntraday: false, holdingsScope: true, batch: true });
    harness.releaseFirst();
    for (let i = 0; i < 20 && harness.runs.length < 2; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    harness.releaseDeferred();
    await expect(Promise.all([first, publicFull, holdingsDaily])).resolves.toEqual([true, true, true]);
    expect(harness.runs.map((run) => [run.ids, run.options.includeIntraday])).toEqual([
      [["E"], false],
      [["A", "B"], true],
    ]);
  });

  it("starts a new producer after the prior producer has settled", async () => {
    const harness = createCoordinatorHarness();
    const first = harness.start(["A"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    harness.releaseFirst();
    await expect(first).resolves.toBe(true);
    const retry = harness.start(["A"], { includeIntraday: false });
    await expect(retry).resolves.toBe(true);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A"], ["A"]]);
  });

  it("settles a producer promise when the queued producer throws", async () => {
    const harness = createCoordinatorHarness();
    await expect(harness.start(["A"], { includeIntraday: false, throw: true })).resolves.toBe(false);
    await expect(harness.start(["A"], { includeIntraday: false })).resolves.toBe(true);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A"], ["A"]]);
  });

  it("does not let an immediate retry capture an all-owner-cancelled producer", async () => {
    const harness = createCoordinatorHarness();
    const cancelled = harness.start(["A"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    harness.cancel(["A"]);
    const retry = harness.start(["A"], { includeIntraday: false });
    harness.releaseFirst();
    await expect(cancelled).resolves.toBe(false);
    await expect(retry).resolves.toBe(true);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A"], ["A"]]);
  });

  it("keeps queued holdings cancellation separate from an active public subscriber", async () => {
    const harness = createCoordinatorHarness();
    const active = harness.start(["A", "B"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const queuedHoldings = harness.start(["B", "C"], { includeIntraday: false, holdingsScope: true, batch: true });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    harness.cancel(["B", "C"]);
    harness.releaseFirst();
    await expect(queuedHoldings).resolves.toBe(false);
    await expect(active).resolves.toBe(true);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A", "B"]]);
  });

  it("routes both daily/full queued modes through captured coordinator runs", async () => {
    const harness = createCoordinatorHarness();
    const daily = harness.start(["A"], { includeIntraday: false });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const full = harness.start(["A"], { includeIntraday: true });
    harness.releaseFirst();
    await expect(Promise.all([daily, full])).resolves.toEqual([true, true]);
    expect(harness.runs.map((run) => [run.ids, run.options.includeIntraday])).toEqual([
      [["A"], false],
      [["A"], true],
    ]);
  });

  it("cancels a queued holdings subscriber through cancelQueued without aborting another run", async () => {
    const harness = createCoordinatorHarness();
    const active = harness.start(["A", "B"], { includeIntraday: false, holdingsScope: true, batch: true });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const queued = harness.start(["B", "C"], { includeIntraday: false, holdingsScope: true, batch: true });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    harness.cancelQueued(["B", "C"]);
    harness.releaseFirst();
    await expect(queued).resolves.toBe(false);
    await expect(active).resolves.toBe(true);
    expect(harness.runs).toHaveLength(1);
  });

  it("routes an un-targeted global cancel to the public subscriber", async () => {
    const harness = createCoordinatorHarness();
    const global = harness.start(["A"], { includeIntraday: false, batch: true });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const holdings = harness.start(["B"], { includeIntraday: false, holdingsScope: true, batch: true });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    harness.cancel();
    harness.releaseFirst();
    await expect(global).resolves.toBe(false);
    await expect(holdings).resolves.toBe(true);
    expect(harness.runs.map((run) => run.ids)).toEqual([["A"], ["B"]]);
  });

  it("returns a finite failure for a terminal storage-error job with the real start entry", async () => {
    const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let callback: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "onRefreshHoldingsValuation") {
        callback = (node.initializer as ts.JsxExpression).expression;
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(callback).toBeDefined();
    const callbackBody = ts.transpileModule(`return (${callback!.getText(ast)});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const harness = createCoordinatorHarness();
    const jobs = { current: { B: {
      instrumentId: "B",
      requestedAt: "2026-10-06T00:00:00Z",
      status: "storage-error",
      intervals: [{ interval: "1D", status: "storage-error" }],
    } } };
    const callbackFn = new Function(
      "showDemo", "marketDataJobsRef", "activeMarketRefreshRuns", "startMarketDataUpdate", callbackBody,
    )(false, jobs, harness.active, harness.start);
    const result = callbackFn(["B"], "manual") as Promise<unknown>;
    for (let i = 0; i < 12; i++) await Promise.resolve();
    harness.releaseFirst();
    await expect(result).resolves.toEqual({ ok: false, reason: "failed" });
  });
});
