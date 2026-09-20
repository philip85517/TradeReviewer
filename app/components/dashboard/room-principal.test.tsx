import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrincipalConfig } from "../../lib/principal/principal-model";
import type { PrincipalReferenceSummary } from "../../lib/principal/principal-model";
import type { CostReturnSummary } from "../../lib/reviews/trading-room-metrics";
import type { RoomMoneyView } from "../../lib/reviews/trading-room-scope";
import { RoomPrincipal } from "./room-principal";

function money(originalByCurrency: Record<string, string>, convertedCny: string | null): RoomMoneyView {
  return {
    baseCurrency: "CNY",
    originalByCurrency,
    convertedCny,
    conversion: convertedCny === null ? "partial" : "complete",
    fxSnapshotId: "fx:test",
    note: convertedCny === null ? "汇率快照不完整，按币种显示原币小计" : "按最新汇率估算",
  };
}

const costReturn: CostReturnSummary = {
  netPnl: money({ CNY: "200" }, "200"),
  buyCost: money({ CNY: "20000" }, "20000"),
  costReturnPercent: "1",
  applicableCount: 2,
  excludedCount: 0,
  exclusionReasons: {},
  includedEpisodeIds: ["a", "b"],
  excludedEpisodeIds: [],
  unavailableReason: null,
};

const summary: PrincipalReferenceSummary = {
  mode: "principal",
  principalReturnPercent: "2",
  costReturn,
  netPnl: money({ CNY: "200" }, "200"),
  principal: money({ CNY: "10000" }, "10000"),
  principalByCategory: { "a-share-stock": { amount: "10000", currency: "CNY" } },
  requiredCategories: ["a-share-stock"],
  configuredCategories: ["a-share-stock"],
  missingCategories: [],
  fallbackReason: null,
};

const config: PrincipalConfig = {
  "a-share-stock": { amount: "10000", currency: "CNY" },
};

describe("RoomPrincipal", () => {
  afterEach(() => cleanup());

  it("shows principal and cost returns and saves a positive value", () => {
    const onSave = vi.fn(async () => true);
    render(<RoomPrincipal config={config} summary={summary} onSave={onSave} onClear={vi.fn()} />);

    expect(screen.getByRole("region", { name: "本金与参考收益率" })).toBeInTheDocument();
    expect(screen.getByText("本金参考收益率")).toBeInTheDocument();
    expect(screen.getByText("2%")).toBeInTheDocument();
    expect(screen.getByText("交易成本收益率")).toBeInTheDocument();
    expect(screen.getByText("1%")).toBeInTheDocument();
    expect(screen.getByText("美股股票")).toBeInTheDocument();
    expect(screen.getByText("港股股票")).toBeInTheDocument();
    expect(screen.getByText("ETF")).toBeInTheDocument();

    const aShare = screen.getByRole("group", { name: "A股股票本金" });
    fireEvent.change(within(aShare).getByLabelText("A股股票本金金额"), { target: { value: "12000" } });
    fireEvent.click(within(aShare).getByRole("button", { name: "保存A股股票" }));

    expect(onSave).toHaveBeenCalledWith("a-share-stock", { amount: "12000", currency: "CNY" });
  });

  it("validates amounts and requires confirmation before changing a filled currency", () => {
    const onSave = vi.fn(async () => true);
    render(<RoomPrincipal config={config} summary={summary} onSave={onSave} onClear={vi.fn()} />);
    const aShare = screen.getByRole("group", { name: "A股股票本金" });
    const amount = within(aShare).getByLabelText("A股股票本金金额");
    fireEvent.change(amount, { target: { value: "0" } });
    fireEvent.click(within(aShare).getByRole("button", { name: "保存A股股票" }));
    expect(within(aShare).getByText("金额必须为正数")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(amount, { target: { value: "10000" } });
    fireEvent.change(within(aShare).getByLabelText("A股股票本金币种"), { target: { value: "USD" } });
    expect(within(aShare).getByText(/请确认将币种改为 USD/)).toBeInTheDocument();
    expect(within(aShare).getByLabelText("A股股票本金币种")).toHaveValue("CNY");
    fireEvent.click(within(aShare).getByRole("button", { name: "保存A股股票" }));
    expect(within(aShare).getByText("请先确认币种变更")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(within(aShare).getByRole("button", { name: "确认币种 USD" }));
    expect(within(aShare).getByLabelText("A股股票本金币种")).toHaveValue("USD");
  });

  it("lets async configuration hydrate empty drafts and isolates live and simulation draft edits", () => {
    const onSave = vi.fn();
    const { rerender } = render(<RoomPrincipal
      scopeKey="live"
      config={{}}
      summary={summary}
      onSave={onSave}
      onClear={vi.fn()}
    />);
    const liveAmount = screen.getByLabelText("A股股票本金金额");
    expect(liveAmount).toHaveValue("");

    rerender(<RoomPrincipal
      scopeKey="live"
      config={config}
      summary={summary}
      onSave={onSave}
      onClear={vi.fn()}
    />);
    expect(screen.getByLabelText("A股股票本金金额")).toHaveValue("10000");
    fireEvent.change(screen.getByLabelText("A股股票本金金额"), { target: { value: "12000" } });

    rerender(<RoomPrincipal
      scopeKey="simulation:run-1"
      config={{ "a-share-stock": { amount: "5000", currency: "USD" } }}
      summary={summary}
      onSave={onSave}
      onClear={vi.fn()}
    />);
    expect(screen.getByLabelText("A股股票本金金额")).toHaveValue("5000");
    expect(screen.getByLabelText("A股股票本金币种")).toHaveValue("USD");

    rerender(<RoomPrincipal
      scopeKey="live"
      config={config}
      summary={summary}
      onSave={onSave}
      onClear={vi.fn()}
    />);
    expect(screen.getByLabelText("A股股票本金金额")).toHaveValue("12000");
  });

  it("renders the cost fallback reason and clears a configured value", () => {
    const onClear = vi.fn(async () => true);
    render(<RoomPrincipal
      config={config}
      summary={{ ...summary, mode: "cost", principalReturnPercent: null, fallbackReason: "本金未填完整：缺少美股股票" }}
      onSave={vi.fn()}
      onClear={onClear}
    />);
    expect(screen.getByText("本金未填完整：缺少美股股票")).toBeInTheDocument();
    const aShare = screen.getByRole("group", { name: "A股股票本金" });
    fireEvent.click(within(aShare).getByRole("button", { name: "清空A股股票" }));
    expect(onClear).toHaveBeenCalledWith("a-share-stock");
  });

  it("locks amount, currency, and confirmation controls while a request is saving", () => {
    render(<RoomPrincipal config={config} summary={summary} saving onSave={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByLabelText("A股股票本金金额")).toBeDisabled();
    expect(screen.getByLabelText("A股股票本金币种")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存A股股票" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "清空A股股票" })).toBeDisabled();
  });
});
