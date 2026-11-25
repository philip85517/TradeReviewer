import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ImportHistoryDialog } from "./import-history-dialog";

afterEach(cleanup);

it("keeps missing legacy audit counts unknown while preserving recorded zero", () => {
  const entry = JSON.parse(JSON.stringify({
    id: "legacy-counts", fileName: "public-fictional.pdf", sourceLabel: "历史导入",
    importedAt: "2026-11-18T00:00:00Z", tradeCount: 8, instrumentCount: 1,
    excludedInstrumentCount: 0,
  }));
  render(<ImportHistoryDialog entries={[entry]} onClose={vi.fn()} />);
  const details = screen.getByRole("complementary", { name: "选中导入证据详情" });
  expect(within(details).getByText("排除 — 笔记录 / 0 个标的。")).toBeInTheDocument();
  expect(within(details).getByText(/重复 — 笔；未识别标的 — 个/)).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "— / —" })).toBeInTheDocument();
});
