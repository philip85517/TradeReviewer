import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const recallHarness = vi.hoisted(() => ({
  guard: null as (() => Promise<boolean>) | null,
}));

vi.mock("../recall/recall-workspace", () => ({
  RecallWorkspace: ({
    headerActions,
    onLeaveGuardChange,
  }: {
    headerActions?: ReactNode;
    onLeaveGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
  }) => {
    useEffect(() => {
      onLeaveGuardChange?.(recallHarness.guard);
      return () => onLeaveGuardChange?.(null);
    }, [onLeaveGuardChange]);
    return <div data-testid="recall-workspace-mock">{headerActions}</div>;
  },
}));

import { reviewDesignPreviewNavigation, ReviewDesignPreview } from "./review-design-preview";

const previewProps = {
  variant: "recommended" as const,
  episode: {} as never,
  candles: [],
  instrument: {} as never,
};

afterEach(() => {
  cleanup();
  recallHarness.guard = null;
  vi.restoreAllMocks();
});

describe("ReviewDesignPreview index navigation", () => {
  it("waits for the Recall leave guard and keeps the preview open when saving is refused", async () => {
    const guard = vi.fn().mockResolvedValue(false);
    recallHarness.guard = guard;
    const assign = vi.spyOn(reviewDesignPreviewNavigation, "assign").mockImplementation(() => undefined);
    render(<ReviewDesignPreview {...previewProps} />);

    fireEvent.click(screen.getByRole("link", { name: "样板索引" }));

    await waitFor(() => expect(guard).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("recall-workspace-mock")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("deduplicates index navigation while a leave guard is pending", async () => {
    let resolveGuard!: (allowed: boolean) => void;
    const guard = vi.fn(() => new Promise<boolean>((resolve) => { resolveGuard = resolve; }));
    recallHarness.guard = guard;
    const assign = vi.spyOn(reviewDesignPreviewNavigation, "assign").mockImplementation(() => undefined);
    render(<ReviewDesignPreview {...previewProps} />);
    const link = screen.getByRole("link", { name: "样板索引" });

    fireEvent.click(link);
    fireEvent.click(link);
    expect(guard).toHaveBeenCalledTimes(1);

    resolveGuard(true);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/design/review?index=1"));
  });
});
