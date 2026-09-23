import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReferenceCapitalState } from "../../lib/principal/reference-capital-model";
import { ReferenceCapitalPanel } from "./reference-capital-panel";

const state: ReferenceCapitalState = {
  version: 2,
  records: [
    { id: "a", nature: "live", simulationRunId: null, accountId: "acct-a", currency: "CNY", fromDate: "2026-01-01", toDate: "2026-03-31", amount: "1000", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "b", nature: "live", simulationRunId: null, accountId: "acct-b", currency: "USD", fromDate: "2026-01-01", toDate: "2026-03-31", amount: "2000", updatedAt: "2026-01-01T00:00:00Z" },
  ],
};

function renderPanel(overrides: Partial<Parameters<typeof ReferenceCapitalPanel>[0]> = {}) {
  return render(<ReferenceCapitalPanel state={state} accounts={[{ id: "acct-a", label: "主账户" }, { id: "acct-b", label: "副账户" }]} nature="live" simulationRunId={null} onSave={vi.fn().mockResolvedValue(true)} onRemove={vi.fn().mockResolvedValue(true)} {...overrides} />);
}

describe("ReferenceCapitalPanel", () => {
  afterEach(() => cleanup());

  it("shows only the selected account scope and resets a draft when scope changes", async () => {
    const user = userEvent.setup();
    const view = renderPanel({ accounts: [{ id: "acct-a", label: "主账户" }] });
    expect(screen.getAllByText("主账户").length).toBeGreaterThan(0);
    expect(screen.queryByText("副账户")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("金额"), "99");
    const onSave = vi.fn().mockResolvedValue(true);
    view.rerender(<ReferenceCapitalPanel state={state} accounts={[{ id: "acct-b", label: "副账户" }]} nature="live" simulationRunId={null} onSave={onSave} onRemove={vi.fn().mockResolvedValue(true)} />);
    expect(screen.getByLabelText("账户")).toHaveValue("acct-b");
    expect(screen.getByLabelText("金额")).toHaveValue("");
    expect(screen.queryByText("acct-a")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("起始日期"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-03-31" } });
    await user.type(screen.getByLabelText("金额"), "2500");
    await user.click(screen.getByRole("button", { name: "保存参考资本" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ accountId: "acct-b", amount: "2500" }));
  });

  it("edits by id and cancel returns to a clean new configuration", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    renderPanel({ onSave });
    await user.click(screen.getAllByRole("button", { name: "编辑" })[0]!);
    const editForm = screen.getByRole("group", { name: "编辑参考资本配置" });
    expect(editForm).toBeInTheDocument();
    await user.clear(screen.getByLabelText("金额", { selector: "input" }));
    await user.type(screen.getByLabelText("金额", { selector: "input" }), "1500");
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "a", amount: "1500" }));
    await user.click(screen.getAllByRole("button", { name: "编辑" })[0]!);
    await user.click(screen.getByRole("button", { name: "取消编辑" }));
    expect(screen.getByRole("group", { name: "新增参考资本配置" })).toBeInTheDocument();
    expect(screen.getByLabelText("金额", { selector: "input" })).toHaveValue("");
  });

  it("disables save and delete actions while saving", () => {
    renderPanel({ saving: true });
    expect(screen.getByRole("button", { name: "保存参考资本" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "编辑" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "删除" })[0]).toBeDisabled();
  });
});
