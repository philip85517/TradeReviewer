# Controlled performance-chart leaf — independent code review, candidate 1

- Reviewer: `/root/chart_review`, actual model `gpt-6.1-sol / ultra`; did not implement the reviewed component. No subagents dispatched.
- Time: 2026-10-23 06:47 Asia/Shanghai (2026-10-22 22:47 UTC).
- Worktree: `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`; detached HEAD. Base and head both `5a94ee3ff76e32993fe2c4791a83b40e877a7344`.
- Trigger: independent review of frontend interaction/layout implementation, so the frontend control audit workflow applies. This is a local leaf code review plus a synthetic component counterexample, not browser or feature acceptance.
- Product scope: exactly `app/components/homepage-v25/performance-chart.tsx`, `performance-chart.css`, and `performance-chart.test.tsx`. All three are new/untracked and were read directly, rather than relying on an empty commit diff.
- Version: [manifest.json](manifest.json). All three SHA-256 hashes match `../source-freeze.json` before and after this review. Existing unrelated work was preserved.
- Only writes: new evidence files in this `independent-review/` directory. No product/test expectation/configuration/dependency/service/DB/browser/network changes; no original 29-test or full-suite rerun.
- Integrated acceptance owner: `/root`. This report does not advance P2 formal 0/3 or release page integration, A performance, or P4 gates.

## Result

**Critical: 0. Important: 1. Minor: 0. Leaf ready for acceptance: No, with the interaction fix below.**

The implementation reads the six historical metrics directly from the selected controlled point, validates currency authority per metric, distinguishes zero from unknown, and blanks future/loading/error readouts. It never falls back to `current`. Plot geometry is separate from display amounts. Gap partitioning, valid-point keyboard navigation, controlled-key reset, timer cleanup, measured natural tooltip placement, and the authorized normal-flow fallback are implemented explicitly.

The finding is an input-mode interaction defect, not evidence of historical amount corruption. Remaining browser timing and visual requirements are not satisfied by this review.

## Important finding

### CH-IR-01 — Point mouse-leave removes the tooltip while a detail value still has keyboard focus

- Severity: **Important / P2**; classification: wrong interaction state / implementation fault.
- Code: `performance-chart.tsx:351–355` (`leave`), called unconditionally by the point hotspot at `:440`.
- Counterpart: the detail's own mouse-leave handler at `:476` already protects focus within `detailRef`; point leave has no equivalent check, and its timer callback unconditionally hides detail and clears selection.
- Contract: approved `visual-design.candidate.md:239` requires immediate keyboard-focus details and says Esc closes and returns focus. `component-manual.html:905–911` defines focus exit through Tab leaving, activation, or Esc. `CONTROL-STATE-MAP.md` registers focusable amount/source controls. Hiding an unpinned tooltip while its descendant remains focused defeats that source-reading journey; a mouse movement is not keyboard focus leaving.
- Trigger:
  1. Hover an eligible date and wait 300ms for detail.
  2. Focus the chart, then focus a detail amount (`dd[tabindex=0]`); its source evidence is open and the amount owns actual DOM focus.
  3. Move the pointer out of the original point hotspot while the keyboard focus stays on that amount.
  4. Advance 100ms.
- Expected: detail and the focused amount remain until focus actually leaves the chart/detail or the user closes it.
- Actual in the independently rendered component: `queryByRole("tooltip")` becomes `null`; the focused detail subtree is unmounted. The matching control case—leaving the detail itself with the same focused amount—keeps it open.
- Impact: a user combining keyboard navigation with incidental mouse movement loses the amount/source reading location and its focus node. This affects all valid-date hotspots, and the same common `leave` helper is also used by gap hotspots.
- Evidence: [mixed-input.counterexample.test.tsx](mixed-input.counterexample.test.tsx), especially the two side-by-side cases at lines 48–67; [mixed-input.counterexample.log](mixed-input.counterexample.log). This is actual-component synthetic event evidence, **not** physical mouse or browser timing evidence.
- Suggested repair: make the shared leave/close path respect current keyboard focus within the graph/detail and cancel queued pointer-hide work when focus enters a reading control. Preserve normal 100ms pointer-only closing, pinning, Esc suppression, and focus-out closing. Re-run this counterexample plus affected owner checks; root must still independently verify the resulting journey.
- Owner: component implementation owner, coordinated and accepted by `/root`.
- State: **FAIL**, sent to root immediately after confirmation. No repair made by reviewer.

## Independent command and observed outcome

```text
./scripts/native-node.sh .scratch/homepage-v25-implementation/evidence/P2/chart/independent-review/run-counterexample.mjs > .scratch/homepage-v25-implementation/evidence/P2/chart/independent-review/mixed-input.counterexample.log 2>&1
```

- Exit: **1**; exactly one independent file collected, **2 tests: 1 FAIL / 1 PASS**.
- FAIL: point leave removes keyboard-focused detail after 100ms.
- PASS: detail leave retains the same keyboard-focused detail.
- Native Node bootstrap was used. Existing `[DEP0205] module.register()` warning was emitted; no unhandled test error accompanied it.
- `run-counterexample.mjs` passes an in-memory include override to the existing Vitest configuration. No repository configuration was written or changed. It does not import the original test file.
- The prior worker/root 29/29 result was read as context and was not repeated or represented as this reviewer's result.
- Initial `shasum` inspection failed due the existing `C.UTF-8` locale error. Node `createHash("sha256")` then successfully produced all three hashes and the saved manifest; no product file changed.

## Version-bound review inventory and evidence boundaries

Inventory uses candidate-1 `CONTROL-STATE-MAP.md`; date hotspots are every eligible `point.key`, gap controls are every contiguous unavailable state/date run, and amount/source controls are six per shown detail. The independent counterexample uses literal dates 2026-10-01 and 2026-10-02, report currency CNY, no builder/current/DB dependency. It exercises the second date. It is not a real-operation coverage sample or a claim to cover all dynamic date instances.

| Control/state | Review performed | Result / evidence boundary |
| --- | --- | --- |
| CH-DEFAULT / all plotted dates | Read path construction, singleton segments, marker/axis rendering and CSS | No additional confirmed code defect; rendered visibility remains root-owned |
| CH-HOVER / CH-FOCUS / CH-ORIGINAL | Read show/hide timers, focus transitions, source controls; independently combined pointer leave with focused source amount | **FAIL CH-IR-01**; synthetic input only |
| CH-PIN / Esc / reentry | Read explicit pin, suppression, focus return and valid-point key handlers; inspected original test scenarios | No additional confirmed code defect; no independent real keyboard claim |
| CH-DISABLED / CH-LOADING / CH-ERROR | Read controlled overrides and render guards, including wrapper generation key and cleanup | No stale-success-value path found within frozen input contract |
| CH-EMPTY / CH-REASON / CH-FUTURE | Read gap aggregation, reason access, future blanking and future exclusion from geometry | No future-value leak or invented missing zero found within frozen input contract |
| Historical six fields / currency authority | Read all six `readAmount` call sites, raw formatting, source strings and same-key controlled recomputation | No current-to-history substitution or currency relabel found |
| Geometry / natural-flow fallback | Read zero domain, at-most-seven ticks, segment splitting, collision test and measured normal-flow positioning | No additional confirmed code defect; geometry/code reading does not prove actual layout or visual fidelity |

Real input coverage in **this review**: 0 real browser actions. Mouse, keyboard, emulated touch, and physical touch are all **NOT VERIFIED** here; synthetic events do not enter their coverage numerator. The root's separate browser evidence is not duplicated or promoted by this report. Actual 300ms hover / 100ms leave timing remains **NOT VERIFIED** as directed. No viewport, DPR, zoom, scroll-offset, service or preview claim is made because browser/service operations were prohibited for this reviewer.

| Acceptance gate | This review's conclusion | Reason / owner |
| --- | --- | --- |
| Leaf functional correctness | **FAIL** | Confirmed mixed-input close/focus counterexample; implementation owner + root |
| Page end-to-end / integrated state chain | **NOT VERIFIED** | Not connected or exercised in this read-only leaf scope; root |
| Independent visual fidelity, 1440/1280/390, flow/next module | **NOT VERIFIED** | No product screenshots/browser comparison performed; root |
| Leaf DB write persistence / original data mutation | **NOT APPLICABLE** | Leaf has no IO, storage, callbacks or business writes; reviewer used no DB |
| A performance / P2 / P4 | Unchanged | Outside this review; all prior FAIL/NV retained |

## References read and comparison limits

Read AGENTS, current development workflow, frontend audit, task decomposition, UI task/acceptance templates, issue tracker, requesting-code-review skill and reviewer template. Read `ROOT-DISPATCH.md`, `CONTROL-STATE-MAP.md`, `source-freeze.json`, candidate-1 report, source `visual-design.candidate.md:223–249` and `component-manual.html:872–959`. Read B types and selected producer code only to understand display authority, not to approve B's financial calculations.

Directly inspected original-derived hover, keyboard, gap, scale/normal/wide/extreme, and tooltip atom reference PNGs. Updated prose controls natural height, complete precision and default hidden dots, and the root-authorized fallback is honored. Looking at these reference images without matching product renderings is not visual acceptance.

## Declined to judge

- Homepage host wiring, complete financial atomic updates, contribution/navigation/persistence: explicitly outside the three-file leaf scope; their absence is not a leaf defect.
- A/F/S/B financial calculation and performance correctness: only interface/authority context was read; this review does not audit or release those owners' gates.
- Real hover/leave timing, physical/emulated touch, screen reader runtime behavior, responsive pixel layout and next-module placement: prohibited tools / no corresponding execution evidence; remain **NOT VERIFIED**, not PASS.
- Whether a default singleton `M`-only segment should expose a permanent dot: current prose forbids default persistent dots, while a single point cannot form a line. The code is noted, but without a resolved visible-singleton contract/render comparison this is not raised as a confirmed implementation fault.
- The accepted normal-flow fallback itself: root explicitly authorized it; not relabeled as a design regression by this reviewer.

The independent review is complete for this frozen candidate. Stop writes after this report; root owns remediation dispatch and acceptance.
