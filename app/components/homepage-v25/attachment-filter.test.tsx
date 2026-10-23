import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { beginHomepageRead, cancelHomepageDraft, changeHomepageIdentity, clearHomepageAttachments, completeHomepageRequest, createHomepageState, editHomepageDraft, resetHomepageDefaults } from "../../lib/reviews/homepage-v25-state";
import { AttachmentFilterPopover } from "./attachment-filter";

const scope = { live: true as const, market: "hk" as const, accounts: ["one"], rangeMode: "custom" as const, from: "2026-10-01", to: "2026-10-23" };
function Harness() {
  const [ui, setUi] = useState(() => createHomepageState(scope));
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function finish(ok: boolean) { setUi(current => { const token = current.requests.global!; return completeHomepageRequest(current, { generation: token.generation, scopeKey: token.scopeKey, ok, applied: token.target, error: ok ? undefined : "附加筛选未应用：读取失败" }).state; }); if (ok) setOpen(false); }
  return <><button ref={trigger} onClick={() => setOpen(true)}>筛选</button><button onClick={() => { setUi(current => changeHomepageIdentity(current, { ...current.snapshot.scope, market: "us" })); setOpen(false); }}>切换市场</button>
    <output aria-label="已应用">{JSON.stringify(ui.snapshot)}</output><output aria-label="草稿">{JSON.stringify(ui.draft)}</output>
    <button onClick={() => finish(true)}>读取成功</button><button onClick={() => finish(false)}>读取失败</button>
    <AttachmentFilterPopover open={open} draft={ui.draft.attachments} pending={ui.requests.global !== null} error={ui.errors.global} triggerRef={trigger}
      onDraft={attachments => setUi(current => editHomepageDraft(current, { ...current.draft, attachments }))}
      onApply={() => setUi(current => beginHomepageRead(current, { purpose: "apply" }))}
      onClear={() => setUi(current => beginHomepageRead(clearHomepageAttachments(current), { purpose: "apply" }))}
      onReset={() => setUi(current => beginHomepageRead(resetHomepageDefaults(current), { purpose: "apply" }))}
      onCancel={() => { setUi(current => cancelHomepageDraft(current)); setOpen(false); }} />
  </>;
}
const snapshot = () => JSON.parse(screen.getByLabelText("已应用").textContent!);
const draft = () => JSON.parse(screen.getByLabelText("草稿").textContent!);
afterEach(cleanup);
describe("controlled attachment filter with the accepted S v3 authority", () => {
  it("edits only S draft, preserves Esc/outside drafts on reopen and returns focus to the exact trigger", () => {
    render(<Harness />); const trigger = screen.getByRole("button", { name: "筛选" }); fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("checkbox", { name: "股票" }));
    expect(draft().attachments.categories).toEqual(["stock"]); expect(snapshot().attachments.categories).toEqual([]);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); expect(trigger).toHaveFocus();
    fireEvent.click(trigger); expect(screen.getByRole("checkbox", { name: "股票" })).toBeChecked();
    fireEvent.pointerDown(document.body); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger); expect(screen.getByRole("checkbox", { name: "股票" })).toBeChecked();
  });

  it("keeps yes/no double selection visibly distinct from no selection while using stable S normalization", () => {
    render(<Harness />); fireEvent.click(screen.getByText("筛选"));
    fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：是" })); fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：否" }));
    expect(draft().attachments.pendingReview).toEqual([false, true]);
    expect(screen.getByRole("checkbox", { name: "待复盘：是" })).toBeChecked(); expect(screen.getByRole("checkbox", { name: "待复盘：否" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：是" })); expect(draft().attachments.pendingReview).toEqual([false]);
  });

  it("applies once through pending and keeps old applied fields plus draft and explicit error on failure", () => {
    render(<Harness />); fireEvent.click(screen.getByText("筛选")); fireEvent.click(screen.getByRole("checkbox", { name: "ETF" }));
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "ETF" }), { key: "Enter" });
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled(); expect(screen.getByRole("checkbox", { name: "ETF" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(snapshot().attachments.categories).toEqual([]);
    fireEvent.click(screen.getByText("读取失败")); expect(screen.getByRole("alert")).toHaveTextContent("读取失败");
    expect(screen.getByRole("checkbox", { name: "ETF" })).toBeChecked(); expect(snapshot().scope.market).toBe("hk");
    expect(screen.queryByRole("button", { name: /重试|修复/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "应用" })); fireEvent.click(screen.getByText("读取成功"));
    expect(snapshot().attachments.categories).toEqual(["etf"]); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clears attachments or restores market/account defaults through distinct actions without changing the date period", () => {
    render(<Harness />); fireEvent.click(screen.getByText("筛选")); fireEvent.click(screen.getByRole("checkbox", { name: "仅看未平仓持仓" }));
    fireEvent.click(screen.getByRole("button", { name: "应用" })); fireEvent.click(screen.getByText("读取成功"));
    fireEvent.click(screen.getByText("筛选")); fireEvent.click(screen.getByRole("button", { name: "清除附加条件" }));
    expect(snapshot().attachments.openOnly).toBe(true); fireEvent.click(screen.getByText("读取成功"));
    expect(snapshot().attachments.openOnly).toBe(false); expect(snapshot().scope.market).toBe("hk"); expect(snapshot().scope.accounts).toEqual(["one"]);
    fireEvent.click(screen.getByText("筛选")); fireEvent.click(screen.getByRole("button", { name: "恢复全部默认" }));
    expect(snapshot().scope.market).toBe("hk"); fireEvent.click(screen.getByText("读取成功"));
    expect(snapshot().scope.market).toBe("all"); expect(snapshot().scope.accounts).toEqual(["*"]);
    expect(snapshot().period).toEqual({ preset: "custom", from: "2026-10-01", to: "2026-10-23" });
  });

  it("cancels an in-flight draft without committing it and identity discard is controlled by the S owner", () => {
    render(<Harness />); fireEvent.click(screen.getByText("筛选")); fireEvent.click(screen.getByRole("checkbox", { name: "股票" }));
    fireEvent.click(screen.getByRole("button", { name: "应用" })); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(snapshot().attachments.categories).toEqual([]); expect(draft().attachments.categories).toEqual(["stock"]);
    fireEvent.click(screen.getByText("筛选")); expect(screen.getByRole("button", { name: "应用" })).toBeEnabled();
    fireEvent.click(screen.getByText("切换市场")); fireEvent.click(screen.getByText("筛选")); expect(screen.getByRole("checkbox", { name: "股票" })).not.toBeChecked();
  });

  it("keeps fund unavailable with an explanation and does not silently drop unknown restored categories", () => {
    const trigger = createRef<HTMLButtonElement>();
    render(<><button ref={trigger}>入口</button><AttachmentFilterPopover open draft={{ categories: ["future-class"], openOnly: false, pendingReview: [] }} pending={false} error={null} triggerRef={trigger} onDraft={() => {}} onApply={() => {}} onClear={() => {}} onReset={() => {}} onCancel={() => {}} /></>);
    expect(screen.getByRole("checkbox", { name: "基金" })).toBeDisabled(); expect(screen.getByText(/尚不支持基金类别/)).toBeInTheDocument();
    expect(screen.getByText(/future-class/)).toBeInTheDocument();
  });

  it("focuses the first field and keeps Tab/ShiftTab inside the editor until explicit dismissal", () => {
    render(<Harness />); fireEvent.click(screen.getByText("筛选"));
    const first = screen.getByRole("checkbox", { name: "股票" }), last = screen.getByRole("button", { name: "恢复全部默认" });
    expect(first).toHaveFocus(); fireEvent.keyDown(first, { key: "Tab", shiftKey: true }); expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" }); expect(first).toHaveFocus();
    expect(within(screen.getByRole("dialog")).getAllByRole("checkbox")).toHaveLength(6);
  });
});
