import { describe, expect, it } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type {
  HoldingsHistoryWorkerInput,
  HoldingsHistoryWorkerResponseMessage,
} from "../../lib/reviews/holdings-history-worker-protocol";
import { computeHoldingsHistory } from "../../lib/reviews/holdings-history-worker-protocol";
import type { RoomScope } from "../../lib/reviews/trading-room-scope";
import { ComputingHoldingsHistoryWorker } from "./computing-holdings-history-worker";

function scope(): RoomScope {
  return {
    nature: "live",
    assetCategory: "all",
    period: { preset: "custom", startDate: "2026-09-01", endDate: "2026-09-05" },
    simulationRunId: null,
    accountIds: [],
    instrumentIds: [],
    markets: [],
    currencies: [],
    reviewStatuses: [],
  };
}

function input(identity = "history-worker-test"): HoldingsHistoryWorkerInput {
  return {
    identity,
    entries: [] as TradeLibraryEntry[],
    observationScope: scope(),
    currentDayScope: scope(),
    asOf: "2026-09-05T12:00:00.000Z",
  };
}

async function flushWorkerTask(): Promise<void> {
  await Promise.resolve();
}

describe("ComputingHoldingsHistoryWorker", () => {
  it("computes the real history result asynchronously and preserves the request id", async () => {
    const worker = new ComputingHoldingsHistoryWorker();
    const value = input();
    const responses: HoldingsHistoryWorkerResponseMessage[] = [];
    worker.onmessage = event => responses.push(event.data);

    worker.postMessage({ requestId: 17, input: value });

    expect(responses).toEqual([]);
    await flushWorkerTask();

    expect(responses).toEqual([{ requestId: 17, result: computeHoldingsHistory(value) }]);
  });

  it("returns compute failures through the worker response error protocol", async () => {
    const worker = new ComputingHoldingsHistoryWorker();
    const responses: HoldingsHistoryWorkerResponseMessage[] = [];
    worker.onmessage = event => responses.push(event.data);
    const invalidInput = { ...input("history-worker-error"), entries: null } as unknown as HoldingsHistoryWorkerInput;

    worker.postMessage({ requestId: 23, input: invalidInput });
    await flushWorkerTask();

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({ requestId: 23, error: expect.any(String) });
  });

  it("ignores a queued response after terminate", async () => {
    const worker = new ComputingHoldingsHistoryWorker();
    const responses: HoldingsHistoryWorkerResponseMessage[] = [];
    worker.onmessage = event => responses.push(event.data);

    worker.postMessage({ requestId: 31, input: input("history-worker-disposed") });
    worker.terminate();
    await flushWorkerTask();

    expect(responses).toEqual([]);
  });
});
