import { describe, expect, it } from "vitest";

import { getDemoReplayFrame } from "./server-replay-provider";

describe("getDemoReplayFrame completed-bar knowledge", () => {
  it("keeps the 14:30 bar hidden until 14:45 across restore and navigation", () => {
    const immediatelyBeforeCompletion = getDemoReplayFrame({
      cursor: "2025-01-02T14:44:59.999Z",
      mode: "restore",
    });
    const legacyBarStartRestore = getDemoReplayFrame({
      cursor: "2025-01-02T14:30:00.000Z",
      mode: "restore",
    });
    const completed = getDemoReplayFrame({
      cursor: "2025-01-02T14:45:00.000Z",
      mode: "restore",
    });
    const nextFromLegacyBarStart = getDemoReplayFrame({
      cursor: "2025-01-02T14:30:00.000Z",
      mode: "next",
    });

    expect(immediatelyBeforeCompletion.cursor).toBe(
      "2025-01-02T14:44:59.999Z",
    );
    expect(immediatelyBeforeCompletion.candles15m).toEqual([]);
    expect(legacyBarStartRestore.candles15m).toEqual([]);
    expect(completed.cursor).toBe("2025-01-02T14:45:00.000Z");
    expect(completed.candles15m).toHaveLength(1);
    expect(completed.candles15m[0]).toMatchObject({
      time: "2025-01-02T14:30:00.000Z",
      knowledgeAt: "2025-01-02T14:45:00.000Z",
    });
    expect(nextFromLegacyBarStart.cursor).toBe(
      "2025-01-02T14:45:00.000Z",
    );
    expect(nextFromLegacyBarStart.candles15m).toHaveLength(1);
  });
});
