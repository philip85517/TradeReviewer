import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const previewStyles = readFileSync(resolve(__dirname, "review-design-preview.css"), "utf8");

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

describe("ReviewDesignPreview recommended compact frame contract", () => {
  it("keeps the compact frame scoped to the recommended variant", () => {
    expect(previewStyles).toMatch(/\.review-design-preview--recommended \.recall-header/);
    expect(previewStyles).not.toMatch(/(?<!recommended )\.recall-header\s*\{[^}]*min-height:\s*48px/);
  });

  it("uses a compact header and side-local panel controls", () => {
    expect(previewStyles).toMatch(/\.review-design-preview--recommended \.recall-header\s*\{[\s\S]*?min-height:\s*48px/);
    expect(previewStyles).toMatch(/\.review-design-preview--recommended \.recall-edge-toggle--left\s*\{[^}]*left:\s*0/);
    expect(previewStyles).toMatch(/\.review-design-preview--recommended \.recall-edge-toggle--right\s*\{[^}]*right:\s*0/);
  });

  it("keeps the wide desktop cascade on the compact single-row baseline", () => {
    expect(previewStyles).toMatch(/@media\s*\(min-width:\s*1280px\)[\s\S]*?\.review-design-preview--recommended \.recall-header\s*\{[\s\S]*?min-height:\s*48px[\s\S]*?flex-wrap:\s*nowrap/);
  });

  it("centers icon-first replay actions with desktop and coarse-pointer hit boxes", () => {
    expect(previewStyles).toMatch(/\.review-design-preview--recommended \.recall-main > \.recall-replay-bar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) max-content minmax\(0, 1fr\)/);
    expect(previewStyles).toMatch(/\.review-design-preview--recommended \.recall-controls \.recall-replay-action\s*\{[\s\S]*?width:\s*36px[\s\S]*?height:\s*36px/);
    expect(previewStyles).toMatch(/\.review-design-preview--recommended \.recall-edge-toggle,\s*\.review-design-preview--recommended \.recall-controls \.recall-replay-action,\s*\.review-design-preview--recommended \.recall-replay-more__summary\s*\{[\s\S]*?width:\s*44px/);
  });
});
