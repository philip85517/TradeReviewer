import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { buildRoomMoneyView } from "../../lib/reviews/trading-room-scope";
import type { RoomContributionModel } from "../../lib/reviews/trading-room-contribution";
import { RoomContribution } from "./room-contribution";
afterEach(cleanup);
const positive = { id: "a", label: "同名账户", detail: "独立账户", count: 1, episodeIds: ["a"], money: buildRoomMoneyView([{ currency: "USD", amount: "10" }]) };
const negative = { ...positive, id: "b", detail: "独立账户", money: buildRoomMoneyView([{ currency: "USD", amount: "-10" }]) };
const model: RoomContributionModel = { dimensions: { market: [{ ...positive, label: "美股" }], instrument: [], account: [positive, negative] }, total: buildRoomMoneyView([{ currency: "USD", amount: "0" }]), includedCount: 2, excluded: [{ episodeId: "bad", reason: "费用未知" }] };
it("switches dimension with stable identities and signed bars even when net total is zero", () => {
  render(<RoomContribution model={model} />);
  fireEvent.click(screen.getByRole("button", { name: "账户" }));
  const contribution = screen.getByRole("region", { name: "盈亏贡献分解" });
  expect(within(contribution).getByTitle("a")).toBeInTheDocument();
  expect(within(contribution).getByTitle("b")).toBeInTheDocument();
  expect(contribution.querySelector('[data-contribution-sign="negative"]')).toBeInTheDocument();
  expect(contribution.querySelector('[data-contribution-sign="positive"]')).toBeInTheDocument();
  expect(contribution).not.toHaveTextContent("%");
  expect(contribution).toHaveTextContent("费用未知");
});

it("renders a selected target currency only when the shared FX snapshot covers every group", () => {
  const fxSnapshot = { id: "fx:complete", baseCurrency: "CNY" as const, asOf: "2026-09-19", source: "fixture", status: "complete" as const, rates: { "USD/CNY": "7", "HKD/CNY": "0.9" } };
  const targetModel: RoomContributionModel = {
    ...model,
    dimensions: {
      ...model.dimensions,
      market: [{ ...positive, money: buildRoomMoneyView([{ currency: "USD", amount: "10" }], fxSnapshot, "HKD") }],
    },
    total: buildRoomMoneyView([{ currency: "USD", amount: "10" }], fxSnapshot, "HKD"),
  };
  render(<RoomContribution model={targetModel} reportCurrency="HKD" />);
  const contribution = screen.getByRole("region", { name: "盈亏贡献分解" });
  expect(contribution).toHaveTextContent("折算 HKD");
  expect(contribution).toHaveTextContent("HK$");
  expect(contribution).not.toHaveTextContent("CNY");
});

it("keeps original subtotals discoverable when the requested target is unavailable", () => {
  render(<RoomContribution model={model} reportCurrency="HKD" />);
  const contribution = screen.getByRole("region", { name: "盈亏贡献分解" });
  expect(contribution).toHaveTextContent("HKD不可用");
  expect(contribution).toHaveTextContent("US$");
});
