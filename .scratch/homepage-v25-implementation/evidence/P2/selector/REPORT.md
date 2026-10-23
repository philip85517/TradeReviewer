# Period selector: isolated candidate handoff

2026-10-23. `/root/financial_sharing`, gpt-6.1-sol / ultra. This candidate is prepared for root's independent review. It is not an accepted homepage delivery. P2 remains0/3; all earlier FAIL and NOT VERIFIED, including the unchanged exact multimarket cold performance FAIL, remain in force.

Only three new product/test files exist in this task:

| File | Purpose | SHA256 |
| --- | --- | --- |
| `app/components/homepage-v25/period-selector.tsx` | Fully controlled independent leaf | 7dd84cd1c3523855efa754be356c37aaa91afc638012b821bb10df084d9a12da |
| `app/components/homepage-v25/period-selector.css` | Namespaced original geometry, responsive layout, eight-state styling | a5206ab1f6640fd2957194d443d7718670b423b578639da09501665e4dac9989 |
| `app/components/homepage-v25/period-selector.test.tsx` | Real leaf, controlled caller fixtures,30 targeted cases | 193520ba99a46fb258323555f413cb88d9a08a839662cb4c5b324d8dc537e46c |

Other writes are exclusively this `evidence/P2/selector/` subtree. No existing product/test/configuration/shared tracker, Surface, host, Workspace, financial/performance/state source or database was edited. No service, browser, DB, performance/profile, full suite, subagent or Git mutation was used.

## Interface and ownership

`PeriodSelectorProps` is exported at `period-selector.tsx:10`. `HomepagePeriod` is imported type-only from existing S. The public surface is:

```ts
type PeriodDraft = { from: string; to: string };
type PeriodSelectorProps = {
  applied: HomepagePeriod;
  draft: PeriodDraft;
  open: boolean;
  pending: boolean;
  error: string | null;
  today: string;                    // Shanghai civil YYYY-MM-DD, caller-converted
  allRange: PeriodDraft | null;      // actual caller-supplied all boundary, or unavailable
  onDraftChange: (draft: PeriodDraft) => void;
  onOpenChange: (open: boolean) => void;
  onApply: (period: HomepagePeriod) => void;
};
```

The only internal state is the shortcut's roving focus index; refs track focus and open transitions. Applied period, draft, visibility, request waiting and errors belong to the caller. There is no request function, money, clock read, local timezone operation, storage, fetch, or implicit abort. `Date` receives only an explicit validated civil-date string with UTC suffix, and only UTC calendar methods derive a Monday. Preset values remain original S `ytd` / `month` / `week` / `custom`; `all` remains an externally supplied applied mode, without an invented shortcut or inferred dates.

Caller obligations for later authorized wiring:

- Supply Shanghai `today` and actual `allRange`; the leaf does not convert trade timestamps or discover earliest trades.
- Own draft initialization and any explicit scope-change discard. Opening/closing merely reports visibility; cancellation preserves current caller draft.
- On an apply event, publish pending promptly and own generation/late-result handling. The leaf suppresses activation while the controlled pending prop is true. It does not create a second hidden request lifecycle.
- Publish the successful `applied` period together with the complete matching data bundle, and close with `open=false` if desired. The leaf never changes the applied label after a callback alone.
- Closing while pending only dismisses the editor. Pending remains readable outside the closed editor and the parent still publishes the in-flight result. No cancel callback is sent to a request owner.

## Design and focus

The contract was registered before tests/implementation in `visual-contract.md`, with original-prose/manual/SVG/PNG hashes. The original1100×1100 plate was directly viewed; it is not treated as a CSS viewport. No design deviation is authorized.

Source mapping: HV25-17/18 / HOME-HP02-B020, original HP02 lines210–221; component manual alignment107 / SegmentedTabs196–282 / Popover370–455 / FilterPopover456–510. Quick order is the plate's 本年、本月、本周. Quick buttons68×36, date trigger216×36, absolute popover480px/20px padding, two desktop fields200×36, Apply88×36;14px centered button text and left-aligned date values. Same-year trigger text shortens only the end year as the original does; its accessible name/title always contains both full dates. Errors remain text and field-associated semantics, preserving the plate's ordinary field border. CSS status spacing is locally scoped so the existing homepage paragraph reset will not collapse it when integration is later authorized.

The popover has natural height and wraps long error text. Below510px CSS viewport, fields stack; the overlay width is capped at `100vw - 48px` to allow minimum24px gutters. Root must still compare1440×1000,1280×800,390×844 and either side of510px, with actual caller placement. None of these geometries has been observed in a browser. No fixed error-height slot or clipped field is introduced.

Opening focuses the first available dialog control (start field in editable state; pending status when fields are disabled). Tab follows fields, applicable readable feedback, enabled Apply and Cancel, then cycles into the dialog. Shift+Tab from the first available control goes to the date trigger; its next Tab reenters. Escape, Cancel and outside pointer report close without applying; the controlled close restores trigger focus. Outside pointer prevents the browser's default focus move so this dismissal can restore the entry. The dialog remains nonmodal; no `aria-modal`, global search overlay or inert page is claimed. Native Enter/Space activate buttons, shortcut arrows/Home/End only move focus. Pending shortcuts remain keyboard-readable and suppress activation.

## RED and verification evidence

The initial test file existed before product code. `red-missing-component.log` records missing import setup, which is **not** counted as behavioral RED. An importable inert scaffold then rendered 本年 as unselected: `red-behavior.log` records PS01 failing at the real `aria-pressed` assertion, expected true/received false. That command selected PS01 only:1 FAIL,27 skipped. The scaffold was replaced with one coherent implementation candidate; there was no alternate design/performance variant. All initial28 tests then passed in `green-attempt-1.log`. Two additional tests document the parent's pending-close clarification and immutable caller draft boundary, bringing the final total to30. No existing assertion was changed or removed.

| Check | Evidence | Result / scope |
| --- | --- | --- |
| Targeted function | `green-final.log` | 30/30 PASS, one new component file only; jsdom synthetic input |
| TypeScript | `typecheck.log`, `tsconfig.selector.json` | exit0, no diagnostics; exact new TSX/test entrypoints and their type dependencies, no emit/incremental cache |
| ESLint | `lint.log` | exit0, no diagnostics; exact new TSX/test only |
| CSS syntax | `css-parse.log` | Existing PostCSS parser accepted32 rules; not layout verification |
| Final file identities | `freeze.json` | Source SHA/bytes plus evidence status and reproduction commands |

The final test run at05:45:26 (runtime local clock) completed in4.54s with30 PASS. Vitest printed the existing Node26 `module.register()` deprecation warning; no test failure. The final CSS-only static review restored the reference's normal error-field border and scoped paragraph spacing; it did not change TSX/test hashes or their verified behavior. CSS parsing was run after that change. TypeScript and lint logs are intentionally empty because there were no diagnostics; command exit0 was observed directly.

| Cases | Break caught / independent expectation |
| --- | --- |
| PS01–03 | Using draft as applied, internally opening/committing, missing controlled draft/apply boundary |
| PS04–05 (7 cases) | Reversed/empty/impossible/wrong-format dates reaching apply; error attached to wrong field;1900 incorrectly treated as leap |
| PS06 | Rejecting future custom dates or valid Gregorian leap-century2000 |
| PS07 | Optimistic new label during pending/failure, lost draft, duplicate pending apply, failed retry or absent controlled success/focus |
| PS08 (3) | Cancel/Escape/outside applying or discarding draft, lost trigger focus |
| PS09–10 | Inaccessible dialog boundary, arrow/Home/End applying, Enter/Space applying wrong focused preset |
| PS11 (6) | Wrong inclusive Monday/month/year boundaries: Monday, Sunday, year-crossing week, leap-year week/month/year; all expected dates are literal |
| PS12–13 | Ambient UTC/local clock leaking into Shanghai-date requests; inferred all range; wrong preset selected for all |
| PS14–16 | Invalid today emitting shortcut, pending Enter/Space emitting another request, form Enter navigating or selecting a shortcut |
| PS17–18 | Closing pending silently canceling its state, caller unable to publish result, mutating caller draft or committing an end-field edit |

Exact reproduction commands from repository root (pinned Node26 / SQLite runtime; these commands themselves do not use SQLite):

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/period-selector.test.tsx --maxWorkers=1
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P2/selector/tsconfig.selector.json
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/components/homepage-v25/period-selector.tsx app/components/homepage-v25/period-selector.test.tsx
```

## Control inventory and acceptance limits

The local control audit is triggered by frontend-control development. `visual-contract.md` registers8 action controls plus1 dynamic feedback item,9×8=72 original state cells,9 reasoned N/A cells,63 applicable registrations. The shortcuts are three distinct instances; empty/loading/error are separate cases. Normal/selected/expanded are represented; ambiguous entity identity is N/A because no entity result choice exists; long feedback is supported by natural wrapping but rendered long-text geometry is NOT VERIFIED.

| Gate / input mode | Current result | What it does not prove / next owner |
| --- | --- | --- |
| Targeted component function | PASS30/30, bounded worker evidence | No route/host integration or real pointer/keyboard proof; root independently reruns/reviews |
| Real browser control execution/click | NOT VERIFIED:0/8 actions executed | Browser forbidden in this task; root owns mouse and keyboard |
| Real state/option coverage | NOT VERIFIED:0/63 applicable registrations | Synthetic tests do not increment this denominator |
| Real rendered E2E / monetary atomicity / contribution / return/reload | NOT VERIFIED | Surface/host/Workspace not wired; root/later page owner |
| Independent visual comparison | NOT VERIFIED | Worker saw source reference only, no rendered candidate screenshots; root |
| Emulated touch / physical touch / mobile software keyboard | NOT VERIFIED, each separate | No browser or device operations authorized |
| Leaf business persistence | NOT APPLICABLE | No business write in leaf; whole-home persistence is not waived |
| Global suite/performance | NOT VERIFIED for this new candidate, explicitly not run | Prior P1/P2/P3 FAIL and original performance artifacts remain unchanged |

Real click attempts0/8, real click execution0/8, real result pass-rate N/A (no real operations), real state coverage0/63. There is no preview URL because no browser/service is authorized for this leaf handoff. A later integrated UI delivery still requires the project's live preview and independent acceptance.

The candidate is frozen at the three SHA values above. Root decides acceptance and any later integration. Do not infer formal P2 progress or accepted performance from this local preparation.
