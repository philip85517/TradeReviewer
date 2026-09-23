import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyReferenceCapitalState } from "./reference-capital-model";
import { useReferenceCapital, type ReferenceCapitalClient } from "./use-reference-capital";

describe("useReferenceCapital", () => {
  it("does not refetch on rerender when the default client is used", async () => {
    const read = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(emptyReferenceCapitalState()), {status: 200}));
    const { result, rerender, unmount } = renderHook(() => useReferenceCapital());
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender(); rerender();
    expect(read).toHaveBeenCalledTimes(1);
    unmount();
    read.mockRestore();
  });
  it("keeps a failed save draft responsibility with the caller", async () => {
    const client: ReferenceCapitalClient = { read: vi.fn().mockResolvedValue(emptyReferenceCapitalState()), save: vi.fn().mockRejectedValue(new Error("保存失败")), remove: vi.fn() };
    const { result } = renderHook(() => useReferenceCapital({ client }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { expect(await result.current.save({ nature:"live", simulationRunId:null, accountId:"a", currency:"CNY", fromDate:"2026-01-01", toDate:"2026-12-31", amount:"1" })).toBe(false); });
    expect(result.current.error).toBe("保存失败");
  });
});

it("clears saving when a refresh overlaps a save", async () => {
  let finish!: (value: ReturnType<typeof emptyReferenceCapitalState>) => void;
  const pending = new Promise<ReturnType<typeof emptyReferenceCapitalState>>(resolve => { finish = resolve; });
  const client: ReferenceCapitalClient = { read: vi.fn().mockResolvedValue(emptyReferenceCapitalState()), save: vi.fn().mockReturnValue(pending), remove: vi.fn() };
  const { result } = renderHook(() => useReferenceCapital({client}));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let save!: Promise<boolean>;
  act(() => { save = result.current.save({nature:"live",simulationRunId:null,accountId:"a",currency:"CNY",fromDate:"2026-01-01",toDate:"2026-12-31",amount:"100"}); });
  let refresh!: Promise<void>;
  act(() => { refresh = result.current.refresh(); });
  await act(async () => { finish(emptyReferenceCapitalState()); await save; await refresh; });
  expect(result.current.saving).toBe(false);
  expect(result.current.loading).toBe(false);
});
