import { expect, it } from "vitest";
import { intradayReplayRestriction } from "./replay-precision";

it("blocks intraday replay for a date-only transfer, even when fills have precise times", () => {
  expect(intradayReplayRestriction({ executions: [], positionEvents: [{ id: "t", accountId: "a", kind: "transfer-in", date: "2025-01-02", quantity: "100", description: "transfer", source: [] }] })).toContain("持仓事件只有日期");
  expect(intradayReplayRestriction({ executions: [], accuracy: { pnl: "unavailable", reasons: ["ambiguous-event-order"] } })).toBeDefined();
  expect(intradayReplayRestriction({ executions: [], accuracy: { pnl: "unavailable", reasons: ["unknown-fees"] } })).toBeUndefined();
});
