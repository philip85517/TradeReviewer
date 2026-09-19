import { describe, expect, it, vi } from "vitest";

import {
  emptyPrincipalState,
  PRINCIPAL_SETTINGS_KEY,
  type PrincipalState,
} from "../../../lib/principal/principal-model";
import { createPrincipalHandlers, type PrincipalSettingsStore } from "./route";

function memoryStore(initial: unknown = emptyPrincipalState()): PrincipalSettingsStore & { settings: Record<string, unknown> } {
  let settings = { [PRINCIPAL_SETTINGS_KEY]: initial } as Record<string, unknown>;
  const getSettings = vi.fn(() => settings);
  const putSettings = vi.fn((next: Record<string, unknown>) => {
    settings = { ...settings, ...next };
  });
  return { getSettings, putSettings, get settings() { return settings; } };
}

const liveA = {
  version: 1,
  scope: { nature: "live", simulationRunId: null },
  category: "a-share-stock",
  value: { amount: "10000", currency: "CNY" },
} as const;

describe("/api/trading-room/principal", () => {
  it("round-trips a saved value, keeps simulation runs separate, and clears it on reopen", async () => {
    const store = memoryStore();
    const handlers = createPrincipalHandlers(store);

    const saved = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify(liveA),
    }));
    expect(saved.status).toBe(200);
    expect((await saved.json() as PrincipalState).scopes.live?.["a-share-stock"]).toEqual({ amount: "10000", currency: "CNY" });

    const simulation = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({
        ...liveA,
        scope: { nature: "simulation", simulationRunId: "run-1" },
        value: { amount: "5000", currency: "USD" },
      }),
    }));
    expect(simulation.status).toBe(200);
    expect((await handlers.GET(new Request("http://localhost"))).status).toBe(200);

    const reopened = await handlers.GET(new Request("http://localhost"));
    expect(await reopened.json()).toEqual({
      version: 1,
      scopes: {
        live: { "a-share-stock": { amount: "10000", currency: "CNY" } },
        "simulation:run-1": { "a-share-stock": { amount: "5000", currency: "USD" } },
      },
    } satisfies PrincipalState);

    const cleared = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ...liveA, value: null }),
    }));
    expect(cleared.status).toBe(200);
    expect(await (await handlers.GET(new Request("http://localhost"))).json()).toEqual({
      version: 1,
      scopes: { "simulation:run-1": { "a-share-stock": { amount: "5000", currency: "USD" } } },
    });
  });

  it("rejects invalid amounts, categories, currencies, and simulation scope ids", async () => {
    const store = memoryStore();
    const handlers = createPrincipalHandlers(store);
    for (const value of [
      { ...liveA, value: { amount: "0", currency: "CNY" } },
      { ...liveA, category: "unknown" },
      { ...liveA, value: { amount: "10", currency: "EUR" } },
      { ...liveA, scope: { nature: "simulation", simulationRunId: "" } },
      { ...liveA, version: 2 },
    ]) {
      const response = await handlers.PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(value) }));
      expect(response.status).toBe(400);
    }
    expect(store.putSettings).not.toHaveBeenCalled();
  });

  it("maps malformed JSON and storage failures to stable errors", async () => {
    const store = memoryStore();
    const handlers = createPrincipalHandlers(store);
    expect((await handlers.PUT(new Request("http://localhost", { method: "PUT", body: "{" }))).status).toBe(400);

    (store.getSettings as unknown as { mockImplementation: (implementation: () => Record<string, unknown>) => void }).mockImplementation(() => { throw new Error("db unavailable"); });
    expect((await handlers.GET(new Request("http://localhost"))).status).toBe(503);

    const writeStore = memoryStore();
    (writeStore.putSettings as unknown as { mockImplementation: (implementation: (settings: Record<string, unknown>) => void) => void }).mockImplementation(() => { throw new Error("db unavailable"); });
    const writeHandlers = createPrincipalHandlers(writeStore);
    const response = await writeHandlers.PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(liveA) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "storage-unavailable", message: "本金设置暂时不可用" },
    });
  });
});
