import { describe, expect, it } from "vitest";

import {
  isPublishableHoldingsPublication,
  needsHoldingsPublicationRetry,
  type HoldingsPublicationPermit,
} from "./holdings-publication-boundary";

function permit(
  status: HoldingsPublicationPermit["status"],
  readbackInstrumentIds: readonly string[] = [],
): HoldingsPublicationPermit {
  return {
    generation: 4,
    revision: "import-partial-readback",
    owner: "import",
    affectedInstrumentIds: ["usd", "eur"],
    requiredMarketDataIds: ["usd"],
    readbackInstrumentIds,
    status,
    receipt: status === "complete" || status === "partial"
      ? { requestedAtByInstrument: { usd: "2026-10-15T01:00:00.000Z" } }
      : undefined,
  };
}

describe("holdings publication boundary", () => {
  it("requires a fresh generation when a terminal partial permit lacks an affected readback", () => {
    const currentScope = new Set(["usd", "eur"]);
    const partial = permit("partial", ["usd"]);

    expect(isPublishableHoldingsPublication(partial, currentScope)).toBe(false);
    expect(needsHoldingsPublicationRetry(partial, currentScope)).toBe(true);
  });

  it.each(["complete", "partial"] as const)(
    "does not replace a fully read-back terminal %s permit",
    status => {
      const currentScope = new Set(["usd", "eur"]);
      const settled = permit(status, ["usd", "eur"]);

      expect(isPublishableHoldingsPublication(settled, currentScope)).toBe(true);
      expect(needsHoldingsPublicationRetry(settled, currentScope)).toBe(false);
    },
  );
});
