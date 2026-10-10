import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  HoldingsHistoryWorkerLike,
  HoldingsHistoryWorkerRequestMessage,
  HoldingsHistoryWorkerResponseMessage,
  HoldingsHistoryWorkerResult,
} from "../../lib/reviews/holdings-history-worker";
import { buildHoldingsHistory } from "../../lib/reviews/trading-room-history";
import { buildRoomMoneyView, type RoomScope } from "../../lib/reviews/trading-room-scope";
import { useHoldingsHistoryWorker, type UseHoldingsHistoryWorkerInput } from "./use-holdings-history-worker";

function scope(): RoomScope {
  return {
    nature: "live",
    assetCategory: "all",
    period: { preset: "custom", startDate: "2026-09-01", endDate: "2026-09-01" },
    simulationRunId: null,
    accountIds: [],
    instrumentIds: [],
    markets: [],
    currencies: [],
    reviewStatuses: [],
  };
}

function input(): UseHoldingsHistoryWorkerInput {
  return {
    identity: "strict-mode",
    entries: [],
    observationScope: scope(),
    currentDayScope: scope(),
    asOf: "2026-09-01T12:00:00.000Z",
  };
}

class PassiveWorker implements HoldingsHistoryWorkerLike {
  readonly messages: HoldingsHistoryWorkerRequestMessage[] = [];
  terminated = 0;
  onmessage: ((event: MessageEvent<HoldingsHistoryWorkerResponseMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: HoldingsHistoryWorkerRequestMessage): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated += 1;
  }
}

function resultFor(value: UseHoldingsHistoryWorkerInput, reason: string, amount = "100"): HoldingsHistoryWorkerResult {
  const observation = buildHoldingsHistory([], { scope: value.observationScope, asOf: value.asOf });
  const currentDay = buildHoldingsHistory([], { scope: value.currentDayScope, asOf: value.asOf });
  observation.points = observation.points.map(point => ({ ...point, marketValue: buildRoomMoneyView([{ currency: "USD", amount }]), marketValueAvailable: true }));
  currentDay.points = currentDay.points.map(point => ({ ...point, marketValue: buildRoomMoneyView([{ currency: "USD", amount }]), marketValueAvailable: true }));
  observation.reasons = [reason];
  currentDay.reasons = [reason];
  return { observation, currentDay };
}

function respond(worker: PassiveWorker, value: UseHoldingsHistoryWorkerInput, reason: string, index = 0, amount = "100"): void {
  const request = worker.messages[index];
  worker.onmessage?.({ data: { requestId: request.requestId, result: resultFor(value, reason, amount) } } as MessageEvent<HoldingsHistoryWorkerResponseMessage>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useHoldingsHistoryWorker lifecycle", () => {
  it("does not dispose the controller during StrictMode's probe cleanup, then terminates on unmount", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker {
      constructor() {
        super();
        workers.push(this);
      }
    });
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const value = input();
    const hook = renderHook(() => useHoldingsHistoryWorker(value), { wrapper });

    await act(async () => { await Promise.resolve(); });
    expect(workers).toHaveLength(1);
    expect(workers[0].terminated).toBe(0);
    expect(hook.result.current.pending).toBe(true);
    expect(hook.result.current.acceptedInput).toBeNull();

    hook.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(workers[0].terminated).toBe(1);
  });

  it("displays the first cold same-identity result while the newer input is pending", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker { constructor() { super(); workers.push(this); } });
    const first = input();
    const hook = renderHook(({ value }: { value: UseHoldingsHistoryWorkerInput }) => useHoldingsHistoryWorker(value), { initialProps: { value: first } });
    await act(async () => { await Promise.resolve(); });
    const later = { ...first, asOf: "2026-09-01T13:00:00.000Z" };
    hook.rerender({ value: later });
    respond(workers[0], first, "first", 0, "100");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.holdingsHistoryModel.points[0].marketValue.originalByCurrency.USD).toBe("100");
    expect(hook.result.current.statusReason).toContain("持仓历史正在更新");
    expect(hook.result.current.acceptedInput).toBeNull();
  });

  it("displays the first cold forward-identity result without acknowledging it", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker { constructor() { super(); workers.push(this); } });
    const first = input();
    const hook = renderHook(({ value }: { value: UseHoldingsHistoryWorkerInput }) => useHoldingsHistoryWorker(value), { initialProps: { value: first } });
    await act(async () => { await Promise.resolve(); });
    const later = { ...first, identity: "forward", asOf: "2026-09-01T13:00:00.000Z" };
    hook.rerender({ value: later });
    respond(workers[0], first, "first", 0, "100");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.holdingsHistoryModel.points[0].marketValue.originalByCurrency.USD).toBe("100");
    expect(hook.result.current.statusReason).toContain("持仓历史正在更新");
    expect(hook.result.current.acceptedInput).toBeNull();
  });

  it("shows each compatible completed result through a continuously queued refresh", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker { constructor() { super(); workers.push(this); } });
    const first = input();
    const hook = renderHook(({ value }: { value: UseHoldingsHistoryWorkerInput }) => useHoldingsHistoryWorker(value), { initialProps: { value: first } });
    await act(async () => { await Promise.resolve(); });
    const second = { ...first, identity: "second", asOf: "2026-09-01T13:00:00.000Z" };
    hook.rerender({ value: second });
    respond(workers[0], first, "first", 0, "100");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.holdingsHistoryModel.points[0].marketValue.originalByCurrency.USD).toBe("100");
    const latest = { ...second, identity: "latest", asOf: "2026-09-01T14:00:00.000Z" };
    hook.rerender({ value: latest });
    respond(workers[0], second, "second", 1, "150");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.holdingsHistoryModel.points[0].marketValue.originalByCurrency.USD).toBe("150");
    expect(hook.result.current.acceptedInput).toBeNull();
    respond(workers[0], latest, "latest", 2, "200");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.holdingsHistoryModel.points[0].marketValue.originalByCurrency.USD).toBe("200");
    expect(hook.result.current.acceptedInput).toBe(hook.result.current.currentInput);
  });

  it("retains the accepted snapshot while a same-scope forward recomputation is pending", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker { constructor() { super(); workers.push(this); } });
    const first = input();
    const hook = renderHook(({ value }: { value: UseHoldingsHistoryWorkerInput }) => useHoldingsHistoryWorker(value), { initialProps: { value: first } });
    await act(async () => { await Promise.resolve(); });
    respond(workers[0], first, "accepted");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.holdingsHistoryModel.reasons).toContain("accepted");
    expect(hook.result.current.acceptedInput).toBe(hook.result.current.currentInput);

    const later = { ...first, identity: "strict-mode-forward", asOf: "2026-09-01T13:00:00.000Z" };
    hook.rerender({ value: later });
    expect(hook.result.current.pending).toBe(true);
    expect(hook.result.current.acceptedInput).toBeNull();
    expect(hook.result.current.holdingsHistoryModel.points.length).toBeGreaterThan(0);
    expect(hook.result.current.holdingsHistoryModel.reasons.some(reason => reason.startsWith("持仓历史正在更新"))).toBe(true);
    expect(hook.result.current.holdingsHistoryModel.reasons).toContain("accepted");
  });

  it("associates the completed result with the exact requested input before replacing the snapshot", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker { constructor() { super(); workers.push(this); } });
    const first = input();
    const hook = renderHook(({ value }: { value: UseHoldingsHistoryWorkerInput }) => useHoldingsHistoryWorker(value), { initialProps: { value: first } });
    await act(async () => { await Promise.resolve(); });
    respond(workers[0], first, "old", 0, "100");
    await act(async () => { await Promise.resolve(); });
    const later = { ...first, identity: "strict-mode-forward", asOf: "2026-09-01T13:00:00.000Z" };
    hook.rerender({ value: later });
    expect(hook.result.current.holdingsHistoryModel.reasons).toContain("old");
    const updated = { ...later, candlesByInstrument: { refreshed: [] } };
    hook.rerender({ value: updated });
    respond(workers[0], later, "intermediate", 1, "150");
    await act(async () => { await Promise.resolve(); });
    respond(workers[0], updated, "new", 2, "200");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.holdingsHistoryModel.reasons).toContain("new");
    expect(hook.result.current.holdingsHistoryModel.reasons).not.toContain("old");
    expect(hook.result.current.holdingsHistoryModel.points[0].marketValue.originalByCurrency.USD).toBe("200");
    expect(hook.result.current.acceptedInput).toBe(hook.result.current.currentInput);
  });

  it("clears retained data for scope changes and as-of rewinds", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker { constructor() { super(); workers.push(this); } });
    const first = input();
    const hook = renderHook(({ value }: { value: UseHoldingsHistoryWorkerInput }) => useHoldingsHistoryWorker(value), { initialProps: { value: first } });
    await act(async () => { await Promise.resolve(); });
    respond(workers[0], first, "accepted");
    await act(async () => { await Promise.resolve(); });
    const changedScope = { ...first, observationScope: { ...first.observationScope, accountIds: ["changed"] } };
    hook.rerender({ value: changedScope });
    expect(hook.result.current.holdingsHistoryModel.points).toHaveLength(0);
    hook.rerender({ value: { ...first, asOf: "2026-08-31T23:00:00.000Z" } });
    expect(hook.result.current.holdingsHistoryModel.points).toHaveLength(0);
  });

  it("retains valid data with an error status when the forward worker falls back", async () => {
    const workers: PassiveWorker[] = [];
    vi.stubGlobal("Worker", class extends PassiveWorker { constructor() { super(); workers.push(this); } });
    const first = input();
    const hook = renderHook(({ value }: { value: UseHoldingsHistoryWorkerInput }) => useHoldingsHistoryWorker(value), { initialProps: { value: first } });
    await act(async () => { await Promise.resolve(); });
    respond(workers[0], first, "accepted");
    await act(async () => { await Promise.resolve(); });
    const later = { ...first, identity: "strict-mode-forward", asOf: "2026-09-01T13:00:00.000Z" };
    hook.rerender({ value: later });
    workers[0].onerror?.({ message: "boom" } as ErrorEvent);
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.error).toContain("boom");
    expect(hook.result.current.holdingsHistoryModel.points.length).toBeGreaterThan(0);
    expect(hook.result.current.holdingsHistoryModel.reasons.some(reason => reason.includes("持仓历史计算失败"))).toBe(true);
    expect(hook.result.current.holdingsHistoryModel.reasons.some(reason => reason.includes("沿用上次快照"))).toBe(true);
  });
});
