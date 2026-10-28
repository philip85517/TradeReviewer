import { describe, expect, it } from "vitest";
import { parseTradeCommitReceipt, parseTradePlan } from "./trade-change-response";

const legacy = () => ({ planId: "p", policy: "trade-changes-v1", baseVersion: { databaseId: "test", epoch: "epoch", sequence: 0 }, createdAt: "2026-10-27T00:00:00.000Z", expiresAt: "2026-10-27T00:15:00.000Z", kind: "import", summary: { candidateCount: 1, inputDigest: "digest", changes: [] }, diagnostics: [], conflicts: [], missingExecutions: [], reactivateExecutionIds: [] });
const outcome = () => ({ policy: "tv-import-v1", facts: { accepted: 0, duplicate: 1, conflict: 0 }, identity: { kind: "unchanged" }, material: { kind: "normalized-only", reason: "legacy-no-decoded-observations" } });
const scope = () => ({ accountId: "A", instrumentId: "CN-SH:600330", market: "CN-SH", currency: "CNY", nature: "simulation", rawRun: { kind: "present", raw: "tradingview:fp:CN-SH:600330" } });
const group = () => ({ id: "g", kind: "unproven-source-declaration", incomingIds: ["candidate"], existingIds: ["stored"], incomingScopes: [scope()], existingScopes: [scope()], locator: { kind: "tv-source-slot-v1", fileFingerprint: "fp", market: "CN-SH", symbol: "600330", sourceTradeId: "1", role: "entry" }, reasons: ["account"], allowed: ["keep-independent"] });
const ready = () => ({ ...legacy(), reviewContract: "trade-review-v2", status: "ready", identityReviews: [], tvImportGuard: { policy: "tv-compat-v1" }, summary: { ...legacy().summary, tradingViewImport: outcome() } });
const review = () => ({ ...ready(), status: "review-required", identityReviews: [group()] });

describe("trade review response compatibility", () => {
  it("validates strict v2 ready and review-required plans without accepting partial or contradictory v2 states", () => {
    expect(parseTradePlan(ready(), "import")).toEqual(ready());
    expect(parseTradePlan(review(), "import")).toEqual(review());
    const invalid = [
      { ...ready(), reviewContract: "unknown" }, { ...ready(), status: undefined }, { ...ready(), status: "unknown" },
      { ...ready(), identityReviews: [group()] }, { ...review(), identityReviews: [] },
      { ...review(), summary: { ...review().summary, changes: [{ kind: "add", executionId: "x" }] } },
      { ...review(), conflicts: [{ id: "c", candidateKey: "c", existing: [], incoming: [], allowed: ["keep-existing"] }] },
      ...["", "candidate"].map(id => ({ ...review(), identityReviews: [{ ...group(), incomingIds: [id, id] }] })),
      { ...review(), identityReviews: [group(), group()] },
      { ...review(), identityReviews: [{ ...group(), incomingScopes: [] }] },
      ...[
        { incomingScopes: [{ ...scope(), nature: "invalid" }] },
        { incomingScopes: [{ ...scope(), rawRun: { kind: "absent", raw: "must-not-exist" } }] },
        { locator: { kind: "unknown" } }, { reasons: ["unknown"] }, { allowed: ["use-incoming"] },
      ].map(patch => ({ ...review(), identityReviews: [{ ...group(), ...patch }] })),
      { ...ready(), summary: { ...ready().summary, tradingViewImport: {} } },
    ];
    for (const value of invalid) expect(() => parseTradePlan(value, "import")).toThrow();
  });
  it("separates legacy non-TV and maintenance DTO compatibility from strict v2 validation", () => {
    expect(parseTradePlan(legacy(), "import", {retainedEvidence:true})).toEqual(legacy());
    for (const kind of ["revision", "material", "tradingview-account-migration", "tradingview-account-migration-rollback"] as const) {
      const value = { ...legacy(), kind };
      expect(parseTradePlan(value, kind)).toEqual(value);
    }
    expect(parseTradePlan({ ...legacy(), reviewContract: "trade-review-v2", status: "ready", identityReviews: [] }, "import", {retainedEvidence:true}).status).toBe("ready");
    for (const patch of [{ reviewContract: "trade-review-v2" }, { status: "ready" }, { tvImportGuard: { policy: "tv-compat-v1" } }]) {
      expect(() => parseTradePlan({ ...legacy(), ...patch }, "import")).toThrow();
    }
    expect(() => parseTradePlan(legacy(), "revision")).toThrow();
  });
  it("reads legacy successful receipts and validates every present TV outcome", () => {
    const receipt = { receiptId: "r", planId: "p", policy: "trade-changes-v1", committedAt: legacy().createdAt, bookVersion: legacy().baseVersion, result: { report: { inserted: 0, duplicate: 1, conflict: 0 }, appliedChanges: [] } };
    expect(parseTradeCommitReceipt(receipt, "p")).toEqual(receipt);
    const outcomes = [outcome(), { ...outcome(), material: { kind: "reuse-exact", materialId: "m", versionId: "v", semanticDigest: "d" } }, { ...outcome(), identity: { kind: "kept-independent", bindings: [{ candidateId: "c", factId: "f" }], resolvedFrom: { reviewPlanId: "parent", inputDigest: "d", candidateIds: ["c"] } }, material: { kind: "save-evidence", materialId: "m", versionId: "v", semanticDigest: "d", reason: "first-evidence", observations: 2, links: 2 } }];
    for (const tradingViewImport of outcomes) expect(parseTradeCommitReceipt({ ...receipt, result: { ...receipt.result, tradingViewImport } }).result.tradingViewImport).toEqual(tradingViewImport);
    for (const tradingViewImport of [{}, { ...outcome(), facts: { accepted: -1, duplicate: 0, conflict: 0 } }, { ...outcome(), material: { kind: "save-evidence" } }, { ...outcomes[2], identity: { kind: "kept-independent", bindings: [], resolvedFrom: {} } }]) expect(() => parseTradeCommitReceipt({ ...receipt, result: { ...receipt.result, tradingViewImport } })).toThrow();
    expect(() => parseTradeCommitReceipt(receipt, "another-plan")).toThrow();
  });
});
