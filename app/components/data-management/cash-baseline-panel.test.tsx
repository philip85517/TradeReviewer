import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  emptyCashBaselineState,
  type CashBaselineState,
} from "../../lib/cash/cash-model";
import { CashClientError } from "../../lib/cash/cash-client";
import type { CashBaselineStorageState } from "../../lib/cash/cash-baseline-contracts";
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

  it("keeps a successful save message visible when summary refresh reports an error", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel({ error: "摘要刷新失败" });
    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByRole("status")).toHaveTextContent("已更新现金基准");
    expect(screen.getByRole("alert")).toHaveTextContent("摘要刷新失败");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("rejects an incomplete draft without calling persistence", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel({ state: emptyCashBaselineState() });
    await user.click(screen.getByRole("button", { name: "保存现金基准" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/填写账户、有效金额和截至时间/);
  });

  it("offers a reset for a new record after local validation fails", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel({ state: emptyCashBaselineState() });
    await user.type(screen.getByRole("spinbutton", { name: "余额" }), "100000");
    await user.click(screen.getByRole("button", { name: "保存现金基准" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/截至时间/);
    expect(screen.getByRole("button", { name: "重置草稿" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重置草稿" }));
    expect(screen.getByRole("spinbutton", { name: "余额" })).toHaveValue(null);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("reads a native datetime value committed on blur when the controlled state has not observed fill", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPanel({ state: emptyCashBaselineState() });
    await user.type(screen.getByRole("spinbutton", { name: "余额" }), "100000");
    await user.type(screen.getByLabelText("来源"), "manual-entry");
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

  it("sends source and expected revision while keeping prior history expandable", async () => {
    const user = userEvent.setup();
    const storageState: CashBaselineStorageState = {
      ...state,
      records: [{ ...state.records[0], source: "broker-confirmed", revision: 2 }],
      history: [{
        ...state.records[0],
        source: "legacy-import",
        revision: 1,
        recordedAt: "2026-09-02T00:00:00.000Z",
      }],
    };
    const { onSave } = renderPanel({ state: storageState });

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByRole("spinbutton", { name: "余额" }));
    await user.type(screen.getByRole("spinbutton", { name: "余额" }), "120000");
    await user.clear(screen.getByLabelText("来源"));
    await user.type(screen.getByLabelText("来源"), "user-confirmed");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: "cash:live:account-a:CNY",
      source: "user-confirmed",
      expectedRevision: 2,
    }));
    const history = screen.getByRole("group", { name: "现金基准修订历史" });
    expect(history).not.toHaveAttribute("open");
    await user.click(screen.getByText(/查看历史/));
    expect(history).toHaveAttribute("open");
    expect(history).toHaveTextContent("legacy-import");
    expect(history).toHaveTextContent("版本 1");
  });

  it("keeps the edited draft after a CAS conflict and only replaces it on explicit reload", async () => {
    const user = userEvent.setup();
    const current = {
      ...state.records[0],
      balance: "130000",
      asOf: "2026-09-04T00:00:00.000Z",
      source: "another-session",
      revision: 3,
    };
    const onSave = vi.fn().mockRejectedValue(new CashClientError(409, "revision-conflict", "版本冲突", current));
    renderPanel({ onSave });

    await user.click(screen.getByRole("button", { name: "编辑" }));
    const amount = screen.getByRole("spinbutton", { name: "余额" });
    await user.clear(amount);
    await user.type(amount, "125000");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("版本冲突");
    expect(amount).toHaveValue(125000);
    expect(screen.getByRole("alert")).toHaveTextContent(/服务器当前值/);
    await user.click(screen.getByRole("button", { name: "重新载入当前值" }));

    expect(screen.getByRole("spinbutton", { name: "余额" })).toHaveValue(130000);
    expect(screen.getByLabelText("来源")).toHaveValue("another-session");
    expect(screen.getByText("当前版本 3")).toBeVisible();
  });

  it("uses the revision captured when editing began after a refreshed state arrives", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => true);
    const view = renderPanel({ state: {
      ...state,
      records: [{ ...state.records[0], source: "broker-a", revision: 2 }],
      history: [],
    } as CashBaselineStorageState, onSave });

    await user.click(screen.getByRole("button", { name: "编辑" }));
    const amount = screen.getByRole("spinbutton", { name: "余额" });
    await user.clear(amount);
    await user.type(amount, "125000");

    view.rerender(<CashBaselinePanel
      state={{
        ...state,
        records: [{ ...state.records[0], balance: "110000", source: "broker-b", revision: 7 }],
        history: [],
      } as CashBaselineStorageState}
      accounts={[{ id: "account-a", label: "账户 A" }, { id: "account-b", label: "账户 B" }]}
      nature="live"
      simulationRunId={null}
      onSave={onSave}
    />);

    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 2, balance: "125000" }));
  });

  it("preserves seconds and milliseconds when saving an unchanged baseline time", async () => {
    const user = userEvent.setup();
    const preciseState: CashBaselineState = {
      ...state,
      records: [{ ...state.records[0], asOf: "2026-09-01T00:00:37.123Z" }],
    };
    const onSave = vi.fn(async () => true);
    renderPanel({ state: preciseState, accounts: [{ id: "account-a", label: "账户 A" }], onSave });

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ asOf: "2026-09-01T00:00:37.123Z" }));
  });

  it("drops a stale conflict after leaving and returning to the same scope", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason: unknown) => void;
    const onSave = vi.fn(() => new Promise<boolean>((_resolve, reject) => {
      rejectSave = reject;
    }));
    const current = {
      ...state.records[0],
      balance: "130000",
      source: "server-a",
      revision: 3,
    };
    const view = renderPanel({
      state,
      accounts: [{ id: "account-a", label: "账户 A" }],
      onSave,
    });

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    view.rerender(<CashBaselinePanel
      state={emptyCashBaselineState()}
      accounts={[{ id: "account-b", label: "账户 B" }]}
      nature="live"
      simulationRunId={null}
      onSave={onSave}
    />);
    view.rerender(<CashBaselinePanel
      state={state}
      accounts={[{ id: "account-a", label: "账户 A" }]}
      nature="live"
      simulationRunId={null}
      onSave={onSave}
    />);

    await act(async () => {
      rejectSave(new CashClientError(409, "revision-conflict", "版本冲突", current));
      await Promise.resolve();
    });
    expect(screen.queryByText("服务器当前值已变化，已保留你的草稿")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新载入当前值" })).not.toBeInTheDocument();
  });

  it("keeps a new draft when an old save resolves after an A-to-B-to-A return", async () => {
    const user = userEvent.setup();
    let resolveSave!: (ok: boolean) => void;
    const onSave = vi.fn(() => new Promise<boolean>(resolve => {
      resolveSave = resolve;
    }));
    const view = renderPanel({
      state,
      accounts: [{ id: "account-a", label: "账户 A" }],
      onSave,
    });

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    view.rerender(<CashBaselinePanel
      state={emptyCashBaselineState()}
      accounts={[{ id: "account-b", label: "账户 B" }]}
      nature="live"
      simulationRunId={null}
      onSave={onSave}
    />);
    view.rerender(<CashBaselinePanel
      state={state}
      accounts={[{ id: "account-a", label: "账户 A" }]}
      nature="live"
      simulationRunId={null}
      onSave={onSave}
    />);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    const amount = screen.getByRole("spinbutton", { name: "余额" });
    await user.clear(amount);
    await user.type(amount, "777");

    await act(async () => {
      resolveSave(true);
      await Promise.resolve();
    });
    expect(screen.getByRole("group", { name: "编辑现金基准" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "余额" })).toHaveValue(777);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ignores a late save rejection after the panel unmounts", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason: unknown) => void;
    const onSave = vi.fn(() => new Promise<boolean>((_resolve, reject) => {
      rejectSave = reject;
    }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = renderPanel({
      state,
      accounts: [{ id: "account-a", label: "账户 A" }],
      onSave,
    });

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    view.unmount();
    await act(async () => {
      rejectSave(new Error("late response"));
      await Promise.resolve();
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("completes a save and releases the controls after the StrictMode probe", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => true);
    render(
      <StrictMode>
        <CashBaselinePanel
          state={state}
          accounts={[{ id: "account-a", label: "账户 A" }]}
          nature="live"
          simulationRunId={null}
          onSave={onSave}
        />
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByRole("status")).toHaveTextContent("已更新现金基准");
    expect(screen.getByRole("button", { name: "保存现金基准" })).toBeEnabled();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows a CAS conflict under StrictMode and keeps the reload action usable", async () => {
    const user = userEvent.setup();
    const current = { ...state.records[0], balance: "130000", source: "server-a", revision: 3 };
    const onSave = vi.fn().mockRejectedValue(new CashClientError(409, "revision-conflict", "版本冲突", current));
    render(
      <StrictMode>
        <CashBaselinePanel
          state={state}
          accounts={[{ id: "account-a", label: "账户 A" }]}
          nature="live"
          simulationRunId={null}
          onSave={onSave}
        />
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("版本冲突");
    expect(screen.getByRole("button", { name: "重新载入当前值" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeEnabled();
  });
});
