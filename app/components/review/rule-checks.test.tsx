import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RuleChecks } from "./rule-checks";

afterEach(cleanup);

describe("RuleChecks", () => {
  it("records an explicit result using the immutable source snapshot", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RuleChecks
        candidates={[
          {
            sourceEpisodeId: "source",
            sourceUpdatedAt: "2026-09-01T00:00:00.000Z",
            ruleText: "等待回踩确认",
            sourceInstrumentId: "US:AAA",
            sourceLabel: "AAA · 2026-09-01",
          },
        ]}
        checks={[]}
        onChange={onChange}
        onOpenSource={vi.fn()}
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "判断规则：等待回踩确认" }),
      "followed",
    );

    expect(onChange).toHaveBeenCalledWith([
      {
        sourceEpisodeId: "source",
        sourceUpdatedAt: "2026-09-01T00:00:00.000Z",
        ruleText: "等待回踩确认",
        result: "followed",
      },
    ]);
  });

  it("shows a saved check from its frozen text even after the source changes", () => {
    render(
      <RuleChecks
        candidates={[
          {
            sourceEpisodeId: "source",
            sourceUpdatedAt: "2026-09-10T00:00:00.000Z",
            ruleText: "来源已经改写",
            sourceInstrumentId: "US:AAA",
            sourceLabel: "AAA · 2026-09-01",
          },
        ]}
        checks={[
          {
            sourceEpisodeId: "source",
            sourceUpdatedAt: "2026-09-01T00:00:00.000Z",
            ruleText: "原始检查文本",
            result: "deviated",
          },
        ]}
        onChange={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    expect(screen.getByText("原始检查文本")).toBeInTheDocument();
    expect(screen.queryByText("来源已经改写")).not.toBeInTheDocument();
  });
});
