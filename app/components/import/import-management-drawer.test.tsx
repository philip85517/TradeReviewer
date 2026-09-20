import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImportManagementDrawer } from "./import-management-drawer";

describe("ImportManagementDrawer", () => {
  it("exposes a modal entry point and preserves child import controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ImportManagementDrawer onClose={onClose}>
        <label>
          导入交易记录
          <input aria-label="导入交易记录" type="file" />
        </label>
      </ImportManagementDrawer>,
    );

    expect(
      screen.getByRole("dialog", { name: "导入与数据管理" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("导入交易记录")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭导入与数据管理" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
