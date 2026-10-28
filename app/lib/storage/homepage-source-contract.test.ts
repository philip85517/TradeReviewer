import { homepageTestSnapshot } from "./homepage-source-fixture.test-support";
import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeHomepageSourceBinding, parseHomepageStoredCollection, type HomepageStoredCollection } from "./homepage-source-contract";
import { createSqliteHttpClient } from "./sqlite-http-client";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

function fixture(): HomepageStoredCollection {
  const bootstrap = { schemaVersion: 1, migration: null, executions: [], importHistory: [], instruments: [], reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {} };
  const value: HomepageStoredCollection = {
    ...homepageTestSnapshot(bootstrap),
    bootstrap: {
      schemaVersion: 1, migration: null, executions: [], importHistory: [], instruments: [],
      reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {},
    },
    recallSummaries: [],
    receipt: {
      policy: "homepage-stored-collection-v1", scope: "all-persisted-records", enumeration: "complete",
      receiptId: "fixture-read", knownAt: "2026-10-24T00:00:00.000Z",
      counts: { executions: 0, instruments: 0, importHistory: 0, legacyReviewRows: 0, recallDocuments: 0 },
      projectionGaps: [], payloadDigest: "",
    },
  };
  return bind(value);
}
function bind(value: HomepageStoredCollection): HomepageStoredCollection {
  return { ...value, receipt: { ...value.receipt, payloadDigest: `sha256:${createHash("sha256").update(encodeHomepageSourceBinding(value)).digest("hex")}` } };
}
type MalformedEnvelope = {
  bootstrap: Record<string, unknown>;
  recallSummaries: unknown;
  receipt: Record<string, unknown> & { counts: Record<string, unknown> };
};

describe("homepage source wire contract", () => {
  it("matches native SHA-256 with browser WebCrypto, Unicode and JSON optional field omission", async () => {
    const empty = fixture();
    empty.bootstrap.settings = { label: "已存证券 🧾", optional: undefined, signedZero: -0 };
    const value = bind(empty);
    const wire = JSON.parse(JSON.stringify(value));
    await expect(parseHomepageStoredCollection(wire)).resolves.toEqual(wire);
    const reversed = Object.fromEntries(Object.entries(value.bootstrap).reverse());
    expect(encodeHomepageSourceBinding({ ...value, bootstrap: reversed as HomepageStoredCollection["bootstrap"] })).toBe(encodeHomepageSourceBinding(value));
  });

  it("rejects a deleted array element even when its count is adjusted", async () => {
    const source = fixture();
    source.bootstrap.instruments.push({ id: "HK:700", market: "HK", symbol: "700", name: "A", currency: "HKD" });
    const bound = bind({ ...source, receipt: { ...source.receipt, counts: { ...source.receipt.counts, instruments: 1 } } });
    const missing = JSON.parse(JSON.stringify(bound));
    missing.bootstrap.instruments = [];
    await expect(parseHomepageStoredCollection(missing)).rejects.toThrow("Invalid homepage");
    missing.receipt.counts.instruments = 0;
    await expect(parseHomepageStoredCollection(missing)).rejects.toThrow("Invalid homepage");
  });

  it.each(["receiptId", "knownAt", "projectionGaps", "payload"])("rejects a detached or changed %s binding", async (field) => {
    const value = JSON.parse(JSON.stringify(fixture()));
    if (field === "receiptId") value.receipt.receiptId = "another-read";
    if (field === "knownAt") value.receipt.knownAt = "2026-10-23T00:00:00.000Z";
    if (field === "projectionGaps") value.receipt.projectionGaps.push("missing-import");
    if (field === "payload") value.bootstrap.settings.extra = "changed";
    await expect(parseHomepageStoredCollection(value)).rejects.toThrow("Invalid homepage");
  });

  it.each([
    ["policy", (value: MalformedEnvelope) => { value.receipt.policy = "future-v2"; }],
    ["enumeration", (value: MalformedEnvelope) => { value.receipt.enumeration = "partial"; }],
    ["finite count", (value: MalformedEnvelope) => { value.receipt.counts.executions = -1; }],
    ["count equality", (value: MalformedEnvelope) => { value.receipt.counts.instruments = 1; }],
    ["array shape", (value: MalformedEnvelope) => { value.bootstrap.executions = {}; }],
    ["element shape", (value: MalformedEnvelope) => { value.bootstrap.instruments = [{}]; value.receipt.counts.instruments = 1; }],
    ["recall shape", (value: MalformedEnvelope) => { value.recallSummaries = [{ episodeId: "episode", status: "completed", text: "", updatedAt: "x", snapshotCount: 0 }]; value.receipt.counts.recallDocuments = 1; }],
    ["extra completeness", (value: MalformedEnvelope) => { value.receipt.universeCoverage = "complete"; }],
    ["invalid clock", (value: MalformedEnvelope) => { value.receipt.knownAt = "2026-10-24T24:00:00.000Z"; }],
  ])("rejects %s even when the malformed response is freshly hashed", async (_label, mutate) => {
    const value = JSON.parse(JSON.stringify(fixture()));
    mutate(value);
    await expect(parseHomepageStoredCollection(bind(value))).rejects.toThrow("Invalid homepage");
  });

  it("rejects duplicate identities, unsupported values, sparse arrays and cycles", async () => {
    const value = fixture();
    const instrument = { id: "HK:700", market: "HK", symbol: "700", name: "A", currency: "HKD" };
    value.bootstrap.instruments = [instrument, instrument];
    await expect(parseHomepageStoredCollection(bind({ ...value, receipt: { ...value.receipt, counts: { ...value.receipt.counts, instruments: 2 } } }))).rejects.toThrow();
    for (const bad of [NaN, Infinity, new Date(), BigInt(1), new Array(1)]) {
      const source = fixture(); source.bootstrap.settings.bad = bad;
      expect(() => encodeHomepageSourceBinding(source)).toThrow();
    }
    const cyclic = fixture(); cyclic.bootstrap.settings.self = cyclic;
    await expect(parseHomepageStoredCollection(cyclic)).rejects.toThrow();
  });

  it("takes ownership before async hashing, so input mutation cannot change the accepted payload", async () => {
    const value = fixture();
    const pending = parseHomepageStoredCollection(value);
    value.bootstrap.settings.lateMutation = true;
    expect((await pending).bootstrap.settings).toEqual({});
  });

  it("does not treat a bootstrap response or an empty array as a receipt", async () => {
    await expect(parseHomepageStoredCollection(fixture().bootstrap)).rejects.toThrow();
    await expect(parseHomepageStoredCollection([])).rejects.toThrow();
  });
});

describe("homepage source HTTP read", () => {
  it("uses the dedicated no-store endpoint, forwards cancellation and verifies the returned envelope", async () => {
    const envelope = fixture();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope));
    const controller = new AbortController();
    await expect(createSqliteHttpClient(fetcher).getHomepageSource(controller.signal)).resolves.toEqual(envelope);
    expect(fetcher).toHaveBeenCalledWith("/api/storage/homepage-source", { cache: "no-store", signal: controller.signal });
  });
  it("rejects HTTP 200 with a malformed or mismatched body as invalid-response", async () => {
    const mismatched = fixture(); mismatched.bootstrap.settings.modified = true;
    for (const body of [{}, [], mismatched]) {
      await expect(createSqliteHttpClient(async () => Response.json(body)).getHomepageSource()).rejects.toMatchObject({ status: 200, code: "invalid-response" });
    }
  });
  it("preserves HTTP failure codes and never replaces failures with an empty collection", async () => {
    const response = Response.json({ error: { code: "homepage-source-unavailable", message: "Unavailable" } }, { status: 503 });
    await expect(createSqliteHttpClient(async () => response).getHomepageSource()).rejects.toMatchObject({ status: 503, code: "homepage-source-unavailable" });
    await expect(createSqliteHttpClient(async () => { throw new Error("aborted"); }).getHomepageSource()).rejects.toThrow("aborted");
  });
});
