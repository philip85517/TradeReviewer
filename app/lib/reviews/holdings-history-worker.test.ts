import { afterEach, describe, expect, it } from "vitest";

import type { TradeLibraryEntry } from "../trades/library";
import type { RoomScope } from "./trading-room-scope";
import type {
  HoldingsHistoryWorkerInput,
  HoldingsHistoryWorkerLike,
  HoldingsHistoryWorkerRequestMessage,
  HoldingsHistoryWorkerResponseMessage,
} from "./holdings-history-worker";
import type { HoldingsHistoryModel } from "./trading-room-history";
import { computeHoldingsHistory, createHoldingsHistoryWorkerController } from "./holdings-history-worker";

function scope(startDate: string, endDate = startDate): RoomScope {
  return {
    nature: "live",
    assetCategory: "all",
    period: { preset: "custom", startDate, endDate },
    simulationRunId: null,
    accountIds: [],
    instrumentIds: [],
    markets: [],
    currencies: [],
    reviewStatuses: [],
  };
}

function input(identity: string, startDate = "2026-09-01"): HoldingsHistoryWorkerInput {
  const observationScope = scope(startDate, "2026-09-05");
  return {
    identity,
    entries: [] as TradeLibraryEntry[],
    observationScope,
    currentDayScope: scope("2026-09-05"),
    asOf: "2026-09-05T12:00:00.000Z",
  };
}

function model(inputValue: HoldingsHistoryWorkerInput, marker: string): HoldingsHistoryModel {
  return {
    points: [],
    start: inputValue.observationScope.period.startDate,
    end: inputValue.observationScope.period.endDate,
    reasons: [marker],
    scope: inputValue.observationScope,
    fxSnapshotId: null,
  };
}

function result(inputValue: HoldingsHistoryWorkerInput, marker: string) {
  return {
    observation: model(inputValue, `${marker}:observation`),
    currentDay: model(inputValue, `${marker}:current-day`),
  };
}

class FakeWorker implements HoldingsHistoryWorkerLike {
  readonly messages: HoldingsHistoryWorkerRequestMessage[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<HoldingsHistoryWorkerResponseMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: HoldingsHistoryWorkerRequestMessage): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(message: HoldingsHistoryWorkerResponseMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<HoldingsHistoryWorkerResponseMessage>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

describe("holdings history worker controller", () => {
  const workers: FakeWorker[] = [];
  const controllers: Array<{ terminate(): void }> = [];

  afterEach(() => {
    controllers.splice(0).forEach(controller => controller.terminate());
    workers.splice(0);
  });

  function setup() {
    const controller = createHoldingsHistoryWorkerController({
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      fallback: value => result(value, "fallback"),
    });
    controllers.push(controller);
    return controller;
  }

  it("keeps the last successful model for same-scope refreshes and publishes two successful updates", () => {
    const controller = setup();
    const first = input("same-scope");
    const second = { ...first, entries: [] as TradeLibraryEntry[] };

    controller.request(first);
    expect(controller.getState()).toMatchObject({ identity: "same-scope", pending: true, result: null });
    workers[0].respond({ requestId: controller.getState().activeRequestId!, result: result(first, "first") });
    expect(controller.getState()).toMatchObject({ pending: false, error: null });
    expect(controller.getState().resultInput).toBe(first);
    expect(controller.getState().result?.observation.reasons).toEqual(["first:observation"]);

    controller.request(second);
    expect(controller.getState()).toMatchObject({ identity: "same-scope", pending: true });
    expect(controller.getState().result?.observation.reasons).toEqual(["first:observation"]);
    workers[0].respond({ requestId: controller.getState().activeRequestId!, result: result(second, "second") });
    expect(controller.getState()).toMatchObject({ pending: false, error: null });
    expect(controller.getState().resultInput).toBe(second);
    expect(controller.getState().result?.observation.reasons).toEqual(["second:observation"]);
  });

  it("merges pending requests and ignores an old response before publishing the newest generation", () => {
    const controller = setup();
    const first = input("scope-a", "2026-09-01");
    const second = input("scope-b", "2026-09-02");
    const third = input("scope-c", "2026-09-03");

    controller.request(first);
    const firstRequestId = controller.getState().activeRequestId!;
    controller.request(second);
    controller.request(third);
    expect(workers[0].messages).toHaveLength(1);
    workers[0].respond({ requestId: firstRequestId, result: result(first, "stale") });
    expect(workers[0].messages).toHaveLength(2);
    expect(workers[0].messages[1].input.identity).toBe("scope-c");
    expect(workers[0].messages[1].input.observationScope.period.startDate).toBe("2026-09-03");
    expect(controller.getState().result).toBeNull();

    const latestRequestId = controller.getState().activeRequestId!;
    workers[0].respond({ requestId: latestRequestId, result: result(third, "latest") });
    expect(controller.getState().result?.observation.reasons).toEqual(["latest:observation"]);
    expect(controller.getState().pending).toBe(false);
  });

  it("publishes the first valid same-scope snapshot while a newer refresh is pending", () => {
    const controller = setup();
    const first = input("same-scope");
    const second = { ...first, entries: [] as TradeLibraryEntry[] };

    controller.request(first);
    const firstRequestId = controller.getState().activeRequestId!;
    controller.request(second);
    workers[0].respond({ requestId: firstRequestId, result: result(first, "first") });
    expect(controller.getState()).toMatchObject({ pending: true });
    expect(controller.getState().result?.observation.reasons).toEqual(["first:observation"]);
    expect(workers[0].messages).toHaveLength(2);

    const latestRequestId = controller.getState().activeRequestId!;
    workers[0].respond({ requestId: latestRequestId, result: result(second, "second") });
    expect(controller.getState()).toMatchObject({ pending: false, error: null });
    expect(controller.getState().result?.observation.reasons).toEqual(["second:observation"]);
  });

  it("publishes a compatible cold snapshot while a forward identity is queued", () => {
    const controller = setup();
    const first = input("initial");
    const forward = { ...first, identity: "forward", asOf: "2026-09-05T13:00:00.000Z" };

    controller.request(first);
    controller.request(forward);
    const firstRequestId = controller.getState().activeRequestId!;
    workers[0].respond({ requestId: firstRequestId, result: result(first, "first") });

    expect(controller.getState()).toMatchObject({ identity: "forward", pending: true });
    expect(controller.getState().result).toBeNull();
    expect(controller.getState().completedResult?.observation.reasons).toEqual(["first:observation"]);
    expect(controller.getState().completedInput).toBe(first);
    expect(workers[0].messages).toHaveLength(2);
  });

  it("clears the previous display when the scope or period identity changes", () => {
    const controller = setup();
    const first = input("scope-a", "2026-09-01");
    controller.request(first);
    const firstRequestId = controller.getState().activeRequestId!;
    workers[0].respond({ requestId: firstRequestId, result: result(first, "first") });
    expect(controller.getState().result).not.toBeNull();

    const changed = input("scope-b", "2026-09-02");
    controller.request(changed);
    expect(controller.getState()).toMatchObject({ identity: "scope-b", pending: true, result: null, resultInput: null });
  });

  it("surfaces worker failure with a fallback result and retries the latest input", () => {
    const controller = setup();
    const value = input("retryable");
    controller.request(value);
    workers[0].fail("worker exploded");
    expect(controller.getState()).toMatchObject({ pending: false, error: "worker exploded" });
    expect(controller.getState().result?.observation.reasons).toEqual(["fallback:observation"]);
    expect(workers[0].terminated).toBe(true);

    controller.retry();
    expect(workers).toHaveLength(2);
    const retryRequestId = controller.getState().activeRequestId!;
    workers[1].respond({ requestId: retryRequestId, result: result(value, "retried") });
    expect(controller.getState()).toMatchObject({ pending: false, error: null });
    expect(controller.getState().result?.observation.reasons).toEqual(["retried:observation"]);
  });

  it("computes the observation and current-day windows from one fixed input snapshot", () => {
    const value = input("fixed-snapshot");
    const computed = computeHoldingsHistory(value);
    expect(computed.observation.scope).toEqual(value.observationScope);
    expect(computed.currentDay.scope).toEqual(value.currentDayScope);
    expect(computed.observation.fxSnapshotId).toBeNull();
    expect(computed.currentDay.fxSnapshotId).toBeNull();
  });

  it("terminates an active worker on disposal and ignores its late response", () => {
    const controller = setup();
    const value = input("disposed");
    controller.request(value);
    const requestId = controller.getState().activeRequestId!;
    controller.terminate();
    expect(workers[0].terminated).toBe(true);
    workers[0].respond({ requestId, result: result(value, "late") });
    expect(controller.getState().result).toBeNull();
  });
});
