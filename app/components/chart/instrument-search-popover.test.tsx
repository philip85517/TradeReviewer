import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstrumentSearchPopover } from "./instrument-search-popover";

afterEach(cleanup);

const instruments = [
  { id: "HK:1357", name: "美图公司", symbol: "1357", market: "HK" },
  { id: "US:XPEV", name: "小鹏汽车", symbol: "XPEV", market: "NYSE" },
];

function SearchHarness({ onSelect = vi.fn() }: { onSelect?: (id: string) => void }) {
  return (
    <InstrumentSearchPopover
      open
      instruments={instruments}
      onClose={vi.fn()}
      onSelectInstrument={onSelect}
    />
  );
}

describe("InstrumentSearchPopover", () => {
  it("selects a local instrument by its symbol match", async () => {
    const user = userEvent.setup();
    const onSelectInstrument = vi.fn();
    render(<SearchHarness onSelect={onSelectInstrument} />);

    await user.type(screen.getByRole("searchbox", { name: "搜索标的" }), "1357");
    await user.click(screen.getByRole("option", { name: "美图公司 1357 HK" }));

    expect(onSelectInstrument).toHaveBeenCalledWith("HK:1357");
  });

  it("matches instrument names without case sensitivity and reports empty results", async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);

    await user.type(screen.getByRole("searchbox"), "小鹏");
    expect(screen.getByRole("option", { name: "小鹏汽车 XPEV NYSE" })).toBeVisible();

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "missing");
    expect(screen.getByText("没有匹配的标的")).toBeVisible();
  });

  it("uses arrow keys and Enter to select the active result", async () => {
    const user = userEvent.setup();
    const onSelectInstrument = vi.fn();
    render(<SearchHarness onSelect={onSelectInstrument} />);

    const input = screen.getByRole("searchbox");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");

    expect(onSelectInstrument).toHaveBeenCalledWith("HK:1357");
  });

  it("closes on Escape or outside click and restores focus to its trigger", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };
    render(
      <InstrumentSearchPopover
        open
        instruments={instruments}
        onClose={onClose}
        onSelectInstrument={vi.fn()}
        triggerRef={triggerRef}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();

    await user.click(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
    document.body.removeChild(trigger);
  });

  it("shows the bundled demo only before imported instruments exist", () => {
    const { rerender } = render(
      <InstrumentSearchPopover
        open
        instruments={[]}
        onClose={vi.fn()}
        onSelectInstrument={vi.fn()}
      />,
    );
    expect(screen.getByRole("option", { name: "小鹏汽车 XPEV NYSE" })).toBeVisible();

    rerender(
      <InstrumentSearchPopover
        open
        instruments={instruments}
        onClose={vi.fn()}
        onSelectInstrument={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("option", { name: "小鹏汽车 XPEV NYSE" })).toHaveLength(1);
  });
});
