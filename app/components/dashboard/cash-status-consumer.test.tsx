import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { CashSummary } from "../../lib/cash/cash-model";

type RoomAllocationCashStatusProps = {
  cashSummary?: CashSummary | null;
  cashBaselineDetails?: readonly unknown[];
  cashRefreshNotice?: string | null;
  onRetryCashSummary?: () => void;
  cashRetryDisabled?: boolean;
};

const { roomAllocationProps } = vi.hoisted(() => ({ roomAllocationProps: [] as unknown[] }));

vi.mock("./room-allocation", () => ({
  RoomAllocation: (props: unknown) => {
    roomAllocationProps.push(props);
    return null;
  },
}));

import { ReviewDashboard } from "./review-dashboard";

afterEach(() => {
  cleanup();
  roomAllocationProps.length = 0;
});

it("forwards saved cash status props and the existing cash bundle through the dashboard consumer", () => {
  const cashRefreshNotice = "已保存现金基准，摘要暂未刷新";
  const onRetryCashSummary = vi.fn();
  const onRefreshHoldingsValuation = vi.fn();
  const cashSummary = {
    todayProceeds: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { CNY: "12" },
      convertedCny: "12",
      converted: "12",
      convertedHkd: null,
      targetCurrency: "CNY" as const,
      conversion: "same-currency" as const,
      fxSnapshotId: null,
      note: "完整",
    },
    cashTotal: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { CNY: "100300" },
      convertedCny: "100300",
      converted: "100300",
      convertedHkd: null,
      targetCurrency: "CNY" as const,
      conversion: "same-currency" as const,
      fxSnapshotId: null,
      note: "基准+股票/ETF成交变化",
    },
    todayProceedsStatus: "available" as const,
    cashTotalStatus: "available" as const,
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-25T00:00:00.000Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00.000Z",
  } satisfies CashSummary;
  const cashBaselineDetails = [{
    accountId: "account-a",
    accountLabel: "账户 A",
    currency: "CNY",
    balance: "100000",
    asOf: "2026-09-19T00:00:00.000Z",
    source: "saved-old",
    revision: 2,
    coverage: "available",
  }];

  render(<ReviewDashboard
    entries={[]}
    onOpenInReview={vi.fn()}
    referenceCapitalEnabled={false}
    cashSummary={cashSummary}
    cashBaselineDetails={cashBaselineDetails}
    cashRefreshNotice={cashRefreshNotice}
    onRetryCashSummary={onRetryCashSummary}
    cashRetryDisabled
    onRefreshHoldingsValuation={onRefreshHoldingsValuation}
  />);

  expect(roomAllocationProps.length).toBeGreaterThan(0);
  const latestProps = roomAllocationProps.at(-1) as RoomAllocationCashStatusProps;
  expect(latestProps.cashSummary).toBe(cashSummary);
  expect(latestProps.cashBaselineDetails).toBe(cashBaselineDetails);
  expect(latestProps.cashRefreshNotice).toBe(cashRefreshNotice);
  expect(latestProps.onRetryCashSummary).toBe(onRetryCashSummary);
  expect(latestProps.cashRetryDisabled).toBe(true);

  latestProps.onRetryCashSummary?.();
  expect(onRetryCashSummary).toHaveBeenCalledTimes(1);
  expect(onRefreshHoldingsValuation).not.toHaveBeenCalled();
});
