import { describe, expect, it } from "vitest";

import { resolveHoldingsPublicationPhase } from "./review-dashboard";

describe("BR02 publication display boundary", () => {
  it("keeps a failed current permit visible over a local complete candidate", () => {
    expect(resolveHoldingsPublicationPhase({
      candidatePending: true,
      candidateAccepted: false,
      publicationStatus: "failed",
    })).toBe("failed");
  });

  it("keeps cancellation and partial outcomes authoritative while unaccepted", () => {
    expect(resolveHoldingsPublicationPhase({
      candidatePending: true,
      candidateAccepted: false,
      publicationStatus: "cancelled",
    })).toBe("cancelled");
    expect(resolveHoldingsPublicationPhase({
      candidatePending: true,
      candidateAccepted: false,
      publicationStatus: "partial",
    })).toBe("partial");
  });

  it("does not expose complete before the current ledger is accepted", () => {
    expect(resolveHoldingsPublicationPhase({
      candidatePending: true,
      candidateAccepted: false,
      publicationStatus: "complete",
    })).toBe("recomputing");
  });

  it("exposes complete only for an accepted current ledger", () => {
    expect(resolveHoldingsPublicationPhase({
      candidatePending: false,
      candidateAccepted: true,
      publicationStatus: "complete",
    })).toBe("complete");
  });
});
