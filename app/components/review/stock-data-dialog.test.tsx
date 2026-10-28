import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { StockDataDialog } from "./stock-data-dialog";
import type { TradeExecution } from "../../lib/trades/types";
import type { TradeRevision, TradeRevisionRequest } from "../../lib/storage/trade-revisions";
import type { ReviewPlan } from "../../lib/storage/sqlite-contracts";
afterEach(cleanup);
const instrument = { id: "US:CTVA", symbol: "CTVA", name: "Corteva", market: "US", currency: "USD" };
const execution: TradeExecution = { id: "original", instrument, accountId: "a", accountLabel: "账户A", source: { platform: "tiger", row: 0 }, executedAt: "2026-07-24T13:48:50Z", side: "buy", quantity: "100", price: "88.77", fee: "0" };
it("prepares a zero-price revision on the server before enabling its reviewed commit", async () => {
 const plan: ReviewPlan = { policy: "trade-changes-v1", planId: "server-plan", kind: "revision", baseVersion: { databaseId: "test", epoch: "epoch", sequence: 1 }, createdAt: "2026-10-26T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", summary: { candidateCount: 1, inputDigest: "test", changes: [] }, diagnostics: [], conflicts: [], missingExecutions: [], reactivateExecutionIds: [] };
 const prepareRevision = vi.fn().mockResolvedValue(plan), onRevise = vi.fn().mockResolvedValue(undefined);
 const user = userEvent.setup();
 render(<StockDataDialog instrument={instrument} initialAccountId="a" executions={[execution]} marketSummary="行情完整" marketDetails={[]} refreshing={false} onRefresh={vi.fn()} onClose={vi.fn()} onRevise={onRevise} prepareRevision={prepareRevision} loadHistory={vi.fn().mockResolvedValue([])} onSupplement={vi.fn()} retainedReviews={[]} />);
 await user.click(screen.getByRole("button", { name: "编辑成交" }));
 await user.clear(screen.getByLabelText("价格（USD）")); await user.type(screen.getByLabelText("价格（USD）"), "0");
 await user.type(screen.getByLabelText("修订原因"), "原凭证零价格"); await user.click(screen.getByRole("button", { name: "预览修改" }));
 expect(prepareRevision).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ before: execution, after: expect.objectContaining({ price: "0" }) }] }));
 expect(onRevise).not.toHaveBeenCalled();
 await user.click(await screen.findByRole("button", { name: "确认保存修订" }));
 expect(onRevise).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ plan, choices: {}, requestId: expect.any(String) }));
});
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

it("keeps an unknown fee unknown and cancel does not write", async () => {
 const user=userEvent.setup(); const onRevise=vi.fn(); const onClose=vi.fn();
 const unknown={...execution, source:{...execution.source, feeStatus:"unknown" as const}};
 render(<StockDataDialog instrument={instrument} initialAccountId="a" executions={[unknown]} marketSummary="本地行情完整" marketDetails={[]} refreshing={false} onRefresh={vi.fn()} onClose={onClose} onRevise={onRevise} loadHistory={vi.fn().mockResolvedValue([])} onSupplement={vi.fn()} retainedReviews={[]} />);
 await user.click(screen.getByRole("button",{name:"编辑成交"}));
 expect(screen.getByText("费用（未知）")).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"取消修改"}));
 expect(onRevise).not.toHaveBeenCalled();
});

it("keeps date-only precision when changing the date and hides history while editing", async () => {
 const user=userEvent.setup(); const onRevise=vi.fn().mockResolvedValue(undefined);
 const dateOnly={...execution,source:{...execution.source,timePrecision:"date-only" as const,sourceTimestampText:"2026-07-24"},executedAt:"2026-07-24T00:00:00.000Z"};
 const loadHistory=vi.fn().mockResolvedValue([{id:"r1",instrumentId:instrument.id,accountId:"a",reason:"旧修订",recordedAt:"2026-09-01T00:00:00Z",changes:[{before:dateOnly,after:null}]}]);
 render(<StockDataDialog instrument={instrument} initialAccountId="a" executions={[dateOnly]} marketSummary="行情完整" marketDetails={Array.from({length:50},(_,i)=>`技术日志 ${i}`)} refreshing={false} onRefresh={vi.fn()} onClose={vi.fn()} onRevise={onRevise} loadHistory={loadHistory} onSupplement={vi.fn()} retainedReviews={[]} />);
 expect(screen.getByText(/查看行情覆盖与技术诊断（50 项）/).closest("details")).not.toHaveAttribute("open");
 await user.click(screen.getByRole("button",{name:"编辑成交"}));
 expect(screen.queryByText(/修订历史（/)).not.toBeInTheDocument();
 await user.clear(screen.getByLabelText("成交时间（交易所时区）")); await user.type(screen.getByLabelText("成交时间（交易所时区）"),"2026-07-25");
 await user.type(screen.getByLabelText("修订原因"),"修正日期"); await user.click(screen.getByRole("button",{name:"预览修改"})); await user.click(screen.getByRole("button",{name:"确认保存修订"}));
 await waitFor(() => expect(onRevise).toHaveBeenCalled());
 expect(onRevise.mock.calls[0][0].changes[0].after).toMatchObject({source:{timePrecision:"date-only",sourceTimestampText:"2026-07-25"}});
 expect(onRevise.mock.calls[0][0].changes[0].after?.source.feeStatus).toBeUndefined();
});

const badFees = ["invalid", "", "   ", "-1", "NaN", "Infinity"];
const malformed: TradeExecution = {
 ...execution, id: "bad-fee", quantity: "2", price: "100", fee: "invalid",
 executedAt: "2026-07-24T13:48:50.123Z",
 source: { platform: "tiger", row: 8, fileName: "original.csv", batchId: "original-batch", timePrecision: "second", sourceTimestampText: "2026-07-24 09:48:50", sourceTimezone: "America/New_York" },
};
function freezeExecution(record: TradeExecution) {
 Object.freeze(record.instrument); Object.freeze(record.source); return Object.freeze(record);
}
function feeDialog(record = malformed, overrides: Partial<ComponentProps<typeof StockDataDialog>> = {}) {
 const onRevise = vi.fn<(input: TradeRevisionRequest) => Promise<void>>().mockResolvedValue(undefined);
 const props = { instrument, initialAccountId: "a", executions: [record], marketSummary: "本地行情完整", marketDetails: [], refreshing: false, onRefresh: vi.fn(), onClose: vi.fn(), onRevise, loadHistory: vi.fn().mockResolvedValue([]), onSupplement: vi.fn(), retainedReviews: [], ...overrides };
 return { user: userEvent.setup(), onRevise, props, ...render(<StockDataDialog {...props} />) };
}
const feeCheckbox = () => screen.getByRole("checkbox");
const feeInput = () => screen.getByRole("textbox", { name: /费用/ });
async function prepareFee(user: ReturnType<typeof userEvent.setup>, value: string) {
 await user.click(screen.getByRole("button", { name: "编辑成交" }));
 if (!feeCheckbox().matches(":checked")) await user.click(feeCheckbox());
 await user.clear(feeInput()); if (value) await user.type(feeInput(), value);
 await user.type(screen.getByLabelText("修订原因"), "核对原凭证费用");
 await user.click(screen.getByRole("button", { name: "预览修改" }));
}

it.each(badFees)("R01 shows malformed fee %j as original evidence, never known money", (fee) => {
 feeDialog({ ...malformed, fee });
 const record = screen.getByRole("button", { name: "编辑成交" }).closest("article");
 expect(record).toHaveTextContent(/费用.*待核对/);
 expect(record?.textContent).toContain(`原值：${JSON.stringify(fee)}`);
 expect(record?.textContent).not.toContain(`费用 ${fee} USD`);
});

it.each(["invalid", "", "   "])("R02 keeps %j and the corrected draft when verification is toggled", async (fee) => {
 const { user, onRevise } = feeDialog({ ...malformed, fee });
 await user.click(screen.getByRole("button", { name: "编辑成交" }));
 expect(feeCheckbox()).not.toBeChecked(); expect(feeInput()).toHaveValue(fee);
 await user.click(feeCheckbox()); expect(feeInput()).toHaveValue(fee);
 await user.click(feeCheckbox()); expect(feeInput()).toHaveValue(fee);
 await user.click(feeCheckbox()); await user.clear(feeInput()); await user.type(feeInput(), "2");
 await user.click(feeCheckbox()); await user.click(feeCheckbox());
 expect(feeInput()).toHaveValue("2"); expect(onRevise).not.toHaveBeenCalled();
});

it.each(badFees)("R03 blocks an unverified malformed after %j instead of retaining bad money or inventing zero", async (fee) => {
 const { user, onRevise } = feeDialog({ ...malformed, fee });
 await user.click(screen.getByRole("button", { name: "编辑成交" }));
 if (feeCheckbox().matches(":checked")) await user.click(feeCheckbox());
 await user.type(screen.getByLabelText("修订原因"), "只核对数量，费用仍待核对");
 await user.click(screen.getByRole("button", { name: "预览修改" }));
 expect(screen.queryByText("确认本次修订")).not.toBeInTheDocument();
 expect(screen.getByRole("alert")).toHaveTextContent(/费用/);
 expect(feeInput()).toHaveValue(fee);
 expect(screen.getByLabelText("修订原因")).toHaveValue("只核对数量，费用仍待核对");
 expect(onRevise).not.toHaveBeenCalled();
});

it.each(badFees)("R03 verification alone cannot make %j a legal fee", async (fee) => {
 const { user, onRevise } = feeDialog();
 await prepareFee(user, fee);
 expect(screen.queryByText("确认本次修订")).not.toBeInTheDocument();
 expect(screen.getByRole("alert")).toHaveTextContent(/费用/);
 expect(feeInput()).toHaveValue(fee); expect(onRevise).not.toHaveBeenCalled();
});

it.each(["2", "0"])("R04 previews explicit fee %s and preserves exact source identity and raw before", async (fee) => {
 const before = freezeExecution(structuredClone(malformed));
 const { user, onRevise } = feeDialog(before);
 await prepareFee(user, fee);
 expect(onRevise).not.toHaveBeenCalled();
 expect(screen.getByText("修改前：").closest("p")?.textContent).toContain('原值："invalid"');
 expect(screen.getByText("修改后：").closest("p")).toHaveTextContent(`费用 ${fee} USD`);
 await user.click(screen.getByRole("button", { name: "返回修改" }));
 expect(feeInput()).toHaveValue(fee); expect(feeCheckbox()).toBeChecked();
 expect(screen.getByLabelText("修订原因")).toHaveValue("核对原凭证费用");
 await user.click(screen.getByRole("button", { name: "预览修改" }));
 await user.click(screen.getByRole("button", { name: "确认保存修订" }));
 await waitFor(() => expect(onRevise).toHaveBeenCalledTimes(1));
 expect(onRevise.mock.calls[0][0]).toEqual({ id: expect.any(String), instrumentId: "US:CTVA", accountId: "a", reason: "核对原凭证费用", changes: [{ before, after: { ...before, fee, source: { ...before.source, feeStatus: "reported" } } }] });
 expect(before.fee).toBe("invalid"); expect(before.source.feeStatus).toBeUndefined();
});

it.each(["保存失败，请重试", "修订冲突，请核对当前版本"])("R05 retains the preview and edited fee after %s without automatic retry", async (message) => {
 let rejectSave: (error: Error) => void = () => { throw new Error("save not pending"); };
 const pending = new Promise<void>((_resolve, reject) => { rejectSave = reject; });
 const onRevise = vi.fn<(input: TradeRevisionRequest) => Promise<void>>().mockReturnValue(pending);
 const before = freezeExecution(structuredClone(malformed));
 const { user } = feeDialog(before, { onRevise });
 await prepareFee(user, "2");
 await user.click(screen.getByRole("button", { name: "确认保存修订" }));
 const saving = screen.getByRole("button", { name: "正在保存…" });
 expect(saving).toBeDisabled(); await user.click(saving);
 expect(screen.getByRole("button", { name: "返回修改" })).toBeDisabled();
 await act(async () => { rejectSave(new Error(message)); });
 expect(screen.getByRole("alert")).toHaveTextContent(message);
 expect(screen.getByText("确认本次修订")).toBeInTheDocument();
 expect(screen.queryByText("修订已保存，成交与回合已更新。")).not.toBeInTheDocument();
 expect(onRevise).toHaveBeenCalledTimes(1);
 await user.click(screen.getByRole("button", { name: "返回修改" }));
 expect(feeInput()).toHaveValue("2"); expect(screen.getByLabelText("修订原因")).toHaveValue("核对原凭证费用");
 expect(before.fee).toBe("invalid");
});

it("R06 separates accounts and displays the raw before beside the corrected history after", async () => {
 const before = freezeExecution(structuredClone(malformed));
 const neighbor = freezeExecution({ ...structuredClone(malformed), id: "neighbor", accountId: "b", accountLabel: "账户B", fee: "3" });
 const after: TradeExecution = { ...before, fee: "2", source: { ...before.source, feeStatus: "reported" } };
 const loadHistory = vi.fn<(id: string) => Promise<TradeRevision[]>>().mockResolvedValue([]);
 const retainedReviews = [{ episodeId: "old-episode", drawingCount: 1, drawings: [{ id: "old-text", text: "保留原绘图" }] }];
 const { user, onRevise, props, rerender } = feeDialog(before, { executions: [before, neighbor], loadHistory, retainedReviews });
 const originalExport = screen.getByRole("link", { name: "导出原笔记与绘图供核对", hidden: true }).getAttribute("href");
 await user.selectOptions(screen.getByRole("combobox", { name: "当前账户" }), "b");
 expect(screen.getByRole("button", { name: "编辑成交" }).closest("article")).toHaveTextContent("费用 3 USD");
 await user.selectOptions(screen.getByRole("combobox", { name: "当前账户" }), "a");
 await prepareFee(user, "2");
 loadHistory.mockResolvedValue([{ id: "revision-2", instrumentId: "US:CTVA", accountId: "a", reason: "核对原凭证费用", recordedAt: "2026-10-24T00:00:00Z", changes: [{ before, after }] }]);
 await user.click(screen.getByRole("button", { name: "确认保存修订" }));
 await screen.findByText("修订已保存，成交与回合已更新。");
 expect(onRevise).toHaveBeenCalledWith(expect.objectContaining({ accountId: "a", changes: [{ before, after }] }));
 rerender(<StockDataDialog {...props} executions={[after, neighbor]} />);
 const history = (await screen.findByText("修订历史（1）")).closest("details");
 if (!history) throw new Error("Revision history must be available");
 await user.click(within(history).getByText("修订历史（1）"));
 expect(within(history).getByText("修改前：").closest("p")?.textContent).toContain('原值："invalid"');
 expect(within(history).getByText("修改后：").closest("p")).toHaveTextContent("费用 2 USD");
 expect(screen.getByRole("button", { name: "编辑成交" }).closest("article")).toHaveTextContent("费用 2 USD");
 expect(screen.getByRole("link", { name: "导出原笔记与绘图供核对", hidden: true })).toHaveAttribute("href", originalExport);
 await user.selectOptions(screen.getByRole("combobox", { name: "当前账户" }), "b");
 expect(screen.getByRole("button", { name: "编辑成交" }).closest("article")).toHaveTextContent("费用 3 USD");
 expect(before.fee).toBe("invalid"); expect(neighbor.fee).toBe("3");
});

it("R07 preserves reveal, close and cancel guards while editing malformed evidence", async () => {
 const before = freezeExecution(structuredClone(malformed));
 const { user, onRevise, props } = feeDialog(before, { cursor: "2026-07-23T00:00:00Z" });
 expect(screen.queryByRole("button", { name: "编辑成交" })).not.toBeInTheDocument();
 expect(props.loadHistory).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
 await prepareFee(user, "2");
 expect(screen.queryByText(/修订历史（/)).not.toBeInTheDocument();
 await user.click(screen.getByRole("button", { name: "关闭数据检查" }));
 expect(screen.getByRole("alert")).toHaveTextContent(/未保存/);
 await user.keyboard("{Escape}"); expect(props.onClose).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button", { name: "返回修改" }));
 await user.click(screen.getByRole("button", { name: "取消修改" }));
 expect(onRevise).not.toHaveBeenCalled(); expect(before.fee).toBe("invalid");
 await user.click(screen.getByRole("button", { name: "关闭数据检查" }));
 expect(props.onClose).toHaveBeenCalledTimes(1);
});

it("R07 permits removal of a malformed record without manufacturing an after fee", async () => {
 const before = freezeExecution(structuredClone(malformed));
 const { user, onRevise } = feeDialog(before);
 await user.click(screen.getByRole("button", { name: "移除此记录" }));
 await user.type(screen.getByLabelText("修订原因"), "核对原凭证为误单");
 await user.click(screen.getByRole("button", { name: "预览修改" }));
 expect(screen.getByText("修改前：").closest("p")?.textContent).toContain('原值："invalid"');
 expect(screen.getByText("修改后：").closest("p")).toHaveTextContent("无记录");
 expect(onRevise).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button", { name: "确认保存修订" }));
 expect(onRevise).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ before, after: null }] }));
});

it.each(["0", "-0", "0.125", "1e-3"])("R08 keeps the literal valid fee %s and implicit reported status unchanged", async (fee) => {
 const before = freezeExecution({ ...structuredClone(malformed), fee });
 const { user, onRevise } = feeDialog(before);
 await user.click(screen.getByRole("button", { name: "编辑成交" }));
 expect(feeCheckbox()).toBeChecked(); expect(feeInput()).toHaveValue(fee);
 await user.clear(screen.getByLabelText("数量")); await user.type(screen.getByLabelText("数量"), "3");
 await user.type(screen.getByLabelText("修订原因"), "只修正数量");
 await user.click(screen.getByRole("button", { name: "预览修改" }));
 await user.click(screen.getByRole("button", { name: "确认保存修订" }));
 expect(onRevise).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ before, after: { ...before, quantity: "3" } }] }));
});

it("R08 preserves a valid scalar with unknown status instead of certifying it during a quantity correction", async () => {
 const before = freezeExecution({ ...structuredClone(malformed), fee: "7.25", source: { ...malformed.source, feeStatus: "unknown" as const } });
 const { user, onRevise } = feeDialog(before);
 await user.click(screen.getByRole("button", { name: "编辑成交" }));
 expect(feeCheckbox()).not.toBeChecked();
 await user.clear(screen.getByLabelText("数量")); await user.type(screen.getByLabelText("数量"), "3");
 await user.type(screen.getByLabelText("修订原因"), "费用仍待核对，仅修正数量");
 await user.click(screen.getByRole("button", { name: "预览修改" }));
 expect(screen.getByText("修改后：").closest("p")).toHaveTextContent("费用 未知");
 await user.click(screen.getByRole("button", { name: "确认保存修订" }));
 expect(onRevise).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ before, after: { ...before, quantity: "3" } }] }));
});
