# Signed contribution leaf — candidate 1

Prepared by /root/contribution_bars, actual gpt-6.1-sol / ultra, on2026-10-23 CST. This is a new controlled visual leaf. Root independent acceptance is pending (0/3). It does not integrate financial data or resolve A's frozen future-HKD FX contamination counterexample. P2/P4 financial integration remains BLOCKED; P4 formal0/3 is unchanged.

## Delivered boundary

Exactly three new product files: contribution-bars.tsx, contribution-bars.css, contribution-bars.test.tsx under app/components/homepage-v25/. Other authored files are confined to this bars evidence directory. No existing product/tests, A/B/F/S/ledger, host, shared tracker, config/dependency, service, browser, DB, network, child agent or commit was changed/used by this worker.

`ContributionBarsProps` is a readonly current/history discriminated contract. The caller supplies reportCurrency, readState, already-qualified ordered rows, fullTotal and onActivate. Current rows supply periodRealized/unrealizedChange/net; history rows supply closedResult only. The component never derives net, complete total or closed facts. It does not qualify, attribute, sort/filter/page, convert currency or request IO. Display additions only size same-sign stacks and establish one symmetric common visible-row scale. FullTotal is rendered independently of row geometry and page membership; a literal supplied net777 is retained despite100+100 segment inputs.

`ContributionIdentity` is either `{kind:"market",market}` or the complete instrument context `{kind:"instrument",accountId,instrumentId,market,nature,simulationRunId}`. Each row has stable key/label/accessibleLabel. Its native action passes the exact original identity reference. Every row and fullTotal have a separate native readout trigger; detail does not activate navigation. Transient selection stores source references as lifetime guards and never reads monetary facts from those references: financial fields are reread from current props on each render. One-way immutable rows/fullTotal/mode/currency replacement hides the old panel in the tested paths. The underlying selection is retained; its restoration risk below remains unresolved. No financial revision/FX/amount cache exists.

Known signed pieces are drawn independently even when net is unknown or zero. All rows share a50% zero and symmetric scale; same-sign pieces are contiguous, opposite signs use separate sides, both-negative pieces extend left. Solid realized/closed and hollow unrealized have equal14px visible outer height. Hollow uses inset shadow stroke with no minimum money width. Positive#53D7A0, negative#EF7F89. Cent rounding uses Decimal HALF_UP: values rounding to zero display neutral0.00 with no part, while exact original precision remains in detail. Currency mismatch displays—plus reason and preserves source target currency in detail. Unknown/invalid amounts display不可计算 with reasons, never fabricated zero. Full detail includes coverage, originalByCurrency and FX source/asOf/id/status.

Pending/error retain supplied committed rows and total with the supplied reason. Initial pending renders8neutral loading slots and no business rows/amounts. Empty/error without committed data preserve the list area and explain absence. No retry/repair CTA competes with the future host's unique global repair. No title/card/header/inset, mode selector, breadcrumb, toolbar or pagination was added.

## Approved responsive strategy and evidence limit

Root explicitly approved the reported local narrow two-line strategy before implementation: first line identity/action plus net; second line signed track with uniform50% zero. The available-container breakpoint is max735px (narrow),736px and above (desktop). It derives from the736px desktop identity/shape/amount/detail width budget. It preserves14px type/bar height, display precision, exact identities and information hierarchy. Desktop symbol pitch43px, market pitch70px; market list reserves3×70px, symbol list8×43px. Narrow symbol reserve8×64px, with native36px detail hits and44px coarse-pointer hits. Detail is a fixed264px outer box, padding12px, bounded by viewport gutters, wrap/scroll for long evidence.

Static CSS parsing verifies these declarations, scope, inherited host nowrap reset and no minimum segment width. Literal mocked1024×768 geometry verifies floating-panel clipping bounds when an anchor scrolls above/below the viewport; its input rects are synthetic, not actual browser measurements. Actual non-overflow at1440×1000/1280×800/390×844 and available-container735/736/737px is NOT VERIFIED. Root must record real rects,100% zoom,DPR, controls and reference screenshots. The worker did not use browser/service, and no rendered visual PASS is asserted.

## Verification and preserved failures

Pinned runtime: Nodev26.0.0, SQLite3.53.0, exact execPath in runtime.log. Only the new test file ran, with explicit maxWorkers1; no performance/full-suite/old test run.

| Evidence | Result |
| --- | --- |
| RED.log + RED-stub.tsx.txt + RED-input-sha256.json |17meaningful tests fail against typed null view; missing accessible behavior, no import error; exit1 |
| GREEN-attempt-1.log |17/17pass; exit0 |
| typecheck-attempt-1.log |FAIL preserved: matcher type entry missing from scoped invocation and helper widened current/history union; no component errors |
| RED-counterexamples.log |2failures: Escape after focus returns to trigger; unknown complete-total reason absent; exit1 |
| GREEN-attempt-2.log / typecheck-attempt-2.log / lint-attempt-2.log |21/21and strict types/lint pass |
| RED-position.log |1failure: scrolled-above anchor produced negative floating top(-356px), expected12px; exit1 |
| GREEN.log |22/22pass, including all3market actions+readouts and all8symbol actions+readouts; exit0 |
| typecheck.log |strict scoped tsc of both new TSX files; exit0 |
| lint.log |scoped eslint of both new TSX files; exit0 |
| style-audit.log |postcss/jsdom declaration audit; exit0; actual browser layout NOT VERIFIED |

Every verification log contains exact command, stdout, stderr and inner exit code. The final test has the existing toolchain NodeDEP0205 module.register deprecation message in stderr; no test assertion/React error remains. No suppression or dependency change was made.

## Remaining gates

Root flagged a candidate lifetime concern before freeze: the identity guard only masks retained selection. Restoring CNY after CNY→USD→CNY with the original rows/fullTotal references may reopen the old detail without a new trigger. The current tests cover one-way replacement, not restoration. Per root's explicit instruction, this candidate is frozen without adding a counterexample or fix; root will independently reproduce and rule on it in formal round1. This concern is unresolved and the22 existing passing assertions do not cover or clear it.

Synthetic function/state evidence passes for the tested consumer paths. CB15 responsive geometry remains actual-browser NOT VERIFIED despite static declarations; CONTROL-STATE-MATRIX.md preserves each distinction. Real mouse, real keyboard, emulated touch and physical touch all have worker numerator0. Reference originals were all directly viewed (9faithful renders retained), but no component/reference screenshot comparison was done. Root owns integration, actual market drill/instrument navigation, return/reload and full financial/persistence flow. Leaf DB writes are NOT APPLICABLE because no IO exists; this does not waive feature persistence gates. No feature/UI delivery/100% acceptance or preview URL is claimed.

SELF-REVIEW.md records the worker's scoped review. NEW-FILES.patch is the complete addition diff; PRODUCT-SHA256SUMS pins the3product files; SHA256SUMS pins the evidence and references. IMPLEMENTATION-READY.md marks the freeze. After that marker, this worker stops all writes pending root's independent ruling.
