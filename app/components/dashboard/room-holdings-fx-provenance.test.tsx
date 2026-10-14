import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildRoomMoneySubtotal } from "../../lib/reviews/holdings-money-subtotal";
import { RoomHoldingsFxProvenance } from "./room-holdings-fx-provenance";

afterEach(cleanup);

const completeSnapshot = {
  id: "fx:boc:2026-09-19",
  baseCurrency: "CNY" as const,
  asOf: "2026-09-19T10:30:00+08:00",
  source: "BOC",
  status: "complete" as const,
  rates: { "USD/CNY": "6.7521", "HKD/CNY": "0.8606" },
  publishedAt: "2026-09-19T10:30:00+08:00",
  publishedAtByCurrency: {
    USD: "2026-09-19T10:30:00+08:00",
    HKD: "2026-09-19T10:30:00+08:00",
  },
  fetchedAt: "2026-09-19T03:00:00.000Z",
};

describe("RoomHoldingsFxProvenance", () => {
  it("shows the actual relevant rates in one directly checkable caption", () => {
    render(<RoomHoldingsFxProvenance snapshot={completeSnapshot} currencies={["CNY", "USD", "HKD"]} />);

    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent(
      "汇率：2026-09-19（中行）｜1 USD = 6.7521 CNY；1 HKD = 0.8606 CNY",
    );
    expect(screen.queryByText(/同一汇率快照/)).not.toBeInTheDocument();
  });

  it("keeps different publication dates attached to their own rates", () => {
    render(<RoomHoldingsFxProvenance snapshot={{
      ...completeSnapshot,
      publishedAt: "2026-09-19T10:30:00+08:00",
      publishedAtByCurrency: {
        USD: "2026-09-19T10:30:00+08:00",
        HKD: "2026-09-18T10:30:00+08:00",
      },
    }} currencies={["USD", "HKD"]} />);

    const caption = screen.getByTestId("room-holdings-fx-provenance");
    expect(caption).toHaveTextContent("汇率：2026-09-19（中行）｜1 USD = 6.7521 CNY");
    expect(caption).toHaveTextContent("汇率：2026-09-18（中行）｜1 HKD = 0.8606 CNY");
  });

  it("states fetched-only provenance without presenting fetchedAt as a publication date", () => {
    render(<RoomHoldingsFxProvenance snapshot={{
      ...completeSnapshot,
      asOf: "2026-09-19T03:00:00.000Z",
      publishedAt: null,
      publishedAtByCurrency: {},
      fetchedAt: "2026-09-19T03:00:00.000Z",
    }} currencies={["USD"]} />);

    const caption = screen.getByTestId("room-holdings-fx-provenance");
    expect(caption).toHaveTextContent("获取于 2026-09-19 11:00（GMT+8），发布日期未提供");
    expect(caption).toHaveTextContent("1 USD = 6.7521 CNY");
    expect(caption).not.toHaveTextContent("汇率：2026-09-19");
  });

  it("does not turn a legacy asOf value into an invented publication date", () => {
    render(<RoomHoldingsFxProvenance snapshot={{
      id: "legacy",
      baseCurrency: "CNY",
      asOf: "2026-09-19T10:30:00+08:00",
      source: "BOC",
      status: "complete",
      rates: { "USD/CNY": "6.7521" },
    }} currencies={["USD"]} />);

    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent(
      "汇率：发布日期未知（中行）｜1 USD = 6.7521 CNY",
    );
    expect(screen.getByTestId("room-holdings-fx-provenance")).not.toHaveTextContent("2026-09-19");
  });

  it("identifies relevant currencies that cannot be converted", () => {
    render(<RoomHoldingsFxProvenance snapshot={{
      ...completeSnapshot,
      status: "partial",
      rates: { "USD/CNY": "6.7521" },
      publishedAtByCurrency: { USD: "2026-09-19T10:30:00+08:00" },
    }} currencies={["USD", "HKD"]} />);

    const caption = screen.getByTestId("room-holdings-fx-provenance");
    expect(caption).toHaveTextContent("1 USD = 6.7521 CNY");
    expect(caption).toHaveTextContent("HKD：暂无可用汇率，未计入人民币换算");
    expect(caption).toHaveTextContent("部分汇率仅作参考，未计入人民币换算");
  });

  it("keeps unsupported currencies separate from a supported complete conversion", () => {
    expect(buildRoomMoneySubtotal([
      { memberKey: "usd-1", currency: "USD", amount: "100" },
      { memberKey: "eur-1", currency: "EUR", amount: "100" },
    ], completeSnapshot, "CNY")).toMatchObject({
      value: "675.21",
      memberKeys: ["usd-1"],
      available: 1,
      total: 2,
      complete: false,
    });

    render(<RoomHoldingsFxProvenance snapshot={completeSnapshot} currencies={["USD", "EUR"]} />);

    const caption = screen.getByTestId("room-holdings-fx-provenance");
    expect(caption).toHaveTextContent("1 USD = 6.7521 CNY");
    expect(caption).toHaveTextContent("EUR：暂无可用汇率，未计入人民币换算");
    expect(caption).not.toHaveTextContent("部分汇率仅作参考，未计入人民币换算");
  });

  it("keeps CNH visible as an unsupported currency like the core converter", () => {
    expect(buildRoomMoneySubtotal([
      { memberKey: "cnh-1", currency: "CNH", amount: "100" },
    ], completeSnapshot, "CNY")).toMatchObject({
      value: null,
      memberKeys: [],
      available: 0,
      total: 1,
      complete: false,
    });

    render(<RoomHoldingsFxProvenance snapshot={completeSnapshot} currencies={["CNH"]} />);

    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent(
      "CNH：暂无可用汇率，未计入人民币换算",
    );
  });

  it("keeps source precision and makes stale cache evidence visible", () => {
    render(<RoomHoldingsFxProvenance snapshot={{
      ...completeSnapshot,
      rates: { "USD/CNY": "6.7521000000000001" },
      error: "刷新失败",
      lastAttemptDay: "2026-09-20",
    }} currencies={["USD"]} />);

    const caption = screen.getByTestId("room-holdings-fx-provenance");
    expect(caption).toHaveTextContent("1 USD = 6.7521000000000001 CNY");
    expect(caption).toHaveTextContent("沿用缓存");
    expect(caption).toHaveTextContent("刷新失败");
  });

  it("omits the FX caption for CNY-only holdings", () => {
    render(<RoomHoldingsFxProvenance snapshot={completeSnapshot} currencies={["CNY", "人民币"]} />);
    expect(screen.queryByTestId("room-holdings-fx-provenance")).not.toBeInTheDocument();
  });
});
