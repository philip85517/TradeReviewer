import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { StockDataDialog } from "./stock-data-dialog";
import type { TradeExecution } from "../../lib/trades/types";
afterEach(cleanup);
const instrument = { id: "US:CTVA", symbol: "CTVA", name: "Corteva", market: "US", currency: "USD" };
const execution: TradeExecution = { id: "original", instrument, accountId: "a", accountLabel: "账户A", source: { platform: "tiger", row: 0 }, executedAt: "2026-07-24T13:48:50Z", side: "buy", quantity: "100", price: "88.77", fee: "0" };
it("requires explicit historical reveal and confirms a correction before writing", async () => {
 const user = userEvent.setup(); const onRevise = vi.fn().mockResolvedValue(undefined); const loadHistory = vi.fn().mockResolvedValue([]);
 render(<StockDataDialog instrument={instrument} initialAccountId="a" executions={[execution]} cursor="2026-07-23T00:00:00Z" marketSummary="行情部分可用" marketDetails={[]} refreshing={false} onRefresh={vi.fn()} onClose={vi.fn()} onRevise={onRevise} loadHistory={loadHistory} onSupplement={vi.fn()} retainedReviews={[]} />);
 expect(screen.queryByText(/88.77/)).not.toBeInTheDocument(); expect(loadHistory).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
 await user.click(screen.getByRole("button", { name: "编辑成交" }));
 await user.clear(screen.getByLabelText("数量")); await user.type(screen.getByLabelText("数量"), "200");
 await user.type(screen.getByLabelText("修订原因"), "核对原凭证");
 await user.click(screen.getByRole("button", { name: "预览修改" }));
 expect(onRevise).not.toHaveBeenCalled(); expect(screen.getByText("确认本次修订")).toBeInTheDocument();
 await user.click(screen.getByRole("button", { name: "确认保存修订" }));
 await waitFor(() => expect(onRevise).toHaveBeenCalledWith(expect.objectContaining({ instrumentId: instrument.id, accountId: "a", changes: [{ before: execution, after: expect.objectContaining({ quantity: "200" }) }] })));
});
it("retains source time precision when only quantity changes", async () => {
 const user=userEvent.setup(); const onRevise=vi.fn().mockResolvedValue(undefined);
 const precise={...execution,executedAt:"2026-07-24T13:48:50.123Z",source:{...execution.source,timePrecision:"date-only" as const,sourceTimestampText:"2026-07-24"}};
 render(<StockDataDialog instrument={instrument} initialAccountId="a" executions={[precise]} marketSummary="本地行情完整" marketDetails={[]} refreshing={false} onRefresh={vi.fn()} onClose={vi.fn()} onRevise={onRevise} loadHistory={vi.fn().mockResolvedValue([])} onSupplement={vi.fn()} retainedReviews={[]} />);
 await user.click(screen.getByRole("button",{name:"编辑成交"}));await user.clear(screen.getByLabelText("数量"));await user.type(screen.getByLabelText("数量"),"200");await user.type(screen.getByLabelText("修订原因"),"核对数量");await user.click(screen.getByRole("button",{name:"预览修改"}));await user.click(screen.getByRole("button",{name:"确认保存修订"}));
 expect(onRevise.mock.calls[0][0].changes[0].after).toMatchObject({executedAt:precise.executedAt,source:precise.source,quantity:"200"});
});
it("recovers the account from revision history after every execution was removed", async () => {
 const user=userEvent.setup();const onSupplement=vi.fn();
 render(<StockDataDialog instrument={instrument} initialAccountId="" executions={[]} marketSummary="本地行情完整" marketDetails={[]} refreshing={false} onRefresh={vi.fn()} onClose={vi.fn()} onRevise={vi.fn()} loadHistory={vi.fn().mockResolvedValue([{id:"removed",instrumentId:instrument.id,accountId:"a",reason:"移除误单",recordedAt:"2026-09-06T00:00:00Z",changes:[{before:execution,after:null}]}])} onSupplement={onSupplement} retainedReviews={[]} />);
 await waitFor(()=>expect(screen.getByRole("combobox",{name:"当前账户"})).toHaveValue("a"));
 await user.click(screen.getByRole("button",{name:"为本股补充文件"}));expect(onSupplement).toHaveBeenCalledWith("a","file");
});
