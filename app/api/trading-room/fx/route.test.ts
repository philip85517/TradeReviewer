import { describe, expect, it, vi } from "vitest";

import type { FxService } from "../../../lib/fx/fx-service";
import { createFxHandlers } from "./route";

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

function service(): FxService {
  return {
    read: vi.fn(() => state),
    ensureDaily: vi.fn(async () => state),
    refresh: vi.fn(async () => state),
  };
}

describe("/api/trading-room/fx", () => {
  it("returns the persisted daily state with no-store caching", async () => {
    const fx = service();
    const { GET } = createFxHandlers(fx);

    const response = await GET(new Request("http://localhost/api/trading-room/fx"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(state);
    expect(fx.ensureDaily).toHaveBeenCalledOnce();
  });

  it("uses POST for an explicit manual refresh and ignores request input", async () => {
    const fx = service();
    const { POST } = createFxHandlers(fx);

    const response = await POST(new Request("http://localhost/api/trading-room/fx", {
      method: "POST",
      body: JSON.stringify({ account: "must-not-reach-boc" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(state);
    expect(fx.refresh).toHaveBeenCalledOnce();
  });

  it("maps storage failures to a transient 503", async () => {
    const fx = service();
    vi.mocked(fx.ensureDaily).mockRejectedValueOnce(new Error("db unavailable"));
    const { GET } = createFxHandlers(fx);

    const response = await GET(new Request("http://localhost/api/trading-room/fx"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "storage-unavailable", message: "汇率状态暂时不可用" },
    });
  });
});
