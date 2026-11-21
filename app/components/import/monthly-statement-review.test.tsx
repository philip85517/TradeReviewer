import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthlyStatementReview } from "./monthly-statement-review";
import type { StatementParseResult } from "../../lib/import/contracts";

function result(): StatementParseResult { return { broker: "futu", records: [], candidates: [], exclusions: [], diagnostics: [{ severity: "warning", code: "test", message: "来源时区未确认" }], blocked: false, monthly: { documentId: "f", month: "2025-06", templateIds: ["futu-combined"], positions: [], events: [], reviewRequired: true } }; }
afterEach(cleanup);
describe("monthly statement review", () => {
  it("shows dated account-wide zero-stock evidence inside the existing evidence disclosure", () => {
    const parsed = result();
    parsed.monthly!.zeroStockEvidence = ["opening", "closing"].map((phase, i) => ({
      accountId: "futu:1001200118029088", date: i ? "2025-12-31" : "2025-12-01", phase: phase as "opening" | "closing",
      markets: ["US", "HK", "CN-SH", "CN-SZ"], proof: "complete-cash-only-asset-breakdown", source: [{page:1,row:6}, {page:i ? 2 : 1,row:4}],
    }));
    render(<MonthlyStatementReview fileName="2025-12.pdf" parsed={parsed} onReparse={vi.fn()} onContinue={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/2 条账户级空仓证明/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("持仓与辅助流水证据"));
    expect(screen.getByText(/2025-12-01 期初 · 账户级空仓证明 · 富途账户尾号 9088/)).toHaveTextContent("美股、港股、沪市、深市股票持仓为 0 · 原件第 1 页");
    expect(screen.getByText(/2025-12-31 期末 · 账户级空仓证明/)).toHaveTextContent("原件第 1、2 页");
  });

  it("keeps ordinary statements free of empty-stock claims", () => {
    render(<MonthlyStatementReview fileName="2025-06.pdf" parsed={result()} onReparse={vi.fn()} onContinue={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/账户级空仓证明/)).not.toBeInTheDocument();
    expect(screen.getByText(/已识别 0 笔成交、0 条持仓快照、0 条辅助流水。/)).toBeInTheDocument();
  });

  it("shows inferred timezone confidence in the execution evidence table", () => {
    const parsed = {
      ...result(),
      diagnostics: [],
      records: [{
        id: "fill-1",
        accountId: "acct",
        accountLabel: "富途",
        instrument: { id: "US:FB", symbol: "FB", name: "Facebook", market: "US", currency: "USD" },
        side: "buy" as const,
        executedAt: "2020-01-27T16:30:42Z",
        quantity: "1",
        price: "10",
        fee: "0",
        source: { platform: "futu", row: 1, sourceTimestampText: "2020/01/27 11:30:42", sourceTimezone: "America/New_York", timeEvidence: "inferred" as const, timeConfidence: 0.93 },
      }],
      monthly: { ...result().monthly!, reviewRequired: false },
    };
    render(<MonthlyStatementReview fileName="2015-04.pdf" parsed={parsed} onReparse={vi.fn()} onContinue={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("2020/01/27 11:30:42 · 成交时间 · America/New_York · 推断 93%" )).toBeInTheDocument();
  });

  it("labels a settlement fee with its settlement currency", () => {
    const parsed = {
      ...result(),
      diagnostics: [],
      records: [{
        id: "hk-fill-1",
        accountId: "acct-hk",
        accountLabel: "港股通账户",
        instrument: { id: "HK:1810", symbol: "1810", name: "小米集团-W", market: "HK", currency: "HKD" },
        side: "buy" as const,
        executedAt: "2025-03-18T07:00:00Z",
        quantity: "2",
        price: "54",
        fee: "8",
        source: {
          platform: "china-merchants",
          row: 1,
          feeStatus: "reported" as const,
          settlement: { currency: "CNY", quantity: "2", grossAmount: "108", netAmount: "-116", fees: { commission: "8" } },
        },
      }],
      monthly: { ...result().monthly!, reviewRequired: false },
    };
    render(<MonthlyStatementReview fileName="hk-connect.pdf" parsed={parsed} onReparse={vi.fn()} onContinue={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("8 CNY")).toBeInTheDocument();
  });

  it("requires explicit warning acknowledgement and preserves a user timezone selection", () => {
    const reparse = vi.fn(); const next = vi.fn();
    render(<MonthlyStatementReview fileName="2025-06.pdf" parsed={result()} onReparse={reparse} onContinue={next} onCancel={vi.fn()} />);
    expect(screen.getByText("继续核对并导入")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("继续核对并导入"));
    expect(next).toHaveBeenCalledOnce();
    next.mockClear();
    fireEvent.change(screen.getByLabelText("月结单来源时区"), { target: { value: "America/New_York" } });
    fireEvent.click(screen.getByText("按所选时间口径重新解析"));
    expect(reparse).toHaveBeenCalledWith({ sourceTimezone: "America/New_York", overrideDocumentTimezone: true });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("继续核对并导入"));
    expect(next).not.toHaveBeenCalled();
    expect(screen.getByText("继续核对并导入")).toBeDisabled();
  });
  it("does not let acknowledgement bypass structural blockers", () => {
    render(<MonthlyStatementReview fileName="bad.pdf" parsed={{ ...result(), blocked: true }} onReparse={vi.fn()} onContinue={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox")); expect(screen.getByText("继续核对并导入")).toBeDisabled();
  });
});
