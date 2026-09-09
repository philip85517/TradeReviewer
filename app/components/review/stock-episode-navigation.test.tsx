import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { TradeEpisode } from "../../lib/trades/types";
import { StockEpisodeNavigation } from "./stock-episode-navigation";
afterEach(cleanup);
const instrument = { id: "US:CTVA", symbol: "CTVA", name: "Corteva", market: "US", currency: "USD" };
const episode: TradeEpisode = { id: "episode-1", instrument, accountId: "tiger", accountLabel: "老虎", direction: "long", status: "closed", startedAt: "2026-07-24T13:48:50Z", endedAt: "2026-07-29T15:01:17Z", openingQuantity: "100", remainingQuantity: "0", executions: [
  { id: "buy", instrument, accountId: "tiger", accountLabel: "老虎", source: { platform: "tiger", row: 0 }, side: "buy", executedAt: "2026-07-24T13:48:50Z", quantity: "100", price: "88.77", fee: "0" },
  { id: "sell", instrument, accountId: "tiger", accountLabel: "老虎", source: { platform: "tiger", row: 1 }, side: "sell", executedAt: "2026-07-29T15:01:17Z", quantity: "100", price: "88.76", fee: "0" },
] };
it("shows only revealed fills and lets the user locate a revealed trade", async () => {
  const user = userEvent.setup(); const onLocate = vi.fn(); const onNext = vi.fn();
  const props = { instrument, episodes: [episode], selectedEpisodeId: episode.id, cursor: "2026-07-23T20:30:00Z", onSelectEpisode: vi.fn(), onLocate, onNext, onSwitchStock: vi.fn(), onLibrary: vi.fn() };
  const { rerender } = render(<StockEpisodeNavigation {...props} />);
  expect(screen.getByText("当前尚未回放到首笔成交")).toBeInTheDocument();
  expect(screen.queryByText(/88\.7/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "下一成交" })); expect(onNext).toHaveBeenCalledOnce();
  rerender(<StockEpisodeNavigation {...props} cursor={episode.executions[0].executedAt} />);
  expect(screen.queryByText(/88\.76/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /定位买入/ })); expect(onLocate).toHaveBeenCalledWith(episode.executions[0].executedAt);
  rerender(<StockEpisodeNavigation {...props} cursor={episode.executions[1].executedAt} />);
  expect(screen.getByRole("button", { name: /定位卖出/ })).toBeInTheDocument();
});
