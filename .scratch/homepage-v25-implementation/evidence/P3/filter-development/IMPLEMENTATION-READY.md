# P3 attachment filter preparation — implementation-ready only

Owner `/root/filter_preparation`, actual model gpt-6.1-sol / ultra. This report is limited to the dispatch's new-file slice. **P3 formal 0/3. Four-zone attachment integration NOT VERIFIED.** Root's independent functional, visual and persistence acceptance remains required. No browser, service, DB, existing homepage/host/session/S/F/ledger/config/metadata/storage file, tracker, commit or subagent work was performed by this worker.

## Authored files and exact references

- `app/components/homepage-v25/attachment-filter.tsx` — controlled editor; S v3 is the sole draft/applied authority.
- `app/components/homepage-v25/attachment-filter.css` — scoped standalone panel styles, no shared CSS changes.
- `app/components/homepage-v25/attachment-groups.ts` — pure composite group qualification and original source lineage.
- Two adjacent new test files; all other authored artifacts are in this evidence directory.

`INPUT-MANIFEST.json` freezes the original approved spec, manual, binding workflow/dispatch/state references, existing interface sources, original nine SVGs and directly viewed nine PNGs before implementation. `DESIGN-COVERAGE.md` records requirement IDs, HOME-HP03-B044 (the original has no elementID), journeys, owners, exact image states, dimensions, palette and root adjudications. `OUTPUT-MANIFEST.json` freezes the five new product/test files and final evidence hashes after validation. Reference PNGs are design readback, never runtime evidence.

## Validation and preserved failures

| Check | Result | Evidence |
| --- | --- | --- |
| Feature-absent bootstrap | expected missing-import failure | `01-missing-feature-red.log`; not counted as behavioral RED |
| Interface-stub RED | 15 failed | `02-behavior-red.log`; later exposed fixture lookup mismatch because the real summary builder canonicalizes summary IDs; corrected fixture to locate actual episode identity |
| First implementation | 12 passed / 3 fixture failures | `03-first-implementation.log`; no product workaround for the canonical summary identity |
| Baseline behavior | 15 passed | `04-focused-green.log` |
| Pending disabled-field focus counterexample | 1 failed / 6 passed | `05-pending-focus-red.log` |
| Pending focus fix | 15 passed | `06-final-focused-green.log` |
| Scoped TypeScript first run | failed on unsupported testing-library `exact` options | `08-scoped-typecheck.log`; removed redundant options (role name strings match exactly by default) |
| Final focused Vitest | **15/15 PASS**, 2 files | `09-final-focused-tests.log`, Node 26 wrapper, maxWorkers=1 |
| Final scoped TypeScript | **PASS**, exit 0 | `10-final-scoped-typecheck.log`, `typecheck.config.json`; only new TS/TSX tests/modules plus test setup and their imported dependencies |
| Final scoped ESLint | **PASS**, exit 0, no warnings | `11-final-focused-eslint.log`; four new TS/TSX files |

No full suite, build, financial/performance measurement or browser run was authorized in this slice. Tests use real S v3 operations and real library episode construction; request completion buttons are test-owned callbacks, not real reads/persistence. Empty final lint/type logs mean exit 0; see the output manifest result metadata. The existing dependency deprecation warning is preserved in Vitest output.

## Local control inventory, version bound to output manifest

| Local element/journey | Synthetic method / result | Real browser / independent gate |
| --- | --- | --- |
| category-stock, category-etf | checkbox draft editing, S C unchanged: PASS | NOT VERIFIED |
| category-fund | disabled with reason; restored unsupported categories visible/preserved: PASS | NOT VERIFIED |
| open-only | controlled S draft and successful apply: PASS | NOT VERIFIED |
| pending-yes, pending-no | separate checked state, stable false/true normalization: PASS | NOT VERIFIED |
| apply | Enter/click, pending lock, old C, failure/error, successful S commit: PASS | NOT VERIFIED |
| clear | separate callback, attachments only after success, market/accounts/period retained: PASS | NOT VERIFIED |
| defaults | separate callback, all market/accounts after success, period retained: PASS | NOT VERIFIED |
| Esc/outside/reopen | cancels S token, preserves D/C, exact trigger focus: PASS | NOT VERIFIED |
| identity discard | real S identity transition closes and discards draft in harness: PASS | NOT VERIFIED |
| Tab/ShiftTab and opening focus | local boundary cycle and first field: PASS | NOT VERIFIED |
| pending focus and error | focus moves to editor while controls disabled; no local retry/repair: PASS | NOT VERIFIED |
| 320px geometry, animation/reduced motion, overlay collision, long contents, viewport boundaries | source styles only, no rendered evidence | NOT VERIFIED |
| mouse / keyboard / emulated touch / physical touch | synthetic events only; not equivalent to any real-input acceptance | NOT VERIFIED for each |

## Controlled component usage

The host owns `open`, S state, request execution and accepted data. Mount the panel in a relatively positioned anchor beside its exact filter trigger. The panel is absolutely positioned, width 320px with a narrow viewport bound and its own overflow; it does not reuse the search overlay/stage. Local state is limited to DOM refs, presence transition and focus. It consumes no business data and never commits C or closes on a successful callback by itself.

```tsx
<div style={{ position: "relative" }}>
  <button ref={filterTrigger} aria-haspopup="dialog" aria-expanded={filterOpen}
    onClick={() => setFilterOpen(true)}>筛选</button>
  <AttachmentFilterPopover
    open={filterOpen}
    draft={ui.draft.attachments}
    pending={ui.requests.global !== null}
    error={ui.errors.global}
    triggerRef={filterTrigger}
    onDraft={attachments => setUi(s => editHomepageDraft(s, { ...s.draft, attachments }))}
    onApply={() => setUi(s => beginHomepageRead(s, { purpose: "apply" }))}
    onClear={() => setUi(s => beginHomepageRead(clearHomepageAttachments(s), { purpose: "apply" }))}
    onReset={() => setUi(s => beginHomepageRead(resetHomepageDefaults(s), { purpose: "apply" }))}
    onCancel={() => {
      setUi(s => cancelHomepageDraft(s));
      setFilterOpen(false);
    }}
  />
</div>
```

This example illustrates S callback ownership; it is not a replacement for the existing host's read executor. The host must stage a complete target bundle from `token.target`, validate generation + scopeKey, then atomically accept S and owned business/metadata/quote/FX data together. Close `open` only after accepted apply/clear/reset success. Failure keeps C + bundle + D and shows the supplied explicit error. Esc/outside cancels ownership; late results cannot commit. Identity changes call the accepted S identity flow and close the panel; automatic refresh uses C and retains D. Global repair stays the existing single entry point. No fetch, retry, persistence or state owner is embedded here.

## Composite qualification usage

The adapter input `current` is a structural subset of `HomepageV25Performance`'s boundary + instruments. For accepted `CurrentProjection`, wrap its existing `asOf` without recomputing quantities. Source/metadata/episode coverage/current must belong to one owned bundle. `episodeCoverage` is a required explicit per-composite-group completeness attestation for that same asOf, not a guess from “no episodes.”

```ts
// target is token.target during a staged read, or the accepted C scope and
// attachments for accepted rendering. Never use unsubmitted D as applied data.
const qualified = qualifyHomepageAttachmentGroups({
  entries: ownedEntries,
  scope: target,
  attachments: target.attachments,
  asOf: canonicalCurrent.asOf,
  current: {
    boundary: { asOf: canonicalCurrent.asOf },
    instruments: canonicalCurrent.instruments,
  },
  instrumentMetadata: trustedMetadata,
  episodeCoverage, // key: homepageAttachmentGroupKey(identity)
});

const selectedCompositeKeys = new Set(qualified.eligibleGroups.map(group => group.key));
// Connect the same strict composite selection to all four zones. Keep original
// source carrier references from group.sources, executions and episodes.
```

Each group key encodes account + full instrument ID + explicit nature + simulation run in a JSON tuple. Homepage scope admits explicit live only, applied market/account/symbol identity, while retaining complete history regardless of displayed period. Within a dimension choices are OR; category/open/pending dimensions are AND. An open group means known nonzero canonical quantity, including zero UF and missing quote cases. Missing/stale/invalid/conflicting quantity remains null + reasons. Pending uses the existing `reviewState`: any applicable pending episode is true; complete applicable evidence with only completed/deferred is false; incomplete/missing/invalid evidence is unknown. Empty and double pending choices are unrestricted predicates but remain distinct UI drafts. Asset type requires validated metadata; absent/unsupported/mismatched metadata stays unknown, never stock by default.

Outputs contain original execution and episode objects, including all attached fee/statement/position/IPO evidence. The adapter computes no finance amounts or episode outcomes and does not regenerate episodes. **Do not independently filter account IDs and instrument IDs**, which would admit cartesian combinations. **Do not use `sources[].entry` aggregate PnL/count/status fields as filtered metrics**: that property is original lineage and may include other account groups. Root must connect selected composite sources to accepted canonical finance/read models and four-zone presentation. Full history retained here does not authorize a consumer to disclose future records; downstream canonical cutoff policy remains authoritative.

## Required subsequent root work

1. Accept the P2 data/projection prerequisite, then explicitly release existing homepage/host wiring. The present slice does not resolve the P2 cold three-market 2.62s failure.
2. Wire one S draft/applied/request authority and one accepted data bundle; scope all four zones by the same qualified composites, preserving original history/evidence. Provide truthful per-group episode completeness and current same-asOf evidence.
3. Prove real apply/clear/reset, failure/timeout/cancel/late-result, refresh preserving D, identity discard, tokens, return/reload and actual persistence in an isolated DB. Preserve P3's full counterexample inventory and historical failures.
4. Independently compare real rendered reference states at the approved viewports/DPR, including the root's open 390×844 header/account/sidebar layout findings. This worker did not change existing CSS or repair those findings.
5. Complete mouse, keyboard, emulated touch and physical touch evidence distinctly; inspect long/error/unsupported states and reduced motion. Keep all required NOT VERIFIED/FAIL gates explicit until evidence exists.

This preparation is ready for root review and later integration. It is not a completed UI delivery and supplies no preview URL because this slice expressly excluded service/browser work. Root must keep a fresh verified preview running when the integrated UI is delivered.
