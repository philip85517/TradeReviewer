import { describe, expect, it, vi } from "vitest";

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

    await expect(router.resolve(LOOKUP)).resolves.toEqual(RESOLVED);
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
