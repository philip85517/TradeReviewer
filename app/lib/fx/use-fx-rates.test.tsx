import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFxRates } from "./use-fx-rates";

const state = {
  id: "boc:2026-09-19T03:00:00.000Z",
  baseCurrency: "CNY" as const,
  source: "BOC" as const,
  publishedAt: "2026-09-19T10:30:00+08:00",
  publishedAtByCurrency: {
    USD: "2026-09-19T10:30:00+08:00",
    HKD: "2026-09-19T10:30:00+08:00",
  },
  fetchedAt: "2026-09-19T03:00:00.000Z",
  rates: { USD: "6.7521", HKD: "0.8606" },
  lastAttemptDay: "2026-09-19",
  status: "complete" as const,
  error: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("useFxRates", () => {
  it("loads only when enabled and manually refreshes through POST", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(state))
      .mockResolvedValueOnce(Response.json({ ...state, id: "boc:next" }));
    vi.stubGlobal("fetch", fetcher);
    const hook = renderHook(({ enabled }) => useFxRates({ enabled }), {
      initialProps: { enabled: false },
    });

    expect(fetcher).not.toHaveBeenCalled();
    hook.rerender({ enabled: true });
    await waitFor(() => expect(hook.result.current.state?.id).toBe(state.id));
    expect(fetcher).toHaveBeenCalledWith("/api/trading-room/fx", expect.objectContaining({ method: "GET", cache: "no-store" }));

    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.state?.id).toBe("boc:next");
    expect(fetcher).toHaveBeenLastCalledWith("/api/trading-room/fx", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });

  it("surfaces a transient API error without replacing a prior snapshot", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(state))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const hook = renderHook(() => useFxRates({ enabled: true }));

    await waitFor(() => expect(hook.result.current.state?.id).toBe(state.id));
    await act(async () => { await hook.result.current.refresh(); });

    expect(hook.result.current.state?.id).toBe(state.id);
    expect(hook.result.current.error).toBe("汇率状态暂时不可用");
    expect(hook.result.current.refreshing).toBe(false);
  });

  it("aborts an in-flight request when the hook unmounts", async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn((_input: string, init?: RequestInit) => {
      signal = init?.signal;
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetcher);
    const hook = renderHook(() => useFxRates({ enabled: true }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    hook.unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("clears loading when a manual refresh supersedes the initial GET", async () => {
    let getSignal: AbortSignal | null | undefined;
    const fetcher = vi.fn()
      .mockImplementationOnce((_input: string, init?: RequestInit) => {
        getSignal = init?.signal;
        return new Promise<Response>(() => undefined);
      })
      .mockResolvedValueOnce(Response.json(state));
    vi.stubGlobal("fetch", fetcher);
    const hook = renderHook(() => useFxRates({ enabled: true }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

    await act(async () => { await hook.result.current.refresh(); });

    expect(getSignal?.aborted).toBe(true);
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.refreshing).toBe(false);
  });
});
