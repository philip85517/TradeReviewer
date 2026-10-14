import { describe, expect, it } from "vitest";

import {
  bindHoldingsOwnedProgressRun,
  createHoldingsOwnedProgress,
  holdingsOwnedProgressDetail,
  setHoldingsOwnedProgressPhase,
  settleHoldingsOwnedProgress,
} from "./holdings-owned-progress";

describe("holdings-owned-progress", () => {
  it("counts each required ID once for the current run", () => {
    const ids = ["US:SPY", "US:NIO", "US:XPEV"];
    let progress = createHoldingsOwnedProgress({ generation: 7, runId: 101, requiredIds: ids });

    expect(holdingsOwnedProgressDetail(progress)).toBe("0/3 个标的已处理");
    progress = settle(progress, 101, ids[0], "complete");
    expect(holdingsOwnedProgressDetail(progress)).toBe("1/3 个标的已处理");
    progress = settle(progress, 101, ids[0], "complete");
    expect(holdingsOwnedProgressDetail(progress)).toBe("1/3 个标的已处理");
    progress = settle(progress, 101, ids[1], "partial");
    progress = settle(progress, 101, ids[2], "complete");
    expect(progress.settledIds).toEqual(ids);
    expect(holdingsOwnedProgressDetail(progress)).toBe("3/3 个标的已处理");
  });

  it("replays a shared run without double counting and accepts a current split run", () => {
    const ids = ["US:SPY", "US:NIO"];
    let progress = createHoldingsOwnedProgress({ generation: 8, runId: 201, requiredIds: ids });
    progress = settle(progress, 201, ids[0], "complete");
    progress = bindHoldingsOwnedProgressRun(progress, 202);
    progress = settle(progress, 202, ids[0], "complete");
    progress = settle(progress, 202, ids[1], "complete");
    expect(progress.runIds).toEqual([201, 202]);
    expect(progress.settledIds).toEqual(ids);
    expect(holdingsOwnedProgressDetail(progress)).toBe("2/2 个标的已处理");
  });

  it("rejects old generation/run callbacks and keeps cancellation terminal", () => {
    const ids = ["US:QQQ", "US:DIA"];
    let progress = createHoldingsOwnedProgress({ generation: 9, runId: 301, requiredIds: ids });
    const before = settleHoldingsOwnedProgress(progress, {
      generation: 8,
      runId: 301,
      instrumentId: ids[0],
      status: "complete",
    });
    expect(before).toBe(progress);
    const staleRun = settleHoldingsOwnedProgress(progress, {
      generation: 9,
      runId: 300,
      instrumentId: ids[0],
      status: "complete",
    });
    expect(staleRun).toBe(progress);

    progress = setHoldingsOwnedProgressPhase(progress, { generation: 9, runId: 301, phase: "cancelled" });
    progress = settle(progress, 301, ids[0], "complete");
    expect(progress.settledIds).toEqual([]);
    expect(progress.phase).toBe("cancelled");
  });

  it("marks a cache-only current settlement without claiming provider delivery", () => {
    const id = "US:AMD";
    const progress = settle(
      createHoldingsOwnedProgress({ generation: 10, runId: 401, requiredIds: [id] }),
      401,
      id,
      "complete",
      true,
    );
    expect(progress.settledIds).toEqual([id]);
    expect(progress.cacheOnlyIds).toEqual([id]);
    expect(progress.terminalById[id]).toBe("complete");
  });
});

function settle(
  progress: ReturnType<typeof createHoldingsOwnedProgress>,
  runId: number,
  instrumentId: string,
  status: "complete" | "partial" | "failed" | "cancelled",
  cacheOnly = false,
) {
  return settleHoldingsOwnedProgress(progress, {
    generation: progress.generation,
    runId,
    instrumentId,
    status,
    cacheOnly,
  });
}
