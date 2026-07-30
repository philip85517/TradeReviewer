import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEpisodeReviewAutosave } from "./use-episode-review-autosave";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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

  it("writes plan revisions at the knowledge cursor and rewinds to cursor-visible text", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const legacyRecord = {
      version: 1 as const,
      episodeId: "episode-revisions",
      instrumentId: "HK:9868",
      updatedAt: "2025-01-02T10:00:00.000Z",
      plan: {
        thesis: "entry thesis",
        expectedPath: "entry path",
        invalidationCondition: "",
        targetRange: "",
        plannedRiskAmount: "100",
        confidence: null,
      },
      review: {
        decisionQuality: null,
        executionQuality: null,
        riskManagement: "",
        psychology: "",
        reusableRule: "",
        completed: false,
      },
      confirmedTagIds: [],
    };
    const { result, rerender } = renderHook(
      ({ knowledgeCursor }) =>
        useEpisodeReviewAutosave({
          episodeId: "episode-revisions",
          instrumentId: "HK:9868",
          episodeStartedAt: "2025-01-02T10:00:00.000Z",
          knowledgeCursor,
          record: legacyRecord,
          delayMs: 600,
          onSave,
        }),
      {
        initialProps: {
          knowledgeCursor: "2025-01-02T11:00:00.000Z",
        },
      },
    );

    act(() => result.current.updatePlan("thesis", "later thesis"));
    await act(async () => vi.advanceTimersByTimeAsync(600));
    const saved = onSave.mock.calls[0]?.[0];
    expect(saved.planRevisions).toEqual([
      expect.objectContaining({
        knowledgeAt: "2025-01-02T10:00:00.000Z",
        plan: expect.objectContaining({ thesis: "entry thesis" }),
      }),
      expect.objectContaining({
        knowledgeAt: "2025-01-02T11:00:00.000Z",
        plan: expect.objectContaining({ thesis: "later thesis" }),
      }),
    ]);

    rerender({ knowledgeCursor: "2025-01-02T10:30:00.000Z" });
    expect(result.current.draft.plan.thesis).toBe("entry thesis");
    act(() => result.current.updatePlan("expectedPath", "rewind path"));
    await act(async () => vi.advanceTimersByTimeAsync(600));

    const rewindSave = onSave.mock.calls[1]?.[0];
    expect(rewindSave.planRevisions).toEqual([
      expect.objectContaining({
        knowledgeAt: "2025-01-02T10:00:00.000Z",
      }),
      expect.objectContaining({
        knowledgeAt: "2025-01-02T10:30:00.000Z",
        plan: expect.objectContaining({
          thesis: "entry thesis",
          expectedPath: "rewind path",
        }),
      }),
      expect.objectContaining({
        knowledgeAt: "2025-01-02T11:00:00.000Z",
        plan: expect.objectContaining({ thesis: "later thesis" }),
      }),
    ]);

    act(() =>
      result.current.updateReview("psychology", "回看时补充复盘"),
    );
    await act(async () => vi.advanceTimersByTimeAsync(600));
    const reviewSave = onSave.mock.calls[2]?.[0];
    expect(reviewSave.plan.thesis).toBe("later thesis");
    expect(reviewSave.planRevisions.at(-1)?.plan.thesis).toBe(
      "later thesis",
    );
  });

  it("retains a late failed switch flush by episode and retries the same draft", async () => {
    vi.useFakeTimers();
    const firstSave = deferred<void>();
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ episodeId }) =>
        useEpisodeReviewAutosave({
          episodeId,
          instrumentId: "HK:9868",
          knowledgeCursor: "2025-01-02T11:00:00.000Z",
          episodeStartedAt: "2025-01-02T10:00:00.000Z",
          onSave,
        }),
      { initialProps: { episodeId: "episode-late-failure-a" } },
    );

    act(() => result.current.updateReview("psychology", "未落盘草稿"));
    rerender({ episodeId: "episode-late-failure-b" });
    await act(async () => firstSave.reject(new Error("quota")));

    rerender({ episodeId: "episode-late-failure-a" });
    expect(result.current.draft.review.psychology).toBe("未落盘草稿");
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("保存失败，请检查本机存储后重试");

    await act(async () => result.current.retry());
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        episodeId: "episode-late-failure-a",
        review: expect.objectContaining({ psychology: "未落盘草稿" }),
      }),
    );
    expect(result.current.status).toBe("saved");
  });

  it("retains an unmount flush rejection and ignores stale completion ordering", async () => {
    vi.useFakeTimers();
    const staleSave = deferred<void>();
    const currentSave = deferred<void>();
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => staleSave.promise)
      .mockImplementationOnce(() => currentSave.promise)
      .mockResolvedValue(undefined);
    const first = renderHook(() =>
      useEpisodeReviewAutosave({
        episodeId: "episode-unmount-failure",
        instrumentId: "US:XPEV",
        knowledgeCursor: "2025-01-02T11:00:00.000Z",
        episodeStartedAt: "2025-01-02T10:00:00.000Z",
        onSave,
      }),
    );

    act(() => first.result.current.updatePlan("thesis", "first draft"));
    first.unmount();

    const second = renderHook(() =>
      useEpisodeReviewAutosave({
        episodeId: "episode-unmount-failure",
        instrumentId: "US:XPEV",
        knowledgeCursor: "2025-01-02T11:00:00.000Z",
        episodeStartedAt: "2025-01-02T10:00:00.000Z",
        onSave,
      }),
    );
    act(() => second.result.current.updatePlan("thesis", "newer draft"));
    await act(async () => vi.advanceTimersByTimeAsync(600));

    await act(async () => staleSave.resolve());
    expect(second.result.current.draft.plan.thesis).toBe("newer draft");
    expect(second.result.current.status).toBe("saving");

    await act(async () => currentSave.reject(new Error("quota")));
    expect(second.result.current.draft.plan.thesis).toBe("newer draft");
    expect(second.result.current.status).toBe("error");

    await act(async () => second.result.current.retry());
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ thesis: "newer draft" }),
      }),
    );
    expect(second.result.current.status).toBe("saved");
  });

  it("restores a draft whose unmount flush rejected after disposal", async () => {
    vi.useFakeTimers();
    const unmountSave = deferred<void>();
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => unmountSave.promise)
      .mockResolvedValue(undefined);
    const first = renderHook(() =>
      useEpisodeReviewAutosave({
        episodeId: "episode-disposed-rejection",
        instrumentId: "US:XPEV",
        knowledgeCursor: "2025-01-02T11:00:00.000Z",
        episodeStartedAt: "2025-01-02T10:00:00.000Z",
        onSave,
      }),
    );

    act(() =>
      first.result.current.updateReview(
        "riskManagement",
        "必须保留",
      ),
    );
    first.unmount();
    await act(async () => unmountSave.reject(new Error("quota")));

    const second = renderHook(() =>
      useEpisodeReviewAutosave({
        episodeId: "episode-disposed-rejection",
        instrumentId: "US:XPEV",
        knowledgeCursor: "2025-01-02T11:00:00.000Z",
        episodeStartedAt: "2025-01-02T10:00:00.000Z",
        onSave,
      }),
    );

    expect(second.result.current.draft.review.riskManagement).toBe(
      "必须保留",
    );
    expect(second.result.current.status).toBe("error");
    await act(async () => second.result.current.retry());
    expect(second.result.current.status).toBe("saved");
  });
});
