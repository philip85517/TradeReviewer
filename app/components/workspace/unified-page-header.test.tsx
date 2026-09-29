import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnifiedPageHeader } from "./unified-page-header";

afterEach(cleanup);

describe("UnifiedPageHeader", () => {
  it("keeps page identity before shared controls and preserves the supplied scope and tool seams", () => {
    const onScopeChange = vi.fn();
    render(
      <UnifiedPageHeader
        title="交易库"
        description="浏览已导入交易"
        status={<span>12 个标的</span>}
        scopeControls={
          <div aria-label="共享范围">
            <label>性质<select aria-label="交易性质"><option>实盘</option></select></label>
            <button type="button" onClick={() => onScopeChange({ nature: "simulation" })}>切换范围</button>
          </div>
        }
        globalTools={<div aria-label="全局工具"><input aria-label="搜索标的" /><button type="button">通知</button></div>}
        tabs={<div role="tablist"><button role="tab" aria-selected="true">按标的浏览</button></div>}
      />,
    );

    const header = screen.getByRole("banner", { name: "交易库页面头部" });
    expect(within(header).getByRole("heading", { name: "交易库" })).toBeInTheDocument();
    expect(within(header).getByText("浏览已导入交易")).toBeInTheDocument();
    expect(within(header).getByRole("group", { name: "共享范围" })).toBeInTheDocument();
    expect(within(header).getByRole("textbox", { name: "搜索标的" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "按标的浏览" })).toHaveAttribute("aria-selected", "true");

    const title = within(header).getByRole("heading", { name: "交易库" });
    const scope = within(header).getByRole("group", { name: "共享范围" });
    expect(title.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    within(header).getByRole("button", { name: "切换范围" }).click();
    expect(onScopeChange).toHaveBeenCalledWith({ nature: "simulation" });
  });

  it("does not allocate a tab row when a page has no page tabs", () => {
    const { container } = render(
      <UnifiedPageHeader title="我的交易室" scopeControls={<div />} />,
    );
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it("exposes stable scope field identities for responsive placement", () => {
    const { container } = render(
      <UnifiedPageHeader
        title="我的交易室"
        scopeControls={
          <>
            <label data-scope-field="nature">性质<select aria-label="交易性质"><option>实盘</option></select></label>
            <label data-scope-field="account">账户<select aria-label="账户范围"><option>全部账户</option></select></label>
            <label data-scope-field="currency">计价<select aria-label="报告计价"><option>原币</option></select></label>
          </>
        }
      />,
    );

    expect(container.querySelector('[data-scope-field="nature"]')).toBeInTheDocument();
  });
});
