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
  it("groups import, market refresh, and retained-data problems under one page", async () => {
    const user = userEvent.setup();
    const { props } = renderPage();

    expect(screen.getByRole("region", { name: "数据管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数据管理" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "导入交易数据" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "行情数据更新" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "待检查问题" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "更新全部数据" }));
    expect(props.marketRefresh.onRefresh).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "导入交易记录" }));
    expect(props.importActions.onFile).toHaveBeenCalledOnce();

    await user.click(screen.getByText("查看已无成交股票的保留记录"));
    await user.click(screen.getByRole("button", { name: "保留标的（RETAINED）数据记录" }));
    expect(props.onOpenDataCheck).toHaveBeenCalledWith(retainedInstrument.id);
  });

  it("renders an injected FX slot without inventing an FX state", () => {
    renderPage({ fxSlot: <output aria-label="后续汇率组件">由后续组件提供</output> });

    expect(screen.getByRole("region", { name: "汇率" })).toBeInTheDocument();
    expect(screen.getByLabelText("后续汇率组件")).toHaveTextContent("由后续组件提供");
    expect(screen.queryByText(/汇率已更新|暂无汇率/)).not.toBeInTheDocument();
  });

  it("renders quality details in its own data-management slot", () => {
    renderPage({ qualitySlot: <output aria-label="数据质量内容">数据质量明细内容</output> });

    expect(screen.getByRole("region", { name: "数据质量明细" })).toBeInTheDocument();
    expect(screen.getByLabelText("数据质量内容")).toHaveTextContent("数据质量明细内容");
  });

  it("renders principal configuration in its own data-management slot", () => {
    renderPage({ principalSlot: <output aria-label="本金配置内容">本金配置表单</output> });

    expect(screen.getByRole("region", { name: "本金与参考收益率配置" })).toBeInTheDocument();
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
