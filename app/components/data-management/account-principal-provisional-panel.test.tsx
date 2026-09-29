import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountPrincipalProvisionalError,
  type AccountPrincipalProvisionalClient,
} from "../../lib/principal/account-principal-provisional-client";
import type { AccountPrincipalProvisional } from "../../lib/principal/account-principal-provisional-contracts";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../../lib/trades/tradingview-account-identity";
import { AccountPrincipalProvisionalPanel } from "./account-principal-provisional-panel";

afterEach(cleanup);

const record: AccountPrincipalProvisional = {
  accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
  currency: "CNY",
  amount: "100000",
  asOf: null,
  status: "provisional",
  source: "user-default",
  revision: 0,
  updatedAt: "2026-09-26T00:00:00.000Z",
};

function client(overrides: Partial<AccountPrincipalProvisionalClient> = {}): AccountPrincipalProvisionalClient {
  return {
    read: vi.fn().mockResolvedValue(record),
    save: vi.fn().mockResolvedValue(record),
    revise: vi.fn().mockResolvedValue(record),
    ...overrides,
  };
}

describe("AccountPrincipalProvisionalPanel", () => {
  it("reads one canonical provisional principal and keeps it separate from cash", async () => {
    const principalClient = client();
    render(<AccountPrincipalProvisionalPanel client={principalClient} />);

    expect(await screen.findByText("CNY 100000")).toBeVisible();
    expect(screen.getByText("日期未提供")).toBeVisible();
    expect(screen.getByText(/暂定本金不等于现金基准/)).toBeVisible();
    expect(principalClient.read).toHaveBeenCalledWith(TRADINGVIEW_CANONICAL_ACCOUNT_ID);
    expect(screen.getByText("来源：user-default")).toBeVisible();
  });

  it("rejects empty edits, supports cancel, and sends a CAS revision", async () => {
    const user = userEvent.setup();
    const principalClient = client({ revise: vi.fn().mockResolvedValue({ ...record, amount: "101000", revision: 1 }) });
    render(<AccountPrincipalProvisionalPanel client={principalClient} />);

    await screen.findByText("CNY 100000");
    await user.click(screen.getByRole("button", { name: "编辑暂定本金" }));
    const amount = screen.getByRole("spinbutton", { name: "本金金额" });
    await user.clear(amount);
    await user.click(screen.getByRole("button", { name: "保存暂定本金" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请输入大于 0 的金额");
    expect(principalClient.revise).not.toHaveBeenCalled();

    await user.type(amount, "101000");
    await user.click(screen.getByRole("button", { name: "取消编辑" }));
    expect(screen.getByText("CNY 100000")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "编辑暂定本金" }));
    await user.clear(screen.getByRole("spinbutton", { name: "本金金额" }));
    await user.type(screen.getByRole("spinbutton", { name: "本金金额" }), "101000");
    await user.click(screen.getByRole("button", { name: "保存暂定本金" }));

    expect(principalClient.revise).toHaveBeenCalledWith(expect.objectContaining({
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      amount: "101000",
      asOf: null,
      expectedRevision: 0,
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("已保存暂定本金");
  });

  it("keeps a conflicted draft and explicitly reloads the server current record", async () => {
    const user = userEvent.setup();
    const current = { ...record, amount: "102000", source: "user-confirmed", revision: 1 };
    const principalClient = client({
      revise: vi.fn().mockRejectedValue(new AccountPrincipalProvisionalError(409, "revision-conflict", "版本冲突", current)),
    });
    render(<AccountPrincipalProvisionalPanel client={principalClient} />);

    await screen.findByText("CNY 100000");
    await user.click(screen.getByRole("button", { name: "编辑暂定本金" }));
    const amount = screen.getByRole("spinbutton", { name: "本金金额" });
    await user.clear(amount);
    await user.type(amount, "101500");
    await user.click(screen.getByRole("button", { name: "保存暂定本金" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("版本冲突");
    expect(amount).toHaveValue(101500);
    await user.click(screen.getByRole("button", { name: "重新载入当前本金" }));
    expect(screen.getByRole("spinbutton", { name: "本金金额" })).toHaveValue(102000);
    expect(screen.getByLabelText("本金来源")).toHaveValue("user-confirmed");
    expect(screen.getByText("当前版本 1")).toBeVisible();
  });

  it("does not fabricate the default amount when the canonical record is missing", async () => {
    const principalClient = client({ read: vi.fn().mockResolvedValue(undefined) });
    render(<AccountPrincipalProvisionalPanel client={principalClient} />);

    await waitFor(() => expect(screen.getByText("尚未读取到暂定本金记录")).toBeVisible());
    expect(screen.queryByText("CNY 100000")).not.toBeInTheDocument();
    expect(screen.getByText(/不能由此推导现金基准或可信收益率/)).toBeVisible();
  });
});
