import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, PointerEvent as ReactPointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecallSaveStatus } from "./recall-save-status";

function renderStatus(overrides: Partial<ComponentProps<typeof RecallSaveStatus>> = {}) {
  return render(
    <RecallSaveStatus
      conflict={false}
      dirty={false}
      error={null}
      saveRetryable={false}
      saving={false}
      onReload={vi.fn()}
      onRetrySave={vi.fn()}
      {...overrides}
    />,
  );
}

describe("RecallSaveStatus", () => {
  afterEach(cleanup);

  it("keeps a fixed status shell and applies conflict/error precedence", () => {
    const { rerender } = renderStatus({ dirty: true, saving: true });
    const trigger = screen.getByRole("button");

    expect(trigger).toHaveAttribute("data-status", "saving");
    expect(trigger).toHaveAttribute("aria-label", "保存中");
    expect(screen.getByRole("status")).toHaveTextContent("");

    rerender(
      <RecallSaveStatus
        conflict={false}
        dirty
        error="字段校验未通过"
        saveRetryable
        saving
        onReload={vi.fn()}
        onRetrySave={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "复盘操作错误" })).toHaveAttribute("data-status", "error");
    expect(screen.getByRole("button", { name: "复盘操作错误" })).toHaveAttribute("aria-label", "复盘操作错误");
    expect(screen.getByRole("status")).toHaveTextContent("字段校验未通过");

    rerender(
      <RecallSaveStatus
        conflict
        dirty
        error="保存错误"
        saveRetryable
        saving
        onReload={vi.fn()}
        onRetrySave={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "复盘版本冲突" })).toHaveAttribute("data-status", "conflict");
    expect(screen.getByRole("button", { name: "复盘版本冲突" })).toHaveAttribute("aria-label", "复盘版本冲突");
    expect(screen.getByRole("dialog")).toHaveTextContent("复盘版本已更新；当前草稿已保留。");
    expect(screen.queryByText("其他窗口")).not.toBeInTheDocument();
  });

  it("keeps the error entry after closing and exposes the full message and actions", async () => {
    const onReload = vi.fn();
    const onRetrySave = vi.fn();
    renderStatus({
      error: "这是一个很长的捕获或校验错误，用于确认完整内容可以访问而不会被截断。",
      saveRetryable: true,
      onReload,
      onRetrySave,
    });

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toHaveTextContent(/这是一个很长的捕获或校验错误/);
    expect(screen.getByRole("button", { name: "重试保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新载入" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭错误详情" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复盘操作错误" })).toHaveAttribute("data-status", "error");

    fireEvent.click(screen.getByRole("button", { name: "复盘操作错误" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    fireEvent.click(screen.getByRole("button", { name: "重新载入" }));
    expect(onRetrySave).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("does not steal an editor focus on auto-open but focuses recovery on an explicit open", async () => {
    const { container } = render(
      <>
        <input aria-label="编辑器" />
        <RecallSaveStatus
          conflict={false}
          dirty={false}
          error="加载数据失败"
          saveRetryable
          saving={false}
          onReload={vi.fn()}
          onRetrySave={vi.fn()}
        />
      </>,
    );
    const editor = screen.getByRole("textbox", { name: "编辑器" });
    editor.focus();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(document.activeElement).toBe(editor);

    fireEvent.click(screen.getByRole("button", { name: "关闭错误详情" }));
    fireEvent.click(screen.getByRole("button", { name: "复盘操作错误" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "重试保存" })));
    expect(container.querySelector("[role=dialog]")).toBeTruthy();
  });

  it("restores the trigger for inside Escape and leaves outside focus alone", async () => {
    render(
      <>
        <button type="button">外部操作</button>
        <RecallSaveStatus
          conflict
          dirty
          error="冲突"
          saveRetryable={false}
          saving={false}
          onReload={vi.fn()}
          onRetrySave={vi.fn()}
        />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "复盘版本冲突" });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    const reload = screen.getByRole("button", { name: "重新载入" });
    reload.focus();
    fireEvent.keyDown(reload, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    const outside = screen.getByRole("button", { name: "外部操作" });
    outside.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(outside);
  });

  it("closes from a focused trigger on Escape and preserves trigger focus", async () => {
    renderStatus({ conflict: true });
    const trigger = screen.getByRole("button", { name: "复盘版本冲突" });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    trigger.focus();

    fireEvent.keyDown(trigger, { key: "Escape", code: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on an outside pointerdown before a chart control can stop bubbling", async () => {
    const outsidePointerDown = vi.fn((event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation());
    render(
      <>
        <button type="button" onPointerDown={outsidePointerDown}>图表 Text 控件</button>
        <RecallSaveStatus
          conflict
          dirty
          error="冲突"
          saveRetryable={false}
          saving={false}
          onReload={vi.fn()}
          onRetrySave={vi.fn()}
        />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "复盘版本冲突" });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const outside = screen.getByRole("button", { name: "图表 Text 控件" });
    fireEvent.pointerDown(outside);
    expect(outsidePointerDown).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
