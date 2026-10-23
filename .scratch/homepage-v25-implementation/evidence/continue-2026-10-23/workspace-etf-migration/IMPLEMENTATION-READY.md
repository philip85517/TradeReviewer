# IMPLEMENTATION-READY — bounded ETF consumer test migration

Owner: actual GPT-6.1 SOL / ultra. Independent acceptance owner: root. Freeze: 2026-10-22T23:35:43.283440+00:00.

The allowed candidate is ready for independent review and the exact two-test rerun. This is a scoped test migration, not homepage delivery or final acceptance. No product defect was established by these runs.

## Change boundary and unchanged intent

Only the body of the original `passes stored instrument metadata into the trading room scope` test and one adjacent `keeps unknown instrument metadata out of stock and ETF homepage categories` test changed in `app/components/trade-review-workspace.test.tsx` (original starts at 5475; negative at 5569). `ETF-only.patch` is against the pre-task byte snapshot, not the preexisting Git diff.

The stored ETF metadata fixture is preserved: market US, matching symbol, assetType etf, statement source/confidence (5497–5507). Only the local execution gains explicit live evidence (5489), because homepage eligibility requires every fill to be explicitly live (`holdings-model.ts:45–48`). Shared helper/beforeEach, all other 100 original tests, and especially the old return test are byte-identical outside the allowed block. No product/config/dependency/service/DB/network/browser/tracker/subagent/commit work occurred.

The obsolete region/radio path is replaced by V2.5 首页 → 当前持仓（最新） → 附加筛选 dialog → ETF checkbox → 应用. The original business intent remains observable: an actual ETF target survives ETF filtering, its real holding detail reports ETF, and a stock-only selection excludes it. An ETF-looking name without metadata stays category unknown and is excluded from both stock and ETF filters. These assertions do not derive expectations through a production helper.

## Approved specification and control registry

Original authority: `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`. The dispatch uses shorthand HP01/HP03 ranges; the actual source chapter anchors are HP03 for header/filter (115–175) and HP04 for holdings (257–314). `images/filter.svg` and `images/holding-return--detail.svg` were read and visually inspected through local PNG rasterizations retained here. No rendered product comparison occurred.

Exact requirements include “用户编辑的是草稿，点击“应用”后一次生效” (165), successful application updates conditions and data (169), and holdings title 当前持仓（最新） (257). Detail entry uses 查看持仓详情 (314). Classification requires valid matching metadata (`trading-room-scope.ts:302–327`); a name or broker does not supply it.

| Registry | Control/journey and literal evidence | Current test lines | Status / owner |
|---|---|---|---|
| ETF-T1-a | Production homepage and actual initial ETF row; wait for row rather than an early count | 5529–5534 | Scoped PASS / worker |
| ETF-T1-b | ETF draft leaves old row and no applied ETF token; Apply shows count 1/token, closes editor, retains actual row | 5536–5548 | Scoped PASS / worker |
| ETF-T1-c | Open target row detail; visible metadata suffix ETF and no unknown suffix | 5549–5553 | Scoped PASS / worker |
| ETF-T1-d | Edit stock draft with ETF token/row still applied; Apply removes ETF token and target, count 0 | 5555–5566 | Scoped PASS / worker |
| ETF-T1-e | Missing metadata with ETF-looking name yields unknown detail; stock and ETF each exclude target | 5569–5608 | Scoped PASS / worker |

Actual consumer chain exercised: stored bootstrap metadata → `readHomepageBundle` metadata map (`trade-review-workspace.tsx:2191–2212`) → accepted homepage data and `buildHomepageHoldings` (2255) → attachment classification (`attachment-groups.ts:204`) → HomeSurface conditions (281–286), real row, and detail category (354). Local HTTP stubs provide alias/FX/Recall protocol shapes inside these two tests only. FX is explicitly missing; no amount, quote, exchange resolution, or real storage correctness is asserted. No pending predicate is selected; an empty Recall stub is not evidence of fresh summary ownership.

## Verification and retained failures

`COMMANDS.json` records complete exact commands and exit codes. All test invocations use the existing config, native Node 26, native config loader, maxWorkers 1, and anchored test names. No mergeConfig, custom config, full-suite or performance run was used.

- `RED-original-etf.log`: original single test failed at old 我的交易室 region; 1 FAIL / 100 skipped / 101 file tests.
- `GREEN-etf-and-unknown.log`: first migrated run 2 FAIL / 100 skipped / 102. Both initial synchronous row queries raced loading (`aria-busy=true`, 正在读取真实持仓…). This is preserved, not relabeled as a product bug or a pass.
- Root explicitly authorized changing only these two initial waits to `findByRole`. Business expectations and shared setup remained unchanged.
- `GREEN-2-etf-and-unknown.log`: exact same pair, exit 0; **2 PASS / 100 skipped / 102**, 8.96 s. The other 100 tests were not executed.
- `LINT-workspace-test.log`: scoped ESLint exit 0, empty output.

TDD limitation: the existing test's old-selector RED was observed; the new negative's first RED was an initial-row synchronization issue. No product mutation run was made, so the proposed mutation sensitivity in TEST-DESIGN.md is static reasoning, not demonstrated mutation coverage. The Node module.register deprecation warning is retained in the raw test logs.

## Self-review and gates

No new Critical, Important, or Minor product finding is established. The only candidate harness defect found was the initial synchronous row lookup; its original raw failure and corrected exact rerun are retained. Static review and two passing consumers do not establish broader feature acceptance.

| Gate | State and remaining owner |
|---|---|
| This ETF/unknown category consumer scope | PASS for two mocked-boundary JSDOM tests; root independent rerun pending |
| Real browser mouse/keyboard/touch | NOT VERIFIED; no browser authorized in this task |
| Product screenshots vs approved reference / responsive fidelity | NOT VERIFIED; root whole-page visual owner |
| Actual write persistence, return navigation, reload, isolated DB | NOT VERIFIED; root full persistence owner |
| Old Workspace return test / period/calendar/history/contribution obligations | Unchanged prior FAIL / NOT VERIFIED; not executed or replaced here |
| Formal rounds | P1 remains **2/3 FAIL**; P3 remains **0/3**; this task adds no formal round |
| PendingFact caveat | Preserved; this category-only scope neither resolves nor verifies the previously disclosed default pending evidence limitation, strict single-bool summary ownership, or pending selection behavior |

Current performance and history/contribution remain deferred placeholders (`home-surface.tsx:290–293,323`). This test does not authorize deleting or weakening the original return/state obligations. Complete filters/period/calendar restoration, search/sort/page/scroll/focus return, pendingFact, cancellation/CAS, global-library inheritance, complete financial groups, and persistence remain outside this bounded evidence. No feature PASS or preview URL is claimed.

## Version and freeze

HEAD before/after: `5a94ee3ff76e32993fe2c4791a83b40e877a7344`.

Test SHA256 before: `bab6d85aff029372fe77422e27f3076117298baa18aec3e6463509b1985704b5`.

Test SHA256 after: `1fbb9dc85466ed0677c4ef654631a6b83274ed7ff5753b871b1fe011ecd5b9af`.

All ten protected product/config SHA256 values match BEFORE.json exactly. CHECKS.json proves the full prefix and suffix outside the allowed block are byte-identical, keeping every shared helper and original return test unchanged. BEFORE.json / AFTER.json record versions. MANIFEST.json seals this report, raw logs, exact patch, references and snapshots. Stop-writing point is the manifest freeze; root may independently accept or request a new bounded task.
