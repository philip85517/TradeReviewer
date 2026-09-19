import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyPrincipalState, type PrincipalMutation, type PrincipalScope, type PrincipalState } from "./principal-model";
import { createPrincipalSettingsClient, usePrincipalSettings, type UsePrincipalSettingsResult } from "./use-principal-settings";

const initial: PrincipalState = {
  version: 1,
  scopes: {
    live: { "a-share-stock": { amount: "10000", currency: "CNY" } },
    "simulation:run-1": { "a-share-stock": { amount: "5000", currency: "USD" } },
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("principal settings client and hook", () => {
  it("hydrates persisted live and simulation values, saves, clears, and reopens", async () => {
    let persisted = initial;
    const fetcher = vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const mutation = JSON.parse(String(init.body)) as { category: string; value: unknown; scope: { nature: string; simulationRunId: string | null } };
        const key = mutation.scope.nature === "live" ? "live" : `simulation:${mutation.scope.simulationRunId}`;
        const scopes = { ...persisted.scopes, [key]: { ...(persisted.scopes[key] ?? {}) } };
        if (mutation.value === null) delete scopes[key][mutation.category as keyof typeof scopes[typeof key]];
        else scopes[key][mutation.category as keyof typeof scopes[typeof key]] = mutation.value as never;
        persisted = { version: 1, scopes };
        return Response.json(persisted);
      }
      return Response.json(persisted);
    });
    const client = createPrincipalSettingsClient(fetcher);
    const hook = renderHook<UsePrincipalSettingsResult, { scope: PrincipalScope }>(({ scope }) => usePrincipalSettings({ scope, client }), {
      initialProps: { scope: { nature: "live", simulationRunId: null } satisfies PrincipalScope },
    });

    await waitFor(() => expect(hook.result.current.config["a-share-stock"]).toEqual({ amount: "10000", currency: "CNY" }));
    await act(async () => {
      await hook.result.current.save("hk-stock", { amount: "12000", currency: "HKD" });
    });
    expect(hook.result.current.config["hk-stock"]).toEqual({ amount: "12000", currency: "HKD" });

    hook.rerender({ scope: { nature: "simulation", simulationRunId: "run-1" } as PrincipalScope });
    expect(hook.result.current.config["a-share-stock"]).toEqual({ amount: "5000", currency: "USD" });
    await act(async () => {
      await hook.result.current.clear("a-share-stock");
    });
    expect(hook.result.current.config["a-share-stock"]).toBeUndefined();

    hook.unmount();
    const reopened = renderHook(() => usePrincipalSettings({
      scope: { nature: "live", simulationRunId: null },
      client,
    }));
    await waitFor(() => expect(reopened.result.current.config["hk-stock"]).toEqual({ amount: "12000", currency: "HKD" }));
    expect(reopened.result.current.config["a-share-stock"]).toEqual({ amount: "10000", currency: "CNY" });
  });

  it("keeps the current configuration when a save fails and exposes the API error", async () => {
    const client = {
      read: vi.fn(async () => initial),
      mutate: vi.fn(async () => { throw new Error("本金设置暂时不可用"); }),
    };
    const hook = renderHook(() => usePrincipalSettings({
      scope: { nature: "live", simulationRunId: null },
      client,
    }));
    await waitFor(() => expect(hook.result.current.config["a-share-stock"]).toBeDefined());

    let saved = true;
    await act(async () => { saved = await hook.result.current.save("a-share-stock", { amount: "20000", currency: "CNY" }); });

    expect(saved).toBe(false);
    expect(hook.result.current.config["a-share-stock"]).toEqual({ amount: "10000", currency: "CNY" });
    expect(hook.result.current.error).toBe("本金设置暂时不可用");
    expect(hook.result.current.saving).toBe(false);
  });

  it("does not fetch while disabled", async () => {
    const fetcher = vi.fn(async () => Response.json(emptyPrincipalState()));
    const client = createPrincipalSettingsClient(fetcher);
    renderHook(() => usePrincipalSettings({ enabled: false, client }));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps a save result when StrictMode replays a stale read", async () => {
    const resolvers: Array<(value: PrincipalState) => void> = [];
    const saved: PrincipalState = {
      version: 1,
      scopes: { live: { "a-share-stock": { amount: "20000", currency: "CNY" } } },
    };
    const client = {
      read: vi.fn(() => new Promise<PrincipalState>(resolve => { resolvers.push(resolve); })),
      mutate: vi.fn(async () => saved),
    };
    const hook = renderHook<UsePrincipalSettingsResult, { scope: PrincipalScope }>(
      ({ scope }) => usePrincipalSettings({ scope, client }),
      {
        initialProps: { scope: { nature: "live", simulationRunId: null } satisfies PrincipalScope },
        wrapper: StrictMode,
      },
    );
    await waitFor(() => expect(client.read).toHaveBeenCalledOnce());

    await act(async () => {
      await hook.result.current.save("a-share-stock", { amount: "20000", currency: "CNY" });
    });
    expect(hook.result.current.config["a-share-stock"]).toEqual({ amount: "20000", currency: "CNY" });
    await act(async () => {
      resolvers.forEach(resolve => resolve(initial));
      await Promise.resolve();
    });
    expect(hook.result.current.config["a-share-stock"]).toEqual({ amount: "20000", currency: "CNY" });
  });

  it("normalizes a stale simulation run id away when the selected scope is live", async () => {
    const mutations: PrincipalMutation[] = [];
    const client = {
      read: vi.fn(async () => emptyPrincipalState()),
      mutate: vi.fn(async (mutation: PrincipalMutation) => {
        mutations.push(mutation);
        return initial;
      }),
    };
    const hook = renderHook(() => usePrincipalSettings({
      scope: { nature: "live", simulationRunId: "run-that-is-no-longer-selected" },
      client,
    }));

    await act(async () => {
      await hook.result.current.save("a-share-stock", { amount: "12000", currency: "CNY" });
      await hook.result.current.clear("a-share-stock");
    });

    expect(mutations).toHaveLength(2);
    expect(mutations.every(mutation => mutation.scope).valueOf()).toBe(true);
    expect(mutations.map(mutation => mutation.scope)).toEqual([
      { nature: "live", simulationRunId: null },
      { nature: "live", simulationRunId: null },
    ]);
  });
});
