import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  InstrumentLookup,
  ResolvedInstrument,
} from "../metadata-contracts";
import {
  InstrumentMetadataProviderError,
  type InstrumentMetadataProvider,
} from "./metadata-errors";
import {
  InstrumentMetadataResolutionError,
  createMetadataRouter,
} from "./metadata-router";

const LOOKUP: InstrumentLookup = { market: "US", symbol: "NVDA" };
const RESOLVED: ResolvedInstrument = {
  ...LOOKUP,
  name: "英伟达",
  assetType: "stock",
  source: "tencent",
  confidence: "portal",
  resolvedAt: "2026-07-29T00:00:00.000Z",
};

function provider(
  id: InstrumentMetadataProvider["id"],
  resolve: InstrumentMetadataProvider["resolve"],
): InstrumentMetadataProvider {
  return {
    id,
    supports: () => true,
    resolve,
  };
}

describe("instrument metadata router", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the market-specific fallback order and returns the first success", async () => {
    const calls: string[] = [];
    const failingNasdaq = provider("nasdaq", async () => {
      calls.push("nasdaq");
      throw new InstrumentMetadataProviderError(
        "no-data",
        "Nasdaq 没有该证券",
      );
    });
    const successfulTencent = provider("tencent", async () => {
      calls.push("tencent");
      return RESOLVED;
    });
    const unusedSec = provider("sec", async () => {
      calls.push("sec");
      return { ...RESOLVED, source: "sec", confidence: "official" };
    });

    const router = createMetadataRouter(fetch, Date.now, {
      US: [failingNasdaq, successfulTencent, unusedSec],
    });

    await expect(router.resolve(LOOKUP)).resolves.toEqual({
      ...RESOLVED,
      localizedName: {
        name: RESOLVED.name,
        locale: "zh-CN",
        source: RESOLVED.source,
        resolvedAt: RESOLVED.resolvedAt,
      },
    });
    expect(calls).toEqual(["nasdaq", "tencent"]);
  });

  it("passes the injected fetcher to providers", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const resolve = vi.fn(async () => RESOLVED);
    const router = createMetadataRouter(fetcher, Date.now, {
      US: [provider("tencent", resolve)],
    });

    await router.resolve(LOOKUP);

    expect(resolve).toHaveBeenCalledWith(LOOKUP, fetcher);
  });

  it("adds a verified Tencent Chinese name without replacing the primary metadata", async () => {
    const primary = provider("nasdaq", async () => ({
      ...LOOKUP,
      name: "NVIDIA Corporation",
      assetType: "stock",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    }));
    const localized = provider("tencent", async () => ({
      ...LOOKUP,
      name: "英伟达",
      assetType: "stock",
      source: "tencent",
      confidence: "portal",
      resolvedAt: "2026-07-29T00:01:00.000Z",
    }));

    await expect(
      createMetadataRouter(fetch, Date.now, { US: [primary, localized] }).resolve(LOOKUP),
    ).resolves.toMatchObject({
      name: "NVIDIA Corporation",
      localizedName: {
        name: "英伟达",
        locale: "zh-CN",
        source: "tencent",
        resolvedAt: "2026-07-29T00:01:00.000Z",
      },
    });
  });

  it("derives an overlay when Tencent is the successful Hong Kong fallback", async () => {
    const lookup: InstrumentLookup = { market: "HK", symbol: "700" };
    const primary = provider("hkex", async () => {
      throw new InstrumentMetadataProviderError("no-data", "HKEX 无数据");
    });
    const localized = provider("tencent", async () => ({
      ...lookup,
      name: "腾讯控股",
      assetType: "stock",
      source: "tencent",
      confidence: "portal",
      resolvedAt: "2026-07-29T00:01:00.000Z",
    }));

    await expect(
      createMetadataRouter(fetch, Date.now, { HK: [primary, localized] }).resolve(
        lookup,
      ),
    ).resolves.toMatchObject({
      name: "腾讯控股",
      localizedName: {
        name: "腾讯控股",
        locale: "zh-CN",
        source: "tencent",
      },
    });
  });

  it("keeps valid primary metadata when Chinese lookup fails", async () => {
    const primary = provider("nasdaq", async () => ({
      ...LOOKUP,
      name: "NVIDIA Corporation",
      assetType: "stock",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    }));
    const localized = provider("tencent", async () => {
      throw new InstrumentMetadataProviderError("source-timeout", "timeout");
    });

    await expect(
      createMetadataRouter(fetch, Date.now, { US: [primary, localized] }).resolve(LOOKUP),
    ).resolves.toEqual({
      ...LOOKUP,
      name: "NVIDIA Corporation",
      assetType: "stock",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    });
  });

  it("keeps a valid primary when the optional Chinese provider aborts the shared request", async () => {
    const primary = provider("nasdaq", async () => ({
      ...LOOKUP,
      name: "NVIDIA Corporation",
      assetType: "stock",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    }));
    const localized = provider("tencent", async () => {
      throw new InstrumentMetadataProviderError(
        "source-timeout",
        "optional lookup aborted",
      );
    });
    const controller = new AbortController();
    const originalResolve = localized.resolve;
    localized.resolve = async (...args) => {
      controller.abort(new Error("optional lookup aborted"));
      return originalResolve(...args);
    };

    await expect(
      createMetadataRouter(fetch, Date.now, { US: [primary, localized] }).resolve(
        LOOKUP,
        controller.signal,
      ),
    ).resolves.toMatchObject({ name: "NVIDIA Corporation" });
  });

  it("returns the valid primary before a hanging optional Chinese lookup reaches the route deadline", async () => {
    vi.useFakeTimers();
    const primary = provider("nasdaq", async () => ({
      ...LOOKUP,
      name: "NVIDIA Corporation",
      assetType: "stock",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    }));
    const localized = provider("tencent", async () => new Promise<never>(() => {}));
    const pending = createMetadataRouter(fetch, Date.now, {
      US: [primary, localized],
    }).resolve(LOOKUP);

    await vi.advanceTimersByTimeAsync(2_100);

    await expect(pending).resolves.toMatchObject({
      name: "NVIDIA Corporation",
      source: "nasdaq",
    });
  });

  it("treats a provider result that violates the contract as an invalid response", async () => {
    const router = createMetadataRouter(fetch, Date.now, {
      US: [
        provider("nasdaq", async () => ({
          ...RESOLVED,
          symbol: "AAPL",
          source: "nasdaq",
          confidence: "official",
        })),
      ],
    });

    await expect(router.resolve(LOOKUP)).rejects.toMatchObject({
      failure: {
        attempts: [{ source: "nasdaq", code: "invalid-response" }],
      },
    });
  });

  it("stops before a later provider when the resolver chain is aborted", async () => {
    const controller = new AbortController();
    const timeoutError = new InstrumentMetadataProviderError(
      "source-timeout",
      "证券元数据请求超时",
    );
    const laterProvider = vi.fn(async () => RESOLVED);
    const router = createMetadataRouter(fetch, Date.now, {
      US: [
        provider("nasdaq", async () => {
          controller.abort(timeoutError);
          throw timeoutError;
        }),
        provider("tencent", laterProvider),
      ],
    });

    await expect(
      router.resolve(LOOKUP, controller.signal),
    ).rejects.toBe(timeoutError);
    expect(laterProvider).not.toHaveBeenCalled();
  });

  it("returns every failed attempt without exposing provider response bodies", async () => {
    const rawBody = "<html>private upstream body</html>";
    const router = createMetadataRouter(fetch, Date.now, {
      US: [
        provider("nasdaq", async () => {
          throw new InstrumentMetadataProviderError("no-data", rawBody);
        }),
        provider("tencent", async () => {
          throw new InstrumentMetadataProviderError(
            "invalid-response",
            rawBody,
          );
        }),
        provider("sec", async () => {
          throw new Error(rawBody);
        }),
      ],
    });

    let error: unknown;
    try {
      await router.resolve(LOOKUP);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(InstrumentMetadataResolutionError);
    expect(error).toMatchObject({
      code: "invalid-response",
      failure: {
        market: "US",
        symbol: "NVDA",
        attempts: [
          { source: "nasdaq", code: "no-data" },
          { source: "tencent", code: "invalid-response" },
          { source: "sec", code: "source-unavailable" },
        ],
      },
    });
    expect(JSON.stringify(error)).not.toContain(rawBody);
  });
});
