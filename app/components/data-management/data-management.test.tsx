import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import {
  EMPTY_GLOBAL_MARKET_REFRESH,
  type GlobalMarketRefreshState,
} from "../global-market-refresh";
import { DataManagement } from "./data-management";

afterEach(cleanup);

const retainedInstrument: StoredInstrument = {
  id: "US:RETAINED",
  symbol: "RETAINED",
  name: "保留标的",
  market: "US",
  currency: "USD",
};

function renderPage(overrides: Partial<ComponentProps<typeof DataManagement>> = {}) {
  const props: ComponentProps<typeof DataManagement> = {
    importActions: {
      disabled: false,
      onFile: vi.fn(),
      onScreenshot: vi.fn(),
      onTradingView: vi.fn(),
    },
    marketRefresh: {
      instrumentCount: 1,
      state: EMPTY_GLOBAL_MARKET_REFRESH,
      onRefresh: vi.fn(),
      onCancel: vi.fn(),
      onRetryFailed: vi.fn(),
      onRecoverUnfinished: vi.fn(),
    },
    retainedInstruments: [retainedInstrument],
    activeInstrumentIds: [],
    onOpenDataCheck: vi.fn(),
    ...overrides,
  };
  return { ...render(<DataManagement {...props} />), props };
}

describe("DataManagement", () => {
  it("defaults to import and switches visible content without writing business data", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    renderPage({
      onTabChange,
      qualitySlot: <output aria-label="数据健康内容">数据健康明细内容</output>,
      principalSlot: <output aria-label="本金配置内容">本金配置表单</output>,
      fxSlot: <output aria-label="汇率内容">汇率表单</output>,
    });

    expect(screen.getByRole("tablist", { name: "数据管理分组" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "导入记录" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "数据健康" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tabpanel", { name: "导入记录" })).toHaveAttribute(
      "aria-labelledby",
      screen.getByRole("tab", { name: "导入记录" }).id,
    );
    expect(screen.getByRole("region", { name: "导入交易数据" })).toBeVisible();
    expect(screen.getByRole("region", { name: "数据健康明细", hidden: true })).not.toBeVisible();
    expect(screen.getByRole("region", { name: "本金与参考收益率配置", hidden: true })).not.toBeVisible();

    await user.click(screen.getByRole("tab", { name: "数据健康" }));

    expect(onTabChange).toHaveBeenCalledWith("quality");
    expect(screen.getByRole("region", { name: "数据健康明细" })).toBeVisible();
    expect(screen.getByRole("region", { name: "待检查问题" })).toBeVisible();
    expect(screen.getByRole("region", { name: "导入交易数据", hidden: true })).not.toBeVisible();
    expect(screen.getByRole("region", { name: "本金与参考收益率配置", hidden: true })).not.toBeVisible();
  });

  it("moves the data-management tab selection with arrow, Home, and End keys", async () => {
    const user = userEvent.setup();
    renderPage();

    const tabs = [
      screen.getByRole("tab", { name: "导入记录" }),
      screen.getByRole("tab", { name: "数据健康" }),
      screen.getByRole("tab", { name: "账户与计价" }),
    ];
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tabs[1]).toHaveFocus();
  });

  it("keeps one quality heading when the injected quality panel provides its own details heading", async () => {
    const user = userEvent.setup();
    renderPage({
      qualitySlot: (
        <section aria-label="数据健康明细">
          <h2>数据健康明细</h2>
          <p>质量内容</p>
        </section>
      ),
    });

    await user.click(screen.getByRole("tab", { name: "数据健康" }));
    expect(screen.getAllByRole("heading", { name: "数据健康明细" })).toHaveLength(1);
  });

  it("keeps hidden configuration slots mounted so drafts survive tab changes", async () => {
    const user = userEvent.setup();

    renderPage({
      qualitySlot: (
        <label>
          质量草稿
          <input aria-label="质量草稿" defaultValue="未提交草稿" />
        </label>
      ),
      principalSlot: <output aria-label="本金配置内容">本金配置表单</output>,
    });

    await user.click(screen.getByRole("tab", { name: "数据健康" }));
    const draft = screen.getByRole("textbox", { name: "质量草稿" });
    await user.clear(draft);
    await user.type(draft, "保留中的草稿");
    await user.click(screen.getByRole("tab", { name: "账户与计价" }));
    await user.click(screen.getByRole("tab", { name: "数据健康" }));

    expect(screen.getByRole("textbox", { name: "质量草稿" })).toHaveValue("保留中的草稿");
    expect(screen.getByRole("tabpanel", { name: "数据健康" })).toBeVisible();
  });

  it("supports a controlled active tab without changing it locally", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    renderPage({
      activeTab: "quality",
      onTabChange,
      qualitySlot: <output aria-label="数据健康内容">数据健康明细内容</output>,
    });

    expect(screen.getByRole("region", { name: "数据健康明细" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "账户与计价" }));

    expect(onTabChange).toHaveBeenCalledWith("settings");
    expect(screen.getByRole("region", { name: "数据健康明细" })).toBeVisible();
    expect(screen.getByRole("region", { name: "本金与参考收益率配置", hidden: true })).not.toBeVisible();
  });

  it("shows concise empty states when optional quality and settings slots are absent", async () => {
    const user = userEvent.setup();

    renderPage({ qualitySlot: undefined, principalSlot: undefined, fxSlot: undefined });

    await user.click(screen.getByRole("tab", { name: "数据健康" }));
    expect(screen.getByText("暂无数据健康明细。")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "账户与计价" }));
    expect(screen.getByText("暂无本金配置。")).toBeVisible();
    expect(screen.getByText("暂无汇率配置。")).toBeVisible();
  });

  it("groups import, market refresh, and retained-data problems under one page", async () => {
    const user = userEvent.setup();
    const { props } = renderPage();

    expect(screen.getByRole("region", { name: "数据管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数据" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "导入交易数据" })).toBeVisible();
    expect(screen.getByRole("region", { name: "行情数据更新" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "更新全部数据" }));
    expect(props.marketRefresh.onRefresh).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "导入交易记录" }));
    await user.click(screen.getByRole("button", { name: "导入记录 · PDF / Excel" }));
    expect(props.importActions.onFile).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("tab", { name: "数据健康" }));
    expect(screen.getByRole("region", { name: "待检查问题" })).toBeVisible();
    await user.click(screen.getByText("查看已无成交股票的保留记录"));
    await user.click(screen.getByRole("button", { name: "保留标的（RETAINED）数据记录" }));
    expect(props.onOpenDataCheck).toHaveBeenCalledWith(retainedInstrument.id);
  });

  it("renders an injected FX slot without inventing an FX state", async () => {
    const user = userEvent.setup();
    renderPage({ fxSlot: <output aria-label="后续汇率组件">由后续组件提供</output> });

    await user.click(screen.getByRole("tab", { name: "账户与计价" }));
    expect(screen.getByRole("region", { name: "汇率" })).toBeVisible();
    expect(screen.getByLabelText("后续汇率组件")).toHaveTextContent("由后续组件提供");
    expect(screen.queryByText(/汇率已更新|暂无汇率/)).not.toBeInTheDocument();
  });

  it("renders quality details in its own data-management slot", async () => {
    const user = userEvent.setup();
    renderPage({ qualitySlot: <output aria-label="数据健康内容">数据健康明细内容</output> });

    await user.click(screen.getByRole("tab", { name: "数据健康" }));
    expect(screen.getByRole("region", { name: "数据健康明细" })).toBeVisible();
    expect(screen.getByLabelText("数据健康内容")).toHaveTextContent("数据健康明细内容");
  });

  it("renders principal configuration in its own data-management slot", async () => {
    const user = userEvent.setup();
    renderPage({ principalSlot: <output aria-label="本金配置内容">本金配置表单</output> });

    await user.click(screen.getByRole("tab", { name: "账户与计价" }));
    expect(screen.getByRole("region", { name: "本金与参考收益率配置" })).toBeVisible();
    expect(screen.getByLabelText("本金配置内容")).toHaveTextContent("本金配置表单");
  });

  it("keeps refresh controls available for cancellation, retry, and unfinished recovery", async () => {
    const user = userEvent.setup();
    const state: GlobalMarketRefreshState = {
      ...EMPTY_GLOBAL_MARKET_REFRESH,
      running: true,
      total: 1,
      processed: 0,
      active: 1,
    };
    const { props } = renderPage({
      marketRefresh: {
        ...propsForRefresh(),
        state,
      },
    });

    await user.click(screen.getByRole("button", { name: "取消全部行情更新" }));
    expect(props.marketRefresh.onCancel).toHaveBeenCalledOnce();
  });
});

function propsForRefresh(): ComponentProps<typeof DataManagement>["marketRefresh"] {
  return {
    instrumentCount: 1,
    state: EMPTY_GLOBAL_MARKET_REFRESH,
    onRefresh: vi.fn(),
    onCancel: vi.fn(),
    onRetryFailed: vi.fn(),
    onRecoverUnfinished: vi.fn(),
  };
}
