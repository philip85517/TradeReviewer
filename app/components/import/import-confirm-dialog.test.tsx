import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ImportPreview } from "../../lib/import/import-preview";
import type { ExecutionConflict, ReconciliationDecision } from "../../lib/import/execution-reconciliation";
import type { TradeExecution } from "../../lib/trades/types";
import { EpisodeSidebar } from "../review/episode-sidebar";
import { ImportConfirmDialog } from "./import-confirm-dialog";

const preview: ImportPreview = {
  id: "import:abc",
  fileName: "Tiger_2025.pdf",
  sourceLabel: "Tiger 证券",
  sourceKind: "statement",
  records: [],
  instruments: [
    {
      instrument: {
        id: "HK:700",
        symbol: "700",
        name: "腾讯控股",
        market: "HK",
        currency: "HKD",
      },
      executions: [],
      tradeCount: 2,
      firstTradeAt: "2025-03-01T00:00:00.000Z",
      lastTradeAt: "2025-03-10T00:00:00.000Z",
    },
  ],
  unresolved: [
    {
      market: "US",
      symbol: "BROKEN",
      attempts: [
        {
          source: "nasdaq",
          code: "not-found",
          message: "未找到证券",
        },
        {
          source: "sec",
          code: "timeout",
          message: "请求超时 https://private.example?token=secret",
        },
      ],
    },
  ],
  exclusionGroups: [
    { category: "bond", label: "可转债", count: 2 },
  ],
  tradeCount: 2,
  instrumentCount: 1,
  duplicateTradeCount: 1,
  unresolvedInstrumentCount: 1,
  excludedInstrumentCount: 1,
  firstTradeAt: "2025-03-01T00:00:00.000Z",
  lastTradeAt: "2025-03-10T00:00:00.000Z",
  blocked: false,
};

describe("ImportConfirmDialog", () => {
  it("shows complete names, categorized exclusions, and unresolved retry", async () => {
    const onConfirm = vi.fn();
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ImportConfirmDialog
        preview={preview}
        onCancel={() => {}}
        onConfirm={onConfirm}
        onRetryUnresolved={onRetry}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "确认导入交易记录" });
    expect(dialog).toHaveClass("import-confirm-dialog");
    expect(dialog.querySelector(".import-dialog-body")).toBeInTheDocument();
    expect(dialog.querySelector(".modal-footer")).toBeInTheDocument();
    expect(screen.getByText("腾讯控股（700）")).toBeInTheDocument();
    expect(screen.getByText("可转债 2 笔")).toBeInTheDocument();
    expect(screen.getByText("1 个标的暂未导入")).toBeInTheDocument();
    expect(
      screen.getByText("NASDAQ：not-found · 未找到证券"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("SEC：timeout · 请求超时 外部服务"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private\.example/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /股票名称/ })).not.toBeInTheDocument();
    expect(screen.getByText("导入前重复预估")).toBeInTheDocument();
    expect(screen.getByText("1 笔（原始预估）")).toBeInTheDocument();
    expect(screen.queryByText("1 笔已跳过")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(onRetry).toHaveBeenCalledWith(["US:BROKEN"]);

    await user.click(
      screen.getByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("closes with Escape", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ImportConfirmDialog
        preview={preview}
        onCancel={onCancel}
        onConfirm={() => {}}
        onRetryUnresolved={() => {}}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("explains the actual target-scope delta before a supplement is saved", () => {
    render(
      <ImportConfirmDialog
        preview={{
          ...preview,
          supplementChangeSummary: {
            newTradeCount: 1,
            revisedTradeCount: 1,
            evidenceRevisionCount: 1,
            unchangedTradeCount: 1,
          },
          duplicateTradeCount: 2,
        }}
        scopeNotice="仅补充 US:700 / 账户"
        onCancel={() => {}}
        onConfirm={() => {}}
        onRetryUnresolved={() => {}}
      />,
    );

    const summary = screen.getByRole("region", { name: "补充导入实际变更" });
    expect(summary).toHaveTextContent("新增成交 1 笔");
    expect(summary).toHaveTextContent("修订 1 笔");
    expect(summary).toHaveTextContent("其中仅证据修订 1 笔");
    expect(summary).toHaveTextContent("来源重复 2 笔");
    expect(summary).toHaveTextContent("未新增成交");
    expect(summary).toHaveTextContent("已有成交仍可能修订证据");
    expect(summary).not.toHaveTextContent("重复或无变化");
  });

  it("separates scoped source duplicates from evidence revisions", () => {
    render(
      <ImportConfirmDialog
        preview={{
          ...preview,
          supplementChangeSummary: {
            newTradeCount: 0,
            revisedTradeCount: 2,
            evidenceRevisionCount: 2,
            unchangedTradeCount: 0,
          },
          duplicateTradeCount: 1,
        }}
        scopeNotice="仅补充 US:700 / 账户"
        onCancel={() => {}}
        onConfirm={() => {}}
        onRetryUnresolved={() => {}}
      />,
    );

    const summary = screen.getByRole("region", { name: "补充导入实际变更" });
    expect(summary).toHaveTextContent("新增成交 0 笔");
    expect(summary).toHaveTextContent("修订 2 笔");
    expect(summary).toHaveTextContent("其中仅证据修订 2 笔");
    expect(summary).toHaveTextContent("来源重复 1 笔");
    expect(summary).toHaveTextContent("未新增成交");
    expect(summary).toHaveTextContent("已有成交仍可能修订证据");
    expect(summary).not.toHaveTextContent("重复或无变化");

    const duplicateStat = screen.getByText("来源重复", { selector: "span" }).parentElement;
    expect(duplicateStat).toHaveTextContent("1 笔来源重复（未新增成交）");
    expect(duplicateStat).not.toHaveTextContent("已跳过");
  });

  it("retries only the unresolved instruments selected by the user", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ImportConfirmDialog
        preview={{
          ...preview,
          unresolved: [
            ...preview.unresolved,
            {
              market: "HK",
              symbol: "99999",
              attempts: [],
            },
          ],
          unresolvedInstrumentCount: 2,
        }}
        onCancel={() => {}}
        onConfirm={() => {}}
        onRetryUnresolved={onRetry}
      />,
    );
    const dialog = within(container);

    await user.click(
      dialog.getByRole("checkbox", {
        name: "选择重新查询 99999",
      }),
    );
    await user.click(
      dialog.getByRole("button", { name: "重新查询" }),
    );

    expect(onRetry).toHaveBeenCalledWith(["US:BROKEN"]);
  });

  it("accepts xlsx, xls, and pdf from one input and shows phased progress", () => {
    render(
      <EpisodeSidebar
        importedInstruments={[]}
        importing
        importPhase="resolving"
        importError={null}
        onImport={() => {}}
        onScreenshotImport={() => {}}
        onOpenHistory={() => {}}
        revealedDemoExecutions={[]}
        selectedInstrumentId="demo"
        onSelectInstrument={() => {}}
        marketDataStatuses={{}}
        onUpdateMarketData={() => {}}
      />,
    );

    expect(screen.getByLabelText("导入交易记录")).toHaveAttribute(
      "accept",
      ".xlsx,.xls,.pdf",
    );
    for (const label of [
      "识别格式",
      "解析成交",
      "识别股票",
      "补全名称",
      "准备行情",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "导入进度：补全名称（进行中）",
    );
    expect(screen.getByText("补全名称").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(
      screen.getByText("补全名称").closest("li"),
    ).toHaveAccessibleName("补全名称，进行中");
    expect(screen.getAllByRole("button", { name: /导入记录/ })).toHaveLength(1);
  });
});

it("announces save failure inside the open preview and permits retry", async()=>{
 const confirm=vi.fn();
 render(<ImportConfirmDialog preview={preview} onCancel={()=>{}} onConfirm={confirm} onRetryUnresolved={()=>{}} saveError="SQLite 保存失败，请重试" />);
 expect(screen.getByRole('alert')).toHaveTextContent('SQLite 保存失败');
 await userEvent.setup().click(screen.getByRole('button',{name:'确认导入并开始更新行情'}));
 expect(confirm).toHaveBeenCalledOnce();
});

describe("import confirmation safety and retry controls", () => {
  // Removing the server-bound disabled flag or treating a blocked file as an estimate must fail.
  it.each([
    ["file", "已导入，不可重复导入"],
    ["trades", "全部成交已存在，无新增"],
  ] as const)("shows the %s block as a final check and prevents confirmation", async (fileImportBlock, message) => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ImportConfirmDialog preview={preview} fileImportBlock={fileImportBlock} confirmDisabled onCancel={onCancel} onConfirm={onConfirm} onRetryUnresolved={() => {}} />);

    expect(screen.getByText("导入核对结果")).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText("导入前重复预估")).not.toBeInTheDocument();
    expect(screen.queryByText("1 笔（原始预估）")).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "确认导入并开始更新行情" });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  // Each gate independently prevents saving; a passing sibling gate cannot hide its removal.
  it.each([
    { name: "parent review is incomplete", props: { confirmDisabled: true } },
    { name: "preview has no complete trades", props: { preview: { ...preview, blocked: true } } },
    { name: "metadata retry is in progress", props: { retryingUnresolved: true } },
    { name: "save is in progress", props: { saving: true } },
  ])("does not confirm while $name", async ({ props }) => {
    const onConfirm = vi.fn();
    render(<ImportConfirmDialog preview={preview} onCancel={() => {}} onConfirm={onConfirm} onRetryUnresolved={() => {}} {...props} />);
    const confirm = screen.getByRole("button", { name: props.saving ? "正在保存…" : "确认导入并开始更新行情" });
    expect(confirm).toBeDisabled();
    await userEvent.setup().click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Escape must use current lock props, as well as the visible cancel and close buttons.
  it.each(["saving", "dismissDisabled"] as const)("locks dismissal and metadata inputs during %s, then unlocks cancellation", async lock => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const props = { preview, onCancel, onConfirm: () => {}, onRetryUnresolved: vi.fn() };
    const { rerender } = render(<ImportConfirmDialog {...props} {...{ [lock]: true }} />);
    expect(screen.getByRole("button", { name: "关闭导入确认" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重新查询" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "选择重新查询 BROKEN" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "关闭导入确认" }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();

    rerender(<ImportConfirmDialog {...props} />);
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("closes through the header button without requesting confirmation", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ImportConfirmDialog preview={preview} onCancel={onCancel} onConfirm={onConfirm} onRetryUnresolved={() => {}} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "关闭导入确认" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Re-enabling a deselected item must remove it from the exclusion set, not leave a dead retry button.
  it("disables retry with no selection and retries only the item reselected after a pending query", async () => {
    const user = userEvent.setup();
    const onRetryUnresolved = vi.fn();
    const unresolvedPreview: ImportPreview = { ...preview, unresolvedInstrumentCount: 2, unresolved: [...preview.unresolved, { market: "HK", symbol: "99999", attempts: [] }] };
    const props = { preview: unresolvedPreview, onCancel: () => {}, onConfirm: () => {}, onRetryUnresolved };
    const { rerender } = render(<ImportConfirmDialog {...props} />);
    expect(screen.getByText("暂无可用数据源")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "选择重新查询 BROKEN" }));
    await user.click(screen.getByRole("checkbox", { name: "选择重新查询 99999" }));
    expect(screen.getByRole("button", { name: "重新查询" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(onRetryUnresolved).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: "选择重新查询 99999" }));
    rerender(<ImportConfirmDialog {...props} retryingUnresolved />);
    expect(screen.getByRole("button", { name: "正在查询…" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "选择重新查询 99999" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "选择重新查询 99999" })).toBeDisabled();
    rerender(<ImportConfirmDialog {...props} />);
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(onRetryUnresolved).toHaveBeenCalledExactlyOnceWith(["HK:99999"]);
    expect(screen.getByRole("checkbox", { name: "选择重新查询 BROKEN" })).not.toBeChecked();
  });

  it("does not retry a resolved instrument after the preview is refreshed", async () => {
    const user = userEvent.setup();
    const onRetryUnresolved = vi.fn();
    const props = { onCancel: () => {}, onConfirm: () => {}, onRetryUnresolved };
    const { rerender } = render(<ImportConfirmDialog {...props} preview={preview} />);
    rerender(<ImportConfirmDialog {...props} preview={{ ...preview, unresolved: [{ market: "HK", symbol: "700", attempts: [] }] }} />);
    expect(screen.queryByRole("checkbox", { name: "选择重新查询 BROKEN" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(onRetryUnresolved).toHaveBeenCalledExactlyOnceWith(["HK:700"]);
  });

  it("keeps the server review and save error visible when a failed save is retried", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const props = { preview, scopeNotice: "仅补充 HK:700 / 主账户", onCancel: () => {}, onConfirm, onRetryUnresolved: () => {}, reviewPlanContent: <p>服务器已核对本次候选</p> };
    const { rerender } = render(<ImportConfirmDialog {...props} saveError="保存失败，请重试" />);
    expect(screen.getByRole("status")).toHaveTextContent("仅补充 HK:700 / 主账户");
    expect(screen.getByText("服务器已核对本次候选")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请重试");
    await user.click(screen.getByRole("button", { name: "确认补充当前股票成交" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    rerender(<ImportConfirmDialog {...props} confirmLabel="再次保存审核计划" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "再次保存审核计划" }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("keeps incomplete previews readable with their reason and no confirmable instruments", () => {
    render(<ImportConfirmDialog preview={{ ...preview, blocked: true, blockingReason: "仍有未处理的成交行，请重新核对源文件", instruments: [], firstTradeAt: undefined, lastTradeAt: undefined, notices: ["第 2 页有待核对行"] }} onCancel={() => {}} onConfirm={() => {}} onRetryUnresolved={() => {}} />);
    expect(screen.getByText("仍有未处理的成交行，请重新核对源文件")).toBeInTheDocument();
    expect(screen.getByText("当前文件没有可确认导入的股票或 ETF 成交。")).toBeInTheDocument();
    expect(screen.getByText("— — —")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "账单解析说明" })).toHaveTextContent("第 2 页有待核对行");
    expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled();
  });

  it("sanitizes and deduplicates external retry failures without exposing URLs or controls", () => {
    const failure = { source: "nasdaq" as const, code: " <>\u0000 ", message: "<>\u0000\u007f" };
    const longFailure = { source: "sec" as const, code: "x".repeat(50), message: "失败".repeat(60) };
    render(<ImportConfirmDialog preview={{ ...preview, unresolved: [{ market: "US", symbol: "BROKEN", attempts: [failure, failure, longFailure] }] }} onCancel={() => {}} onConfirm={() => {}} onRetryUnresolved={() => {}} />);
    expect(screen.getAllByText("NASDAQ：unknown · 查询失败")).toHaveLength(1);
    expect(screen.getByText(`SEC：${"x".repeat(40)} · ${"失败".repeat(50)}`)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("requires every legacy conflict choice before confirming, with reported and unknown fees kept distinct", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const unknown: TradeExecution = { id: "unknown", accountId: "A", accountLabel: "主账户", instrument: preview.instruments[0].instrument, side: "buy", quantity: "2", price: "300", fee: "0", executedAt: "2026-10-01", source: { platform: "broker", row: 1, feeStatus: "unknown" } };
    const reported: TradeExecution = { ...unknown, id: "reported", fee: "2.5", source: { ...unknown.source, feeStatus: "reported", fileName: "原账单.pdf", page: 3 } };
    const conflicts: ExecutionConflict[] = [
      { id: "first", candidateKey: "first", existing: [unknown, reported], incoming: [unknown, reported] },
      { id: "second", candidateKey: "second", existing: [reported], incoming: [reported] },
    ];
    function ConflictsHarness() {
      const [decisions, setDecisions] = useState<ReadonlyMap<string, ReconciliationDecision>>(new Map());
      return <ImportConfirmDialog preview={preview} conflicts={conflicts} conflictDecisions={decisions} onConflictDecision={(id, decision) => setDecisions(current => new Map(current).set(id, decision))} onCancel={() => {}} onConfirm={onConfirm} onRetryUnresolved={() => {}} />;
    }
    render(<ConflictsHarness />);
    const review = screen.getByRole("region", { name: "月结单成交冲突" });
    expect(review).toHaveTextContent("费用 待核对（已有来源）");
    expect(review).toHaveTextContent("费用 2.5 HKD（原账单.pdf）");
    expect(review).toHaveTextContent("费用 待核对（第 ? 页）");
    expect(review).toHaveTextContent("费用 2.5 HKD（第 3 页）");
    const confirm = screen.getByRole("button", { name: "确认导入并开始更新行情" });
    expect(confirm).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "冲突处理 first" }), "keep-existing");
    expect(confirm).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "冲突处理 second" }), "use-incoming");
    expect(confirm).toBeEnabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "冲突处理 first" }), "keep-both");
    expect(screen.getByRole("combobox", { name: "冲突处理 first" })).toHaveValue("keep-both");
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows the default incomplete-file reason when the parser supplied none", () => {
    render(<ImportConfirmDialog preview={{ ...preview, blocked: true, duplicateTradeCount: 0, unresolved: [], unresolvedInstrumentCount: 0 }} onCancel={() => {}} onConfirm={() => {}} onRetryUnresolved={() => {}} />);
    expect(screen.getByText("没有完整的股票或 ETF 成交可以导入。")).toBeInTheDocument();
    expect(screen.getByText("0 笔（原始预估）")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新查询" })).not.toBeInTheDocument();
  });

  it("identifies TradingView date-only simulation records before confirmation", () => {
    render(<ImportConfirmDialog preview={{ ...preview, sourceKind: "tradingview" }} onCancel={() => {}} onConfirm={() => {}} onRetryUnresolved={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("模拟盘 · TradingView");
    expect(screen.getByRole("status")).toHaveTextContent("文件只提供交易日期");
  });

  it("retains the monthly evidence summary even when there are no trade records", () => {
    render(<ImportConfirmDialog preview={{ ...preview, records: [], tradeCount: 0, monthly: { documentId: "month", month: "2026-09", templateIds: ["Tiger", "monthly"], positions: [], events: [], reviewRequired: false, timePolicy: "保留来源日期" } }} onCancel={() => {}} onConfirm={() => {}} onRetryUnresolved={() => {}} />);
    expect(screen.getByText("月结单证据将一并保存")).toBeInTheDocument();
    expect(screen.getByText("2026-09 · Tiger / monthly · 0 条持仓快照 · 0 条辅助流水")).toBeInTheDocument();
    expect(screen.getByText("保留来源日期")).toBeInTheDocument();
    expect(screen.getByText("成交和月结单证据保存到本机；无成交月份也保留账期与持仓证据。")).toBeInTheDocument();
  });

  it.each([undefined, 0, 2])("shows the actual handled screenshot conflict count %s", conflictTradeCount => {
    render(<ImportConfirmDialog preview={{ ...preview, sourceKind: "screenshot", conflictTradeCount }} onCancel={() => {}} onConfirm={() => {}} onRetryUnresolved={() => {}} />);
    expect(screen.getByText("成交冲突")).toBeInTheDocument();
    expect(screen.getByText(`${conflictTradeCount ?? 0} 笔已处理`)).toBeInTheDocument();
  });
});

afterEach(cleanup);
