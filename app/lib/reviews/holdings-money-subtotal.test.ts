import { describe, expect, it } from "vitest";

import { buildRoomMoneyView } from "./trading-room-scope";
import {
  buildRoomMoneySubtotal,
  type RoomMoneyMemberAmount,
} from "./holdings-money-subtotal";

const partialFx = {
  id: "fx-partial",
  baseCurrency: "CNY" as const,
  asOf: "2026-10-09",
  source: "fixture",
  status: "partial" as const,
  rates: {},
};

const completeFx = {
  id: "fx-complete",
  baseCurrency: "CNY" as const,
  asOf: "2026-10-09",
  source: "fixture",
  status: "complete" as const,
  rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
};

function amount(memberKey: string, currency: string, value: string | null): RoomMoneyMemberAmount {
  return { memberKey, currency, amount: value };
}

describe("buildRoomMoneySubtotal", () => {
  it("keeps native CNY while excluding a USD row with missing FX", () => {
    const rows = [amount("cny-1", "CNY", "10"), amount("usd-1", "USD", "2")];

    expect(buildRoomMoneySubtotal(rows, partialFx, "CNY")).toMatchObject({
      value: "10",
      currency: "CNY",
      available: 1,
      total: 2,
      complete: false,
      memberKeys: ["cny-1"],
    });
    expect(buildRoomMoneyView(rows, partialFx, "CNY").convertedCny).toBeNull();
  });

  it("converts known foreign rows and excludes a missing quote", () => {
    expect(buildRoomMoneySubtotal([
      amount("usd-1", "USD", "2"),
      amount("usd-2", "USD", null),
    ], completeFx, "CNY")).toMatchObject({
      value: "14",
      currency: "CNY",
      available: 1,
      total: 2,
      complete: false,
      memberKeys: ["usd-1"],
    });
  });

  it("rejects an invalid currency without treating it as zero", () => {
    expect(buildRoomMoneySubtotal([amount("bad", "", "3")], completeFx, "CNY")).toMatchObject({
      value: null,
      currency: null,
      available: 0,
      total: 1,
      complete: false,
      memberKeys: [],
    });
  });

  it("reports all missing rows and treats an empty holdings set as complete", () => {
    expect(buildRoomMoneySubtotal([
      amount("missing-1", "CNY", null),
      amount("missing-2", "USD", "bad"),
    ], completeFx, "CNY")).toMatchObject({ available: 0, total: 2, complete: false, memberKeys: [] });
    expect(buildRoomMoneySubtotal([], completeFx, "CNY")).toMatchObject({
      value: null, currency: null, available: 0, total: 0, complete: true, memberKeys: [],
    });
  });
});
