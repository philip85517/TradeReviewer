import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TradeReviewWorkspace } from "./trade-review-workspace";

describe("TradeReviewWorkspace", () => {
  it("advances one candle without revealing the future and preserves the cursor across periods", async () => {
    const user = userEvent.setup();
    render(<TradeReviewWorkspace />);

    const cursorBefore = screen.getByTestId("replay-cursor").textContent;
    const pnlBefore = screen.getByTestId("unrealized-pnl").textContent;

    expect(screen.queryByText("未来成交")).not.toBeInTheDocument();
    expect(screen.queryByText(/共 \d+ 根/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );

    expect(screen.getByTestId("replay-cursor").textContent).not.toBe(
      cursorBefore,
    );
    expect(screen.getByTestId("unrealized-pnl").textContent).not.toBe(
      pnlBefore,
    );

    const cursorAfterAdvance =
      screen.getByTestId("replay-cursor").textContent;
    await user.click(screen.getByRole("button", { name: "切换到 1W" }));

    expect(screen.getByTestId("replay-cursor")).toHaveTextContent(
      cursorAfterAdvance ?? "",
    );
  });
});
