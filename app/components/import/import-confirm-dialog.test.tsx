import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ImportPreview } from "../../lib/import/import-preview";
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
    expect(screen.getByText("重复成交")).toBeInTheDocument();
    expect(screen.getByText("1 笔已跳过")).toBeInTheDocument();

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

afterEach(cleanup);
