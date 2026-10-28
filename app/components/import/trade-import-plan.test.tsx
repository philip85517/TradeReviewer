import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportDuplicateFact, ReviewFactValues, ReviewPlan, TradeChangeChoices } from "../../lib/storage/sqlite-contracts";
import type { ImportPreview } from "../../lib/import/import-preview";
import type { TradeExecution } from "../../lib/trades/types";
import { identitySelectionForPlan, importIntentForPreview, ImportMaterialSelection, planNeedsChoices, TradeImportPlan, TradePlanReview, tradePlanChoicesComplete, tradePlanReadyForPreview } from "./trade-import-plan";

afterEach(cleanup);

const execution: TradeExecution = { id: "same-id", accountId: "A", accountLabel: "主账户", instrument: { id: "US:AAPL", name: "苹果", symbol: "AAPL", market: "US", currency: "USD" }, side: "buy", quantity: "1.0000000000000001", price: "123.4500000000000001", fee: "0", executedAt: "2026-10-01", source: { platform: "broker", row: 0, feeStatus: "unknown", timePrecision: "date-only" } };
const plan: ReviewPlan = { planId: "plan-private-id", policy: "trade-changes-v1", kind: "import", baseVersion: { databaseId: "db", epoch: "epoch", sequence: 1 }, createdAt: "2026-10-26T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", summary: { candidateCount: 1, inputDigest: "fixture", changes: [] }, diagnostics: [], conflicts: [{ id: "conflict", candidateKey: "same-id", existing: [execution], incoming: [{ ...execution, price: "130" }], allowed: ["keep-existing", "use-incoming"] }], missingExecutions: [{ executionId: "missing", previousObservationIds: ["old"], otherSourceObservationIds: ["other"], revisionIds: ["manual"] }], reactivateExecutionIds: ["withdrawn"] };
const preview: ImportPreview = { id: "retryable-import", fileName: "成交.xlsx", sourceLabel: "券商成交", sourceKind: "statement", records: [execution], instruments: [{ instrument: execution.instrument, executions: [execution], tradeCount: 1, firstTradeAt: execution.executedAt, lastTradeAt: execution.executedAt }], unresolved: [], exclusionGroups: [], tradeCount: 1, instrumentCount: 1, duplicateTradeCount: 0, unresolvedInstrumentCount: 0, excludedInstrumentCount: 0, blocked: false, fileContent: { sha256: "a".repeat(64), byteLength: 100 } };
function Harness() {
  const [choices, setChoices] = useState<TradeChangeChoices>({});
  return <><TradePlanReview plan={plan} choices={choices} onChoicesChange={setChoices} executions={[execution]} /><button disabled={!tradePlanChoicesComplete(plan, choices)}>保存计划</button></>;
}
const revisionBefore: TradeExecution = { ...execution, quantity: "2.0000000000000002", price: "234.567890123456789012", fee: "", executedAt: "2026-10-02T13:30:00.123Z" };
function serverFact(record: TradeExecution, fee: string | null): ReviewFactValues {
  return { instrumentId: record.instrument.id, accountId: record.accountId, side: record.side, quantity: record.quantity, price: record.price, fee, executedAt: record.executedAt, currency: record.instrument.currency };
}
function revisionPlan(before: ReviewFactValues, after?: ReviewFactValues): ReviewPlan {
  return { ...plan, kind: "revision", conflicts: [], missingExecutions: [], reactivateExecutionIds: [], summary: { ...plan.summary, changes: [{ kind: "revise", executionId: execution.id, before, after }] } };
}
describe("server trade plan choices", () => {
  it("keeps duplicate review neutral and shows missing source and fee facts as unknown", () => {
    const fact: ImportDuplicateFact = { accountId: execution.accountId!, accountLabel: execution.accountLabel!, instrument: execution.instrument, executedAt: execution.executedAt, side: execution.side, quantity: execution.quantity, price: execution.price, fee: null, source: { platform: "broker", fileName: null, page: null, row: 0 } };
    const duplicates: ReviewPlan = { ...plan, conflicts: [], missingExecutions: [], reactivateExecutionIds: [], summary: { ...plan.summary, importDuplicates: { policy: "import-duplicate-review-v1", count: 1, pairs: [{ kept: fact, skipped: { ...fact, fee: "0", source: { ...fact.source, fileName: "成交.csv", page: 2, row: 7 } } }] } } };
    render(<TradePlanReview plan={duplicates} choices={{}} onChoicesChange={() => {}} />);
    const review = screen.getByRole("region", { name: "服务器重复核对" });
    expect(within(review).getByText("服务器核对重复候选 1 笔")).toBeInTheDocument();
    const kept = within(review).getByRole("group", { name: "重复候选 1 保留事实" });
    expect(kept).toHaveTextContent("买入 1.0000000000000001 @ 123.4500000000000001 USD · 费用 未知 · 2026-10-01（仅日期）");
    expect(kept).toHaveTextContent("未提供文件名 · 未提供页码 · 第 0 行");
    const repeated = within(review).getByRole("group", { name: "重复候选 1 重复事实" });
    expect(repeated).toHaveTextContent("费用 0");
    expect(repeated).toHaveTextContent("成交.csv · 第 2 页 · 第 7 行");
    expect(within(review).queryByText(/本批将跳过|本次候选将跳过|已跳过/)).not.toBeInTheDocument();
  });
  const identityPlan = (): Extract<ReviewPlan, { reviewContract: "trade-review-v2" }> => ({ ...plan, reviewContract: "trade-review-v2", status: "review-required", tvImportGuard: { policy: "tv-compat-v1" }, conflicts: [], missingExecutions: [], reactivateExecutionIds: [], summary: { ...plan.summary, tradingViewImport: { policy: "tv-import-v1", facts: { accepted: 0, duplicate: 0, conflict: 0 }, identity: { kind: "unchanged" }, material: { kind: "normalized-only", reason: "legacy-no-decoded-observations" } } }, identityReviews: ["entry", "exit"].map((role, i) => ({ id: `g:${role}`, kind: "unproven-source-declaration", incomingIds: [`candidate:${i}`], existingIds: [`stored:${i}`], incomingScopes: [{ accountId: "canonical", instrumentId: execution.instrument.id, market: execution.instrument.market, currency: execution.instrument.currency, nature: "simulation", rawRun: { kind: "present", raw: "prefixed:run" } }], existingScopes: [{ accountId: "legacy", instrumentId: execution.instrument.id, market: execution.instrument.market, currency: execution.instrument.currency, nature: "simulation", rawRun: { kind: "present", raw: "run" } }], locator: { kind: "execution-id", executionId: `candidate:${i}` }, reasons: ["account", "run"], allowed: ["keep-independent"] })) });
  it("keeps identity review uncommittable even when all ordinary reasons and choices are supplied", () => {
    const value = identityPlan();
    const choices: TradeChangeChoices = { conflicts: [{ conflictId: "invented", decision: "use-incoming", reason: "reviewed" }] };
    expect(tradePlanChoicesComplete(value, choices)).toBe(false);
    render(<TradePlanReview plan={value} choices={choices} onChoicesChange={() => {}} />);
    expect(screen.getAllByText(/prefixed:run/)[0]).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "冲突处理 1" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("替换理由 1")).not.toBeInTheDocument();
  });
  it("requests only the complete server-bound independent reprepare selection", async () => {
    const user = userEvent.setup(), onKeepIndependent = vi.fn(), value = identityPlan();
    render(<TradePlanReview plan={value} choices={{}} onChoicesChange={() => {}} onKeepIndependent={onKeepIndependent} />);
    await user.click(screen.getByRole("button", { name: "确认全部为独立记录并重新准备" }));
    const selection = { kind: "keep-independent", reviewPlanId: value.planId, inputDigest: value.summary.inputDigest, candidateIds: ["candidate:0", "candidate:1"] };
    expect(onKeepIndependent).toHaveBeenCalledTimes(1); expect(onKeepIndependent).toHaveBeenCalledWith(selection);
    expect(identitySelectionForPlan(value)).toEqual(selection);
    expect(Object.keys(selection).sort()).toEqual(["candidateIds", "inputDigest", "kind", "reviewPlanId"]);
    expect(() => identitySelectionForPlan(plan)).toThrow();
  });
  it("preserves ordinary conflict choices and legacy revision rendering beside v2 readiness", () => {
    const choices: TradeChangeChoices = { conflicts: [{ conflictId: "conflict", decision: "use-incoming", reason: "source corrected" }], missingExecutions: [{ executionId: "missing", action: "keep" }], reactivateExecutions: [{ executionId: "withdrawn", action: "keep-withdrawn" }] };
    expect(tradePlanChoicesComplete(plan, choices)).toBe(true);
    const preview = { sourceKind: "tradingview" } as ImportPreview;
    expect(tradePlanReadyForPreview(plan, preview)).toBe(false);
    const fresh = { ...identityPlan(), status: "ready" as const, identityReviews: [] };
    expect(tradePlanReadyForPreview(fresh, preview)).toBe(true);
    render(<TradePlanReview plan={revisionPlan(serverFact(revisionBefore, null), serverFact({ ...revisionBefore, price: "0" }, null))} executions={[revisionBefore]} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByText(/修订/)).toBeInTheDocument();
    expect(screen.getByText(/234.567890123456789012/)).toBeInTheDocument();
  });

  it("does not unlock v2 saving while identity reviews remain, or TradingView proof is missing", () => {
    const review = identityPlan();
    expect(planNeedsChoices(review)).toBe(true);
    const ready = { ...review, status: "ready" as const, identityReviews: [] };
    expect(tradePlanChoicesComplete(ready, {})).toBe(true);
    expect(tradePlanChoicesComplete({ ...ready, identityReviews: review.identityReviews }, {})).toBe(false);
    expect(tradePlanReadyForPreview({ ...ready, tvImportGuard: undefined }, { ...preview, sourceKind: "tradingview" })).toBe(false);
    expect(tradePlanReadyForPreview({ ...ready, summary: { ...ready.summary, tradingViewImport: undefined } }, { ...preview, sourceKind: "tradingview" })).toBe(false);
    expect(tradePlanReadyForPreview({ ...ready, identityReviews: review.identityReviews }, { ...preview, sourceKind: "tradingview" })).toBe(false);
  });

  it.each([
    [{ kind: "reuse-exact", materialId: "M", versionId: "V", semanticDigest: "digest" }, "精确重导：复用已有完整材料，成交与来源沿革不变。"],
    [{ kind: "save-evidence", materialId: "M", versionId: "V", semanticDigest: "digest", reason: "first-evidence", observations: 2, links: 2 }, "本次将保存来源证据与沿革；成交重复不代表材料已经存在。"],
  ] satisfies [NonNullable<ReviewPlan["summary"]["tradingViewImport"]>["material"], string][])("explains the server material decision $0.kind", (material, message) => {
    const value = identityPlan();
    const review: ReviewPlan = { ...value, status: "ready", identityReviews: [], summary: { ...value.summary, tradingViewImport: { policy: "tv-import-v1", facts: { accepted: 0, duplicate: 2, conflict: 0 }, identity: { kind: "unchanged" }, material } } };
    render(<TradePlanReview plan={review} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });

  it("explains missing identity information and blocks independent reprepare while disabled", async () => {
    const value = identityPlan();
    const review: ReviewPlan = { ...value, identityReviews: value.identityReviews.map(item => ({ ...item, incomingScopes: item.incomingScopes.map(scope => ({ ...scope, accountId: "", rawRun: { kind: "absent" as const } })) })) };
    const onKeepIndependent = vi.fn();
    render(<TradePlanReview plan={review} choices={{}} onChoicesChange={() => {}} onKeepIndependent={onKeepIndependent} disabled />);
    expect(screen.getAllByText(/未知账户.*原始运行 未提供/)).toHaveLength(2);
    const button = screen.getByRole("button", { name: "确认全部为独立记录并重新准备" });
    expect(button).toBeDisabled();
    await userEvent.setup().click(button);
    expect(onKeepIndependent).not.toHaveBeenCalled();
  });

  it("keeps stored and incoming facts independently readable within their conflict", () => {
    render(<TradePlanReview plan={plan} choices={{}} onChoicesChange={() => {}} />);
    const conflict = screen.getByRole("group", { name: "成交冲突 1" });
    const stored = within(conflict).getByRole("group", { name: "已存成交" });
    const incoming = within(conflict).getByRole("group", { name: "本次候选" });
    expect(stored).toHaveTextContent("苹果（AAPL） · 主账户 · 买入 1.0000000000000001 @ 123.4500000000000001 USD · 费用 未知 · 2026-10-01（仅日期）");
    expect(incoming).toHaveTextContent("苹果（AAPL） · 主账户 · 买入 1.0000000000000001 @ 130 USD · 费用 未知 · 2026-10-01（仅日期）");
    expect(within(conflict).getByRole("combobox", { name: "冲突处理 1" })).toHaveValue("");
  });
  it("renders unknown stored account and fee without certifying a zero fee", () => {
    const unknown: ReviewPlan = { ...plan, conflicts: [], missingExecutions: [], reactivateExecutionIds: [], summary: { ...plan.summary, changes: [{ kind: "add", executionId: "unknown", after: { instrumentId: "US:AAPL", accountId: null, side: "buy", executedAt: "2026-10-01", quantity: "1", price: "0", fee: null, currency: "USD" } }] } };
    render(<TradePlanReview plan={unknown} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByText(/未知账户/)).toHaveTextContent("费用 未知");
    expect(screen.queryByText(/费用 0/)).not.toBeInTheDocument();
    expect(screen.getByText(/仅日期/)).toBeInTheDocument();
  });
  it("defaults to an independent material and requires an explicit replacement selection", async () => {
    const user = userEvent.setup();
    let selected = "";
    render(<ImportMaterialSelection options={[{ id: "M1", currentVersionId: "V1", label: "old.pdf · 主账户 · 2026-01 · 指纹 abc…" }]} value="" onChange={value => { selected = value; }} />);
    expect(screen.getByRole("combobox", { name: "来源材料处理" })).toHaveValue("");
    await user.selectOptions(screen.getByRole("combobox", { name: "来源材料处理" }), "M1");
    expect(selected).toBe("M1");
    expect(screen.getByText(/将此文件作为所选材料的新版本/)).toBeInTheDocument();
  });
  it("requires every explicit permitted choice and destructive reason without offering forbidden keep-both", async () => {
    const user = userEvent.setup(); render(<Harness />);
    expect(screen.getByRole("button", { name: "保存计划" })).toBeDisabled();
    const conflict = screen.getByRole("combobox", { name: "冲突处理 1" });
    expect(within(conflict).queryByRole("option", { name: /两者保留/ })).not.toBeInTheDocument();
    await user.selectOptions(conflict, "use-incoming");
    await user.type(screen.getByLabelText("替换理由 1"), "原文件更正价格");
    expect(screen.getByText(/其他来源 1/)).toBeInTheDocument();
    expect(screen.getByText(/人工修订 1/)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "缺失成交处理 1" }), "withdraw");
    await user.type(screen.getByLabelText("撤回理由 1"), "材料更正并核对原凭证");
    await user.selectOptions(screen.getByRole("combobox", { name: "恢复成交处理 1" }), "activate");
    expect(screen.getByRole("button", { name: "保存计划" })).toBeDisabled();
    await user.type(screen.getByLabelText("恢复理由 1"), "重新核实有效成交");
    expect(screen.getByRole("button", { name: "保存计划" })).toBeEnabled();
    expect(screen.getAllByText(/费用 未知/).length).toBeGreaterThan(0);
    expect(screen.queryByText("plan-private-id")).not.toBeInTheDocument();
  });
});

describe("server review fact display", () => {
  // Break caught: raw empty unknown fees losing the matching name and unknown label.
  it.each([null, ""])('reads before and after facts with a preserved raw unknown fee %j', rawFee => {
    const after = { ...revisionBefore, price: "234.567890123456789099" };
    render(<TradePlanReview plan={revisionPlan(serverFact(revisionBefore, rawFee), serverFact(after, rawFee))} executions={[revisionBefore, after]} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByText("苹果（AAPL） · 主账户 · 买入 2.0000000000000002 @ 234.567890123456789012 USD · 费用 未知 · 2026/10/02 21:30:00（北京时间）")).toBeInTheDocument();
    expect(screen.getByText("苹果（AAPL） · 主账户 · 买入 2.0000000000000002 @ 234.567890123456789099 USD · 费用 未知 · 2026/10/02 21:30:00（北京时间）")).toBeInTheDocument();
  });

  // Break caught: an unknown numeric placeholder stealing a reported fact's labels.
  it.each(["0", "7.250000000000000001"])('preserves reported fee %s even beside an unknown numeric placeholder', fee => {
    const reported = { ...revisionBefore, fee, source: { ...revisionBefore.source, feeStatus: "reported" as const } };
    const unknown = { ...reported, accountLabel: "不得借用的未知候选", source: { ...reported.source, feeStatus: "unknown" as const } };
    render(<TradePlanReview plan={revisionPlan(serverFact(reported, fee))} executions={[unknown, reported]} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByText(/苹果（AAPL）/)).toHaveTextContent(`主账户 · 买入 2.0000000000000002 @ 234.567890123456789012 USD · 费用 ${fee}`);
    expect(screen.queryByText(/费用 未知/)).not.toBeInTheDocument();
    expect(screen.queryByText(/不得借用/)).not.toBeInTheDocument();
  });

  // Break caught: loosening a fact field or rounding strings to borrow unknown status.
  it.each([
    ["account", { accountId: "other-account" }],
    ["instrument", { instrument: { ...revisionBefore.instrument, id: "US:MSFT" } }],
    ["side", { side: "sell" as const }],
    ["quantity last digit", { quantity: "2.0000000000000003" }],
    ["price last digit", { price: "234.567890123456789013" }],
    ["timestamp millisecond", { executedAt: "2026-10-02T13:30:00.124Z" }],
    ["fee placeholder", { fee: "0" }],
  ] satisfies [string, Partial<TradeExecution>][])('does not borrow metadata or unknown status from a different %s', (_field, patch) => {
    const unrelated = { ...revisionBefore, accountLabel: "不得借用的其他成交", ...patch };
    render(<TradePlanReview plan={revisionPlan(serverFact(revisionBefore, ""))} executions={[unrelated]} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByText(/US:AAPL/)).toHaveTextContent("US:AAPL · A · 买入 2.0000000000000002 @ 234.567890123456789012 USD");
    expect(screen.queryByText(/苹果（AAPL）|不得借用|费用 未知/)).not.toBeInTheDocument();
  });

  it("does not infer unknown status from an empty fee without matching unknown evidence", () => {
    const unverified = { ...revisionBefore, source: { ...revisionBefore.source, feeStatus: "reported" as const } };
    render(<TradePlanReview plan={revisionPlan(serverFact(unverified, ""))} executions={[unverified]} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByText(/苹果（AAPL）/)).toHaveTextContent("主账户");
    expect(screen.queryByText(/费用 未知/)).not.toBeInTheDocument();
  });

  it.each([
    ["sell", "卖出"],
    ["legacy-side", "legacy-side"],
  ])("retains %s facts and raw invalid dates without inventing a currency", (side, label) => {
    render(<TradePlanReview plan={revisionPlan({ ...serverFact(execution, null), side, currency: null, executedAt: "来源日期待核对" })} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByText(/来源日期待核对/)).toHaveTextContent(`${label} 1.0000000000000001 @ 123.4500000000000001 未知币种 · 费用 未知 · 来源日期待核对`);
  });

  it("preserves reported conflict fees for an execution without a known account", () => {
    const reported: TradeExecution = { ...execution, accountId: "", accountLabel: "", side: "sell", fee: "7.5", source: { ...execution.source, feeStatus: "reported" } };
    const review = { ...plan, missingExecutions: [], reactivateExecutionIds: [], conflicts: [{ ...plan.conflicts[0], existing: [reported], incoming: [{ ...reported, price: "124" }] }] };
    render(<TradePlanReview plan={review} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByRole("group", { name: "已存成交" })).toHaveTextContent("未知账户 · 卖出 1.0000000000000001 @ 123.4500000000000001 USD · 费用 7.5");
  });

  it("shows duplicate account fallbacks and an empty unknown fee without reporting a zero", () => {
    const fact: ImportDuplicateFact = { accountId: "", accountLabel: "", instrument: execution.instrument, executedAt: "来源日期待核对", side: "sell", quantity: "1", price: "123", fee: " ", source: { platform: "broker", fileName: null, page: null, row: 0 } };
    const review = { ...plan, conflicts: [], missingExecutions: [], reactivateExecutionIds: [], summary: { ...plan.summary, importDuplicates: { policy: "import-duplicate-review-v1" as const, count: 1, pairs: [{ kept: fact, skipped: { ...fact, accountId: "A" } }] } } };
    render(<TradePlanReview plan={review} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.getByRole("group", { name: "重复候选 1 保留事实" })).toHaveTextContent("未知账户 · 卖出 1 @ 123 USD · 费用 未知 · 来源日期待核对");
    expect(screen.getByRole("group", { name: "重复候选 1 重复事实" })).toHaveTextContent("A · 卖出 1 @ 123 USD · 费用 未知");
    expect(screen.queryByText(/费用 0/)).not.toBeInTheDocument();
  });
});

describe("file import review feedback", () => {
  // A duplicate-file block is terminal for this preview and must not advertise a retry action.
  it.each(["该文件已完整导入，不可重复导入。", "本次全部成交已存在，无新增成交。"])("shows a server file block without an ordinary preparation retry: %s", async error => {
    const onRetry = vi.fn();
    render(<TradeImportPlan plan={plan} preview={preview} loading={false} error={error} fileImportBlocked onRetry={onRetry} choices={{}} onChoicesChange={() => {}} />);
    const result = screen.getByRole("region", { name: "文件导入核对结果" });
    expect(result).toHaveTextContent("本次不可导入");
    expect(within(result).getByRole("alert")).toHaveTextContent(error);
    expect(screen.queryByRole("button", { name: "重新准备审核计划" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "服务器审核计划" })).not.toBeInTheDocument();
    await userEvent.setup().keyboard("{Enter}");
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("allows an ordinary preparation error to retry and displays the fresh plan after recovery", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const props = { plan, preview, loading: false, onRetry, choices: {}, onChoicesChange: () => {} };
    const { rerender } = render(<TradeImportPlan {...props} error="审核计划已过期，请重新准备" />);
    expect(screen.getByRole("alert")).toHaveTextContent("审核计划已过期");
    expect(screen.queryByRole("region", { name: "服务器审核计划" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新准备审核计划" }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<TradeImportPlan {...props} loading error={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("正在核对当前已存成交与本次候选…");
    expect(screen.queryByRole("region", { name: "服务器审核计划" })).not.toBeInTheDocument();
    rerender(<TradeImportPlan {...props} error={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "服务器审核计划" })).toBeInTheDocument();
  });

  it("prevents a second preparation request while the retry action is disabled", async () => {
    const onRetry = vi.fn();
    render(<TradeImportPlan plan={null} preview={preview} loading={false} error="服务暂不可用" onRetry={onRetry} choices={{}} onChoicesChange={() => {}} disabled />);
    const retry = screen.getByRole("button", { name: "重新准备审核计划" });
    expect(retry).toBeDisabled();
    await userEvent.setup().click(retry);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("does not render an unprepared plan or stale choices", () => {
    render(<TradeImportPlan plan={null} preview={preview} loading={false} error={null} onRetry={() => {}} choices={{}} onChoicesChange={() => {}} />);
    expect(screen.queryByRole("region", { name: "服务器审核计划" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Legacy fingerprints cannot be promoted into proof that the original byte stream was imported.
  it("explains a legacy fingerprint and keeps TradingView exact checking separate from independent material", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = { options: [], value: "", onChange, alreadyImported: true, tradingView: true };
    const { rerender } = render(<ImportMaterialSelection {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("这不能证明原文件已完整导入");
    const select = screen.getByRole("combobox", { name: "来源材料处理" });
    expect(select).toHaveValue("");
    expect(within(select).getByRole("option", { name: "核对精确重导或首次保存证据" })).toHaveValue("");
    expect(screen.getByText(/精确重导须由服务器核对当前完整材料/)).toBeInTheDocument();
    await user.selectOptions(select, "__tv_independent__");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("__tv_independent__");

    rerender(<ImportMaterialSelection {...props} value="__tv_independent__" disabled />);
    expect(screen.getByRole("combobox", { name: "来源材料处理" })).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "来源材料处理" }), "");
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("locks all ordinary review controls while a plan operation is pending", async () => {
    const onChoicesChange = vi.fn();
    const choices: TradeChangeChoices = { conflicts: [{ conflictId: "conflict", decision: "use-incoming", reason: "核对价格" }], missingExecutions: [{ executionId: "missing", action: "withdraw", reason: "核对缺行" }], reactivateExecutions: [{ executionId: "withdrawn", action: "activate", reason: "核对恢复" }] };
    render(<TradePlanReview plan={plan} choices={choices} onChoicesChange={onChoicesChange} disabled />);
    for (const control of screen.getAllByRole("combobox")) expect(control).toBeDisabled();
    for (const control of screen.getAllByRole("textbox")) expect(control).toBeDisabled();
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "冲突处理 1" }), "keep-existing");
    expect(onChoicesChange).not.toHaveBeenCalled();
  });
});

describe("retryable file completion intent", () => {
  const monthly = { documentId: "document", templateIds: ["statement"], month: "2026-10", positions: [], events: [], reviewRequired: false };

  // If completion is inferred from visible trade counts alone, each of these must catch it.
  it.each([
    ["blocked parser result", { blocked: true }],
    ["unresolved instrument", { unresolvedInstrumentCount: 1 }],
    ["legacy excluded instrument without completion evidence", { excludedInstrumentCount: 1 }],
    ["legacy excluded row without completion evidence", { exclusionGroups: [{ category: "invalid-row", label: "待核对", count: 1 }] }],
    ["incomplete monthly history", { monthly: { ...monthly, historyIncomplete: true } }],
    ["monthly instrument still pending", { monthly: { ...monthly, incompleteInstruments: [{ market: "US", symbol: "AAPL" }] } }],
    ["scoped monthly supplement", { monthly: { ...monthly, evidenceScope: { instrumentId: "US:AAPL", accountId: "A" } } }],
    ["pending original row hidden by presentation grouping", { completionEvidence: { broker: "tiger", blocked: false, unresolvedInstrumentCount: 0, exclusions: [{ category: "invalid-row", label: "待核对", count: 1, disposition: "pending" }] } }],
    ["incomplete parser evidence despite ready presentation", { completionEvidence: { broker: "tiger", blocked: true, unresolvedInstrumentCount: 0, exclusions: [] } }],
    ["unresolved parser evidence despite ready presentation", { completionEvidence: { broker: "tiger", blocked: false, unresolvedInstrumentCount: 1, exclusions: [] } }],
  ] satisfies [string, Partial<ImportPreview>][])("keeps the exact file retryable for %s", (_name, patch) => {
    const intent = importIntentForPreview({ ...preview, ...patch });
    expect(intent.fileImport).toMatchObject({ ...preview.fileContent, complete: false });
    expect(intent.candidates).toHaveLength(1);
    expect(intent.candidates[0].source.batchId).toBe(preview.id);
  });

  it("requires grouped exclusion totals to match recognized original parser exclusions", () => {
    const exclusion = { category: "fund" as const, label: "基金", count: 2, disposition: "ignored" as const, ruleId: "tiger/pdf/fund-section@1" };
    const completionEvidence = { broker: "tiger" as const, blocked: false, unresolvedInstrumentCount: 0, exclusions: [exclusion] };
    const full: ImportPreview = { ...preview, excludedInstrumentCount: 2, exclusionGroups: [exclusion], completionEvidence };
    expect(importIntentForPreview(full).fileImport).toEqual({ ...preview.fileContent, complete: true, evidence: completionEvidence });
    expect(importIntentForPreview({ ...full, exclusionGroups: [{ ...exclusion, count: 1 }] }).fileImport?.complete).toBe(false);
  });

  it("preserves a complete file identity and candidate facts without mutating the preview", () => {
    const intent = importIntentForPreview({ ...preview, monthly });
    expect(intent.fileImport).toEqual({ ...preview.fileContent, complete: true });
    expect(intent.candidates[0]).toEqual({ ...execution, source: { ...execution.source, batchId: preview.id } });
    expect(execution.source).not.toHaveProperty("batchId");
    expect(intent.importHistory?.[0]).toMatchObject({ id: preview.id, monthly, excludedRecordCount: 0 });
    expect(intent.instruments).toEqual([execution.instrument]);
  });

  it("does not issue a file success identity for screenshots or previews without original bytes", () => {
    const screenshot = importIntentForPreview({ ...preview, sourceKind: "screenshot", captureCount: 2, conflictTradeCount: 1 });
    expect(screenshot).not.toHaveProperty("fileImport");
    expect(screenshot.importHistory?.[0]).toMatchObject({ sourceKind: "screenshot", captureCount: 2, conflictTradeCount: 1 });
    const withoutBytes = importIntentForPreview({ ...preview, fileContent: undefined });
    expect(withoutBytes).not.toHaveProperty("fileImport");
    const screenshotWithoutCounts = importIntentForPreview({ ...preview, sourceKind: "screenshot" });
    expect(screenshotWithoutCounts.importHistory?.[0]).toMatchObject({ captureCount: 0, conflictTradeCount: 0 });
  });

  it("retains the TradingView source, simulation identity and server exact-material policy", () => {
    const evidence: NonNullable<ImportPreview["tradingViewEvidence"]> = { kind: "tradingview-xlsx-records-v1", fidelity: "xlsx-decoded-records-raw-false", parserVersion: "tradingview-simulation-v2", fileFingerprint: "fingerprint", sheet: { ordinal: 0, name: "交易" }, headers: [], rows: [], cellDiagnostics: [], derived: { accountId: "A", accountOrigin: "parser-canonical-constant", tradeNature: "simulation", natureOrigin: "parser-format-contract", sourceRun: "run:source", runOrigin: "parser-fingerprint-market-symbol", market: "US", symbol: "AAPL", currency: "USD" } };
    const value: ImportPreview = { ...preview, sourceKind: "tradingview", tradeNature: "simulation", simulationRunId: "run:source", tradingViewEvidence: evidence };
    const intent = importIntentForPreview(value);
    expect(intent.tradingViewImport).toEqual({ policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" }, evidence });
    expect(intent.importHistory?.[0]).toMatchObject({ sourceKind: "tradingview", tradeNature: "simulation", simulationRunId: "run:source" });
    expect(intent.fileImport?.complete).toBe(true);
    expect(importIntentForPreview({ ...value, tradingViewEvidence: undefined }).tradingViewImport).toEqual({ policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" } });
  });
});

describe("review readiness gates", () => {
  it("requires explicit choices for each affected kind and none for an empty legacy plan", () => {
    const empty = { ...plan, conflicts: [], missingExecutions: [], reactivateExecutionIds: [] };
    expect(planNeedsChoices(empty)).toBe(false);
    expect(planNeedsChoices({ ...empty, conflicts: plan.conflicts })).toBe(true);
    expect(planNeedsChoices({ ...empty, missingExecutions: plan.missingExecutions })).toBe(true);
    expect(planNeedsChoices({ ...empty, reactivateExecutionIds: plan.reactivateExecutionIds })).toBe(true);
    expect(tradePlanReadyForPreview(empty, preview)).toBe(true);
  });

  // A whitespace-only destructive reason must never unlock the actual save control.
  it("keeps save disabled for whitespace reasons, then unlocks non-destructive choices", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByRole("combobox", { name: "冲突处理 1" }), "use-incoming");
    await user.type(screen.getByRole("textbox", { name: "替换理由 1" }), "   ");
    await user.selectOptions(screen.getByRole("combobox", { name: "缺失成交处理 1" }), "keep");
    await user.selectOptions(screen.getByRole("combobox", { name: "恢复成交处理 1" }), "keep-withdrawn");
    expect(screen.getByRole("button", { name: "保存计划" })).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "冲突处理 1" }), "keep-existing");
    expect(screen.queryByRole("textbox", { name: "替换理由 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存计划" })).toBeEnabled();
  });

  it("previews only the changes selected for conflict, missing and reappearing executions", async () => {
    const user = userEvent.setup();
    const fact = serverFact(execution, null);
    const review: ReviewPlan = { ...plan, summary: { ...plan.summary, changes: [
      { kind: "link", materialId: "M" },
      { kind: "replace", executionId: execution.id, before: fact, after: { ...fact, price: "130" }, when: { conflictId: "conflict", decisions: ["use-incoming"] } },
      { kind: "withdraw", executionId: "missing", before: fact, when: { missingExecutionId: "missing", action: "withdraw" } },
      { kind: "reactivate", executionId: "withdrawn", after: fact, when: { reactivateExecutionId: "withdrawn", action: "activate" } },
    ] } };
    function ChangesHarness() {
      const [choices, setChoices] = useState<TradeChangeChoices>({});
      return <TradePlanReview plan={review} choices={choices} onChoicesChange={setChoices} />;
    }
    render(<ChangesHarness />);
    expect(screen.getByText(/按当前选择变更/)).toHaveTextContent("按当前选择变更 1 项");
    expect(screen.getByText("来源证据更新")).toBeInTheDocument();
    expect(screen.queryByText("替换", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "当前已存成交" })).toHaveTextContent("买入 1.0000000000000001");
    expect(screen.getByRole("group", { name: "已撤回成交" })).toHaveTextContent("买入 1.0000000000000001");

    await user.selectOptions(screen.getByRole("combobox", { name: "冲突处理 1" }), "use-incoming");
    await user.selectOptions(screen.getByRole("combobox", { name: "缺失成交处理 1" }), "withdraw");
    await user.selectOptions(screen.getByRole("combobox", { name: "恢复成交处理 1" }), "activate");
    expect(screen.getByText(/按当前选择变更/)).toHaveTextContent("按当前选择变更 4 项");
    for (const label of ["替换", "撤回", "恢复"]) expect(screen.getByText(label, { selector: "strong" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "缺失成交处理 1" }), "keep");
    await user.selectOptions(screen.getByRole("combobox", { name: "恢复成交处理 1" }), "keep-withdrawn");
    expect(screen.getByText(/按当前选择变更/)).toHaveTextContent("按当前选择变更 2 项");
    expect(screen.queryByText("撤回", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.queryByText("恢复", { selector: "strong" })).not.toBeInTheDocument();
  });
});
