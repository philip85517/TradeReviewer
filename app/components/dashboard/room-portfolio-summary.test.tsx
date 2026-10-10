import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { buildCurrentPortfolio } from "../../lib/reviews/trading-room-portfolio";
import { buildRoomMoneyView, createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import { RoomPortfolioSummary } from "./room-portfolio-summary";
afterEach(cleanup);
it("shows empty and unavailable daily PnL distinctly", () => {
 render(<RoomPortfolioSummary model={buildCurrentPortfolio([], {scope:createDefaultRoomScope(), asOf:"2026-09-25"})} />);
 expect(screen.getByText("当前空仓")).toBeInTheDocument();
 expect(screen.getByText(/当日估值证据不可用/)).toBeInTheDocument();
 expect(screen.getByText("持仓标的数")).toBeInTheDocument();
});

it("uses market-specific empty copy without relabeling the account as empty", () => {
 const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
 render(<RoomPortfolioSummary model={model} scope="market" />);
 expect(screen.getByText("当前市场暂无持仓")).toBeInTheDocument();
 expect(screen.queryByText("当前空仓")).not.toBeInTheDocument();
});

it("shows every current holding currency in daily evidence without inventing coverage counts", () => {
 const model = buildCurrentPortfolio([], {scope:createDefaultRoomScope(), asOf:"2026-09-25"});
 model.rows = [
  { holding: { settlementCurrency: "CNY", instrumentId: "cny-1" }, marketValue: "10", cost: "8", unrealizedPnl: "2", unrealizedReturnPercent: "25", reasons: [] },
  { holding: { settlementCurrency: "HKD", instrumentId: "hkd-1" }, marketValue: "20", cost: "18", unrealizedPnl: "2", unrealizedReturnPercent: "11", reasons: [] },
 ] as never;
 render(<RoomPortfolioSummary model={model} reportCurrency="original" dailyPnl={{baseCurrency:"CNY", originalByCurrency:{USD:"5"} as Record<string, string>, convertedCny:null, conversion:"partial", fxSnapshotId:null, note:"前收盘完整"}} />);
 const dailyCard = screen.getByText("当日盈亏").closest("div");
 expect(dailyCard).not.toBeNull();
 expect(within(dailyCard!).getByText("CNY 暂不可用")).toBeInTheDocument();
 expect(within(dailyCard!).getByText("HKD 暂不可用")).toBeInTheDocument();
 expect(within(dailyCard!).getByText("USD +5.00")).toBeInTheDocument();
 expect(screen.getByText(/当日估值证据存在缺口/)).toBeInTheDocument();
 expect(screen.queryByText(/当日盈亏.*0\/2/)).not.toBeInTheDocument();
});
it("displays supplied daily PnL and selected currency without inventing totals", () => {
 render(<RoomPortfolioSummary model={buildCurrentPortfolio([], {scope:createDefaultRoomScope()})} reportCurrency="CNY" dailyPnl={{baseCurrency:"CNY",originalByCurrency:{USD:"5"},convertedCny:null,conversion:"partial",fxSnapshotId:null,note:"汇率不足"}} />);
 expect(screen.getByTitle("汇率不足")).toBeInTheDocument();
 expect(screen.queryByText("CNY 0")).not.toBeInTheDocument();
});
it("keeps zero daily PnL neutral instead of assigning a gain tone", () => {
 render(<RoomPortfolioSummary model={buildCurrentPortfolio([], {scope:createDefaultRoomScope()})} dailyPnl={{baseCurrency:"CNY",originalByCurrency:{CNY:"0"},convertedCny:"0",conversion:"same-currency",fxSnapshotId:null,note:"完整"}} />);
 expect(screen.getByText("CNY 0.00")).not.toHaveAttribute("class");
});

it("shows successful CNY conversion estimate basis, FX source and time", () => {
 const model = buildCurrentPortfolio([], {scope:createDefaultRoomScope(), asOf:"2026-09-25"});
 model.marketValue = buildRoomMoneyView([{currency:"USD",amount:"10"}], {
  id:"fx-complete",baseCurrency:"CNY",status:"complete",rates:{"USD/CNY":"7"},
  source:"验收汇率源",asOf:"2026-09-24T16:00:00Z",
 });
 render(<RoomPortfolioSummary model={model} reportCurrency="CNY" />);
 expect(screen.getByText("CNY 70.00")).toBeInTheDocument();
 expect(screen.getByText("按最新汇率估算（验收汇率源，2026-09-24）")).toBeInTheDocument();
 expect(screen.getByTitle("按最新汇率估算（验收汇率源，2026-09-24T16:00:00Z）")).toBeInTheDocument();
});

it("keeps partial valuation warning compact and preserves complete reasons in disclosure", () => {
 const model=buildCurrentPortfolio([], {scope:createDefaultRoomScope(),asOf:"2026-09-25T10:00:00.123Z"});
 model.coverage.marketValue={available:2,total:3,complete:false};
 model.coverage.unrealizedPnl={available:1,total:3,complete:false};
 render(<RoomPortfolioSummary model={model} dailyPnlReason="前收盘报价缺失，需补齐完整历史价格后再计算当日盈亏" />);
 expect(screen.getByText("已估值 2/3 个仓位")).toBeInTheDocument();
 expect(screen.getByText("已计算盈亏 1/3 个仓位")).toBeInTheDocument();
 expect(screen.getByText("估值截点：2026-09-25 18:00（UTC+8）")).toBeInTheDocument();
 expect(screen.getByTitle("前收盘报价缺失，需补齐完整历史价格后再计算当日盈亏")).toBeInTheDocument();
 expect(screen.getByText(model.basis).closest("details")).not.toBeNull();
});

it("groups very large decimal amounts without converting through a JavaScript number", () => {
 const model = buildCurrentPortfolio([], {scope:createDefaultRoomScope(), asOf:"2026-09-25"});
 model.marketValue = buildRoomMoneyView([{currency:"CNY", amount:"1234567890123456.125"}], {
  id:"large-value", baseCurrency:"CNY", status:"complete", rates:{}, source:"精确值", asOf:"2026-09-25T00:00:00Z",
 });
 render(<RoomPortfolioSummary model={model} reportCurrency="CNY" />);
 expect(screen.getByText("CNY 1,234,567,890,123,456.13")).toBeInTheDocument();
});

it("shows the independent daily return percentage and real type breakdown", () => {
 const model = buildCurrentPortfolio([], {scope:createDefaultRoomScope(), asOf:"2026-09-25"});
 model.rows = [
  { holding: { assetType: "stock" } } as never,
  { holding: { assetType: "etf" } } as never,
  { holding: { assetType: "unknown" } } as never,
 ];
 render(<RoomPortfolioSummary model={model} reportCurrency="HKD" dailyReturnPercent="2" dailyReturnPercentAvailable dailyReturnPercentReasons={[]} />);
 expect(screen.getByText("+2.00%")).toBeInTheDocument();
 expect(screen.getByTitle("当日盈亏百分比")).toBeInTheDocument();
 expect(screen.getByText("股票 1 · ETF 1 · 类型待核对 1")).toBeInTheDocument();
});

it("uses the original daily source for a zero return when target conversion is unavailable", () => {
 const model = buildCurrentPortfolio([], {scope:createDefaultRoomScope(), asOf:"2026-09-25"});
 render(<RoomPortfolioSummary model={model} reportCurrency="original"
   dailyPnl={{baseCurrency:"CNY", originalByCurrency:{HKD:"0"}, convertedCny:null, convertedHkd:"0", targetCurrency:"CNY", conversion:"partial", fxSnapshotId:null, note:"无法换算CNY"}}
   dailyPnlReason="无法换算CNY" dailyReturnPercent="0" dailyReturnPercentReasons={["无法换算CNY"]} />);
 expect(screen.getByText("HKD 0.00")).toBeInTheDocument();
 expect(screen.queryByText("无法换算CNY")).not.toBeInTheDocument();
 expect(screen.getByLabelText("当日盈亏百分比 0.00%")).toBeInTheDocument();
});
