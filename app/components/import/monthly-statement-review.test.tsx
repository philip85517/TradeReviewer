import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthlyStatementReview } from "./monthly-statement-review";
import type { StatementParseResult } from "../../lib/import/contracts";

function result(): StatementParseResult { return { broker: "futu", records: [], candidates: [], exclusions: [], diagnostics: [{ severity: "warning", code: "test", message: "来源时区未确认" }], blocked: false, monthly: { documentId: "f", month: "2025-06", templateIds: ["futu-combined"], positions: [], events: [], reviewRequired: true } }; }
afterEach(cleanup);
describe("monthly statement review", () => {
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
