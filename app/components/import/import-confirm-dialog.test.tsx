import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ImportPreview } from "../../lib/import/import-preview";
import { ImportConfirmDialog } from "./import-confirm-dialog";

const preview: ImportPreview = {
  id: "import:abc",
  fileName: "2025年交易记录.xlsx",
  sourceLabel: "富途证券",
  records: [],
  instruments: [
    {
      instrument: {
        id: "HK:1810",
        symbol: "1810",
        name: "小米集团-W",
        market: "HK",
        currency: "HKD",
      },
      executions: [],
      tradeCount: 2,
      firstTradeAt: "2025-03-01T00:00:00.000Z",
      lastTradeAt: "2025-03-10T00:00:00.000Z",
    },
  ],
  diagnostics: [],
  tradeCount: 2,
  instrumentCount: 1,
  excludedInstrumentCount: 3,
  excludedSymbols: ["基金A", "基金B", "基金C"],
  firstTradeAt: "2025-03-01T00:00:00.000Z",
  lastTradeAt: "2025-03-10T00:00:00.000Z",
  blocked: false,
};

describe("ImportConfirmDialog", () => {
  it("explains the parsed batch before confirmation", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ImportConfirmDialog
        preview={preview}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("小米集团-W（1810）")).toBeInTheDocument();
    expect(screen.getByText("2 笔成交")).toBeInTheDocument();
    expect(screen.getByText("3 个标的不导入")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
