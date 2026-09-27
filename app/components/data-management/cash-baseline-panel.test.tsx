import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  emptyCashBaselineState,
  type CashBaselineState,
} from "../../lib/cash/cash-model";
import { CashBaselinePanel } from "./cash-baseline-panel";

afterEach(cleanup);

const state: CashBaselineState = {
  version: 1,
  records: [{
    id: "cash:live:account-a:CNY",
    scope: { nature: "live", simulationRunId: null },
    accountId: "account-a",
    currency: "CNY",
    balance: "100000",
    asOf: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
  }],
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof CashBaselinePanel>> = {}) {
  const onSave = vi.fn(async () => true);
  const props: React.ComponentProps<typeof CashBaselinePanel> = {
    state,
    accounts: [{ id: "account-a", label: "账户 A" }, { id: "account-b", label: "账户 B" }],
    nature: "live",
    simulationRunId: null,
    onSave,
    ...overrides,
  };
  return { ...render(<CashBaselinePanel {...props} />), onSave };
}

describe("CashBaselinePanel", () => {
  it("explains that the editable value is a real cash baseline and shows the selected scope", () => {
    renderPanel();
    expect(screen.getByRole("region", { name: "现金基准" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "现金基准" })).toBeInTheDocument();
    expect(screen.getByText(/不等于参考分配资本/)).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
  });

  it("edits and saves an existing account/currency baseline with a signed amount", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel();
    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByLabelText("账户")).toBeDisabled();
    expect(screen.getByLabelText("原币")).toBeDisabled();
    const amount = screen.getByRole("spinbutton", { name: "余额" });
    await user.clear(amount);
    await user.type(amount, "-12.50");
    const asOf = screen.getByLabelText("截至时间");
    await user.clear(asOf);
    await user.type(asOf, "2026-09-03T10:30");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: "cash:live:account-a:CNY",
      accountId: "account-a",
      currency: "CNY",
      balance: "-12.5",
      asOf: "2026-09-03T02:30:00.000Z",
    }));
    expect(screen.getByRole("status")).toHaveTextContent("已更新现金基准");
  });

  it("rejects an incomplete draft without calling persistence", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel({ state: emptyCashBaselineState() });
    await user.click(screen.getByRole("button", { name: "保存现金基准" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/填写账户、有效金额和截至时间/);
  });

  it("reads a native datetime value committed on blur when the controlled state has not observed fill", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel({ state: emptyCashBaselineState() });
    await user.type(screen.getByRole("spinbutton", { name: "余额" }), "100000");
    const asOf = screen.getByLabelText("截至时间") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(asOf, "2026-01-01T08:00");
    fireEvent.blur(asOf);
    await user.click(screen.getByRole("button", { name: "保存现金基准" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      balance: "100000",
      asOf: "2026-01-01T00:00:00.000Z",
    }));
  });

  it("keeps simulation runs isolated in the editor", () => {
    renderPanel({ nature: "simulation", simulationRunId: "run-a" });
    expect(screen.getByText("模拟运行：run-a")).toBeInTheDocument();
    expect(screen.getByText("当前范围还没有现金基准记录。")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "100000" })).not.toBeInTheDocument();
  });

  it("resets draft on scope changes and ignores a stale save result", async () => {
    const user = userEvent.setup();
    let resolveSave!: (ok: boolean) => void;
    const onSave = vi.fn(() => new Promise<boolean>(resolve => { resolveSave = resolve; }));
    const view = renderPanel({ onSave });
    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByRole("group", { name: "编辑现金基准" })).toBeInTheDocument();
    const balance = screen.getByRole("spinbutton", { name: "余额" });
    await user.clear(balance);
    await user.type(balance, "12");
    fireEvent.change(screen.getByLabelText("截至时间"), { target: { value: "2026-01-01T00:00" } });
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    view.rerender(<CashBaselinePanel
      state={emptyCashBaselineState()}
      accounts={[{ id: "account-b", label: "账户 B" }]}
      nature="simulation"
      simulationRunId="run-b"
      onSave={onSave}
    />);
    expect(screen.getByText("模拟运行：run-b")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "新增现金基准" })).toBeInTheDocument();
    expect(screen.getByLabelText("账户")).toHaveValue("account-b");
    expect(screen.getByRole("spinbutton", { name: "余额" })).toHaveValue(null);

    await act(async () => {
      resolveSave(true);
      await Promise.resolve();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
