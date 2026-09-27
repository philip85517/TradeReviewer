import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { buildCurrentPortfolio } from "../../lib/reviews/trading-room-portfolio";
import { buildRoomMoneyView, createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import { RoomPortfolioSummary } from "./room-portfolio-summary";
afterEach(cleanup);
it("shows empty and unavailable daily PnL distinctly", () => {
 render(<RoomPortfolioSummary model={buildCurrentPortfolio([], {scope:createDefaultRoomScope(), asOf:"2026-09-25"})} />);
 expect(screen.getByText("当前空仓")).toBeInTheDocument();
 expect(screen.getByText("缺少可核对的前收盘估值，当日盈亏暂不可用")).toBeInTheDocument();
 expect(screen.getByText("持仓标的数")).toBeInTheDocument();
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
 render(<RoomPortfolioSummary model={model} dailyPnlReason="前收盘报价缺失，需补齐完整历史价格后再计算当日盈亏" />);
 expect(screen.getByText("估值 2/3 · 部分估值")).toBeInTheDocument();
 expect(screen.getByText("估值截点：2026-09-25")).toBeInTheDocument();
 expect(screen.getByTitle("前收盘报价缺失，需补齐完整历史价格后再计算当日盈亏")).toBeInTheDocument();
 expect(screen.getByText(model.basis).closest("details")).not.toBeNull();
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
