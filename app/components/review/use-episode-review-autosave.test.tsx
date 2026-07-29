import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEpisodeReviewAutosave } from "./use-episode-review-autosave";

describe("useEpisodeReviewAutosave", () => {
  afterEach(() => vi.useRealTimers());

  it("debounces normalized episode-scoped updates and reports saved", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useEpisodeReviewAutosave({
        episodeId: "episode-1",
        instrumentId: "HK:9868",
        delayMs: 600,
        onSave,
      }),
    );

    act(() => result.current.updatePlan("thesis", " 等待回踩 "));
    expect(result.current.status).toBe("dirty");
    await act(async () => vi.advanceTimersByTimeAsync(599));
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: "episode-1",
        instrumentId: "HK:9868",
        plan: expect.objectContaining({ thesis: "等待回踩" }),
      }),
    );
    expect(result.current.status).toBe("saved");
  });

  it("keeps an invalid or rejected draft for correction and retry", async () => {
    vi.useFakeTimers();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useEpisodeReviewAutosave({
        episodeId: "episode-1",
        instrumentId: "HK:9868",
        onSave,
      }),
    );

    act(() => result.current.updatePlan("plannedRiskAmount", "-1"));
    await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.error).toBe("计划风险必须大于 0");
    expect(result.current.status).toBe("error");

    act(() => result.current.updatePlan("plannedRiskAmount", "100"));
    await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(result.current.status).toBe("error");
    expect(result.current.draft.plan.plannedRiskAmount).toBe("100");
    await act(async () => result.current.retry());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  it("flushes a valid pending record when its episode changes and keeps drafts isolated", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender, unmount } = renderHook(
      ({ episodeId }) =>
        useEpisodeReviewAutosave({
          episodeId,
          instrumentId: "HK:9868",
          onSave,
        }),
      { initialProps: { episodeId: "episode-1" } },
    );

    act(() => result.current.updateReview("psychology", "遵守纪律"));
    rerender({ episodeId: "episode-2" });
    await act(async () => Promise.resolve());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: "episode-1",
        review: expect.objectContaining({ psychology: "遵守纪律" }),
      }),
    );
    expect(result.current.draft.episodeId).toBe("episode-2");
    expect(result.current.draft.review.psychology).toBe("");

    act(() => result.current.updatePlan("thesis", "待保存"));
    unmount();
    await act(async () => Promise.resolve());
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        episodeId: "episode-2",
        plan: expect.objectContaining({ thesis: "待保存" }),
      }),
    );
  });
});
