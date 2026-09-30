import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  HoldingsHistoryWorkerLike,
  HoldingsHistoryWorkerRequestMessage,
  HoldingsHistoryWorkerResponseMessage,
} from "../../lib/reviews/holdings-history-worker";
import type { RoomScope } from "../../lib/reviews/trading-room-scope";
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

    hook.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(workers[0].terminated).toBe(1);
  });
});
