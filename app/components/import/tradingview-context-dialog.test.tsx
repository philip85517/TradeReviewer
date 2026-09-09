import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TradingViewContextDialog } from "./tradingview-context-dialog";

afterEach(() => cleanup());

describe("TradingViewContextDialog", () => {
  it("requires a six digit code and returns the selected context", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <TradingViewContextDialog
        fileName="strategy.csv"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("button", { name: "继续解析" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("交易所"), "CN-SZ");
    await user.type(screen.getByLabelText("六位证券代码"), "300857");
    await user.click(screen.getByRole("button", { name: "继续解析" }));

    expect(onConfirm).toHaveBeenCalledWith({ market: "CN-SZ", symbol: "300857" });
  });
});
