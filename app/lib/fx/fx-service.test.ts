import { describe, expect, it, vi } from "vitest";

import { FX_SETTINGS_KEY } from "./contracts";
import { createFxService, type FxSettingsStore } from "./fx-service";

const sourceHtml = `
  <table id="priceTable">
    <thead><tr><th>货币名称</th><th>中行折算价</th><th>发布日期</th><th>发布时间</th></tr></thead>
    <tr><td>美元</td><td>675.21</td><td>2026/09/19</td><td>10:30:00</td></tr>
    <tr><td>港币</td><td>86.06</td><td>2026/09/19</td><td>10:30:00</td></tr>
  </table>
`;

function memoryStore(initial?: Record<string, unknown>): FxSettingsStore & { saved: unknown[] } {
  const saved: unknown[] = [];
  let settings = { ...initial };
  return {
    saved,
    getSettings: () => settings,
    putSettings: (next) => {
      settings = { ...settings, ...next };
      saved.push(next);
    },
  };
}

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

describe("createFxService", () => {
  it("persists one atomic complete snapshot and normalizes BOC per-100 values", async () => {
    const store = memoryStore();
    const fetcher = vi.fn(async () => response(sourceHtml));
    const service = createFxService({
      store,
      fetcher,
      now: () => new Date("2026-09-19T03:00:00.000Z"),
      maxAttempts: 1,
    });

    const state = await service.refresh();

    expect(fetcher).toHaveBeenCalledWith(
      "https://www.boc.cn/sourcedb/whpj/",
      expect.objectContaining({ cache: "no-store", method: "GET" }),
    );
    expect(state).toMatchObject({
      baseCurrency: "CNY",
      source: "BOC",
      rates: { USD: "6.7521", HKD: "0.8606" },
      status: "complete",
      publishedAt: "2026-09-19T10:30:00+08:00",
      publishedAtByCurrency: {
        USD: "2026-09-19T10:30:00+08:00",
        HKD: "2026-09-19T10:30:00+08:00",
      },
      fetchedAt: "2026-09-19T03:00:00.000Z",
      lastAttemptDay: "2026-09-19",
      error: null,
    });
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]).toEqual({ [FX_SETTINGS_KEY]: state });
  });

  it("automatically attempts once per Shanghai day, including a failed day", async () => {
    const store = memoryStore();
    const fetcher = vi.fn(async () => response("upstream unavailable", 503));
    let now = new Date("2026-09-18T16:30:00.000Z");
    const service = createFxService({ store, fetcher, now: () => now, maxAttempts: 1 });

    const first = await service.ensureDaily();
    const second = await service.ensureDaily();
    now = new Date("2026-09-19T16:30:00.000Z");
    const third = await service.ensureDaily();

    expect(first.status).toBe("missing");
    expect(first.error).toContain("503");
    expect(second.lastAttemptDay).toBe("2026-09-19");
    expect(third.lastAttemptDay).toBe("2026-09-20");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps a prior usable snapshot when a later refresh fails", async () => {
    const store = memoryStore();
    const fetcher = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(response(sourceHtml))
      .mockResolvedValueOnce(response("bad gateway", 502));
    let now = new Date("2026-09-19T03:00:00.000Z");
    const service = createFxService({ store, fetcher, now: () => now, maxAttempts: 1 });

    const oldState = await service.refresh();
    now = new Date("2026-09-20T03:00:00.000Z");
    const staleState = await service.refresh();

    expect(staleState).toMatchObject({
      id: oldState.id,
      rates: oldState.rates,
      publishedAt: oldState.publishedAt,
      fetchedAt: oldState.fetchedAt,
      status: "complete",
      lastAttemptDay: "2026-09-20",
    });
    expect(staleState.error).toContain("502");
  });

  it("keeps a partial successful view when one currency is missing", async () => {
    const store = memoryStore();
    const fetcher = vi.fn(async () => response(sourceHtml.replace(/<tr><td>港币[\s\S]*?<\/tr>/u, "")));
    const service = createFxService({
      store,
      fetcher,
      now: () => new Date("2026-09-19T03:00:00.000Z"),
      maxAttempts: 1,
    });

    const state = await service.refresh();

    expect(state.status).toBe("partial");
    expect(state.rates).toEqual({ USD: "6.7521" });
    expect(state.error).toBe("缺少港币汇率");
  });

  it("deduplicates concurrent refreshes and allows the next manual refresh after completion", async () => {
    const store = memoryStore();
    let resolveFetch!: (value: Response) => void;
    const fetcher = vi.fn<() => Promise<Response>>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }))
      .mockResolvedValue(response(sourceHtml));
    const service = createFxService({
      store,
      fetcher,
      now: () => new Date("2026-09-19T03:00:00.000Z"),
      maxAttempts: 1,
    });

    const first = service.refresh();
    const second = service.refresh();
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveFetch(response(sourceHtml));
    await Promise.all([first, second]);
    await service.refresh();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("bounds a response whose body never finishes after headers arrive", async () => {
    const store = memoryStore();
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: () => new Promise<string>(() => undefined),
    }) as Response);
    const service = createFxService({ store, fetcher, timeoutMs: 10, maxAttempts: 1 });

    const state = await service.refresh();

    expect(state.status).toBe("missing");
    expect(state.error).toBe("更新失败：汇率源请求超时");
  });
});
