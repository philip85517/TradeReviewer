import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReplayControls } from "./replay-controls";

describe("ReplayControls", () => {
  it("keeps next execution available when no later candle exists", async () => {
    const user = userEvent.setup();
    const onNextExecution = vi.fn();

    render(
      <ReplayControls
        playing={false}
        speed={700}
        canGoBack={false}
        canGoForward={false}
        canGoToNextExecution
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onNextExecution={onNextExecution}
        onTogglePlay={vi.fn()}
        onSpeedChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "下一根 K 线" }),
    ).toBeDisabled();
    const nextExecution = screen.getByRole("button", {
      name: "跳至下一笔成交",
    });
    expect(nextExecution).toBeEnabled();

    await user.click(nextExecution);

    expect(onNextExecution).toHaveBeenCalledTimes(1);
  });
});
