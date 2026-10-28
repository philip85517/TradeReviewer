import { describe, expect, it } from "vitest";
import type { HomepageRequest } from "../../lib/reviews/homepage-v25-state";
import { homepageProducerRequestKey } from "./source-contract";

const request: HomepageRequest = {
  domain: "global", generation: 7, scopeKey: "live/all", startedAt: 123,
  target: { live: true, market: "all", accounts: ["A"], rangeMode: "all",
    attachments: { categories: [], openOnly: false, pendingReview: [] } },
};

describe("homepage producer request identity", () => {
  it("returns a stable string for the complete request without changing S's numeric generation", () => {
    const original = structuredClone(request);
    const key = homepageProducerRequestKey(request);
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
    expect(homepageProducerRequestKey(structuredClone(request))).toBe(key);
    expect(request).toEqual(original);
    expect(request.generation).toBe(7);
  });

  it("distinguishes domain, generation, scope, start time, purpose, and nested target identity", () => {
    const key = homepageProducerRequestKey(request);
    const alternatives = [
      { ...request, domain: "period" as const },
      { ...request, generation: 8 },
      { ...request, scopeKey: "live/hk" },
      { ...request, startedAt: 124 },
      { ...request, purpose: "refresh" as const },
      { ...request, target: { ...request.target, symbolIdentity: "HK:X" } },
      { ...request, target: { ...request.target, attachments: { ...request.target.attachments, openOnly: true } } },
    ];
    for (const alternative of alternatives) expect(homepageProducerRequestKey(alternative)).not.toBe(key);
    expect(new Set(alternatives.map(homepageProducerRequestKey)).size).toBe(alternatives.length);
  });

  it("is independent of object insertion order, including nested target fields", () => {
    const reordered: HomepageRequest = {
      target: { rangeMode: "all", accounts: ["A"], market: "all", live: true,
        attachments: { pendingReview: [], openOnly: false, categories: [] } },
      startedAt: 123, scopeKey: "live/all", generation: 7, domain: "global",
    };
    expect(homepageProducerRequestKey(reordered)).toBe(homepageProducerRequestKey(request));
  });

  it("retains the exact independent period and history targets", () => {
    const base = { generation: 7, scopeKey: "live/all", startedAt: 123 };
    const period = { ...base, domain: "period" as const, target: { preset: "all" as const, from: null, to: null } };
    const history = { ...base, domain: "history" as const, target: { mode: "year" as const, year: 2026 } };
    expect(homepageProducerRequestKey(period)).not.toBe(homepageProducerRequestKey(history));
    expect(homepageProducerRequestKey(history)).not.toBe(homepageProducerRequestKey({ ...history, target: { mode: "year", year: 2025 } }));
  });
});
