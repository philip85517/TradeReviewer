# Responsive shell — IMPLEMENTATION-READY

2026-10-23 CST. Owner `/root/responsive_shell`, GPT-6.1 SOL / ultra. **Not accepted. P1 remains 2/3 FAIL; this is the existing third candidate.** The worker has made one minimal candidate and has not performed another formal acceptance round.

## Change and causal evidence

The directly viewed historical 390 screenshot shows account/search/filter beyond the 64px header and mobile navigation crowded into the 72px sidebar box. The precise pre-edit causal hypothesis, reference reading and scope mapping are in [DIAGNOSIS.md](DIAGNOSIS.md). The owned CSS was snapshotted before the product edit as [home-surface.before.css](home-surface.before.css).

Only `app/components/homepage-v25/home-surface.css` changed:

- Existing max-900 header rule now sets `flex-basis:auto`, releasing the desktop `flex:0 0 64px` main-axis allocation when the header wraps.
- New max-759 scoped sidebar rule restores `width:100%; min-width:0; flex-basis:auto; padding:6px 12px; gap:10px` to match the existing global mobile grid contract. The brand is start-aligned within the mobile grid's flexible first column.

The exact patch is [home-surface.patch](home-surface.patch). There are no new control, font, height, visibility, state, data, modal, holdings or desktop sizing declarations. Existing 56px nav/settings buttons and labels remain. Existing 176×36 account and 36px header icons remain. No service/browser operation, restart, database access, test change, delegation, commit or push was performed.

## Version and checks

Worktree `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`; detached HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. This is a dirty, multi-owner feature; content hashes bind this candidate.

| Item | Evidence / result |
| --- | --- |
| Owned CSS before SHA-256 | `b7160f103035966877256ecb04aaf4d10a185af272a6c3476b5cbee5771f7cb8` |
| Owned CSS after SHA-256 | `765c420c5d5f6eac81e56626786b4421fdd39925dcb071facac7561446493fbf` |
| Complete CSS parse | `./scripts/native-node.sh --input-type=module` with installed PostCSS, exit 0, Node v26.0.0; 151 rules / 592 declarations. [css-parse.json](css-parse.json) |
| Whitespace diagnostic | `git diff --no-index --check -- <before> <current>`: exit 1 for the existing diff, **empty output**, no whitespace diagnostics. Exact patch reviewed separately. |
| CSS lint | NOT APPLICABLE: project ESLint config has no CSS parser/rules; the whole file was syntax-parsed with installed PostCSS instead. No claim of full ESLint/build/test pass. |
| Protected source snapshot | [source-before.manifest.json](source-before.manifest.json), [source-after.manifest.json](source-after.manifest.json), [source-comparison.json](source-comparison.json): 825 existing files under app/conf/scripts plus dependency/config manifests compared; the owned CSS is the only changed file. Other 824 hashes match, including global CSS, Surface/host/workspace, data modules, tests and runtime configuration. |
| Full typecheck/build/tests | NOT VERIFIED by this worker. CSS-only candidate adds no mirrored implementation test; root owns consolidated required checks. |

The first `git diff --no-index` inspection returned exit 1 because the files differ; a chained `git diff --check` therefore did not run. The later dedicated no-index check above ran and produced no whitespace diagnostics. This does not constitute browser verification.

## Expected geometry for root review

| CSS viewport | Expected, not a rendered PASS |
| --- | --- |
| 1440×1000 / 1280×800 | New rules do not match. Existing 72px rail, 64px header, 24px content padding and desktop control/holdings budgets are unchanged in source. Root must compare actual same-state screenshots/rects against the approved references. |
| 900 / 901 boundary | At 900 the header has content-based basis and the existing 16px narrow padding; at 901 it retains the existing 64px/24px rule. No new breakpoint or responsive hold/detail/search dimensions. |
| 759 / 760 boundary | At 759, full-width mobile grid with readable 56px settings control and existing navigation trigger; at 760, original 72px flex rail. Check open nav overlay and close/Esc, which must not push the page. |
| 390×844 | Full-width mobile top strip. With the existing two 36px control rows, 8px row gap, 24px padding and 1px border, header needs about 105px rather than 64px; account/search/filter should be entirely contained. Source ordering and all control sizes stay unchanged. Root records actual rects. |
| Coarse pointer | Navigation/settings 56px already exceed global 44px min-height. Header 36px is the approved unchanged control budget. Emulated touch, physical touch and software keyboard are not proven by source analysis. |

## Version-bound local audit handoff

Trigger: authorized frontend layout repair and actual 390 overlap/crowding. Scope: changed shell/header/sidebar and affected upstream/downstream reachability; no whole-page PASS or control coverage claim. References and exclusions are in DIAGNOSIS and ROOT-DISPATCH. Root owns service, frozen data/filters, real control inventory and operation evidence; this worker performed **zero real interactions**.

| Local control / journey group | Required real check / counterexample | Current status / owner |
| --- | --- | --- |
| Mobile navigation trigger + 5 primary entries (including disabled strategy) + settings | 390/759; open/close/Esc; labels/hit boxes stay reachable; navigate and return without header collision. Disabled entry retains reason. | NOT VERIFIED / root |
| 4 market buttons and account trigger/options | All market states, long account text, option popup, selection, Escape/focus return; trigger width and header containment do not change. Freeze actual option identities/count in root's inventory. | NOT VERIFIED / root |
| Header search + existing disabled filter | Search open/close/Esc/focus return, background layout stable; disabled filter stays visible with its existing reason. | NOT VERIFIED / root |
| Holdings horizontal area, pagination, detail/return | Reach right-side actions at 390; move pages; open/close detail; preserve source scroll/focus on return and reload. CSS for these areas was not changed. | NOT VERIFIED / root |
| 1440/1280 and breakpoint sides | Same-state screenshots and rects; direct visual comparison to approved layout/public control requirements. | NOT VERIFIED / root |
| Mouse / keyboard | Real actions and result evidence per group; freeze denominator including dynamic options/rows. | NOT VERIFIED / root |
| Emulated touch / physical touch / software keyboard | Keep each evidence type separate; actual device needed for physical inputs. | NOT VERIFIED / root |

No execution or state/option coverage numerator is claimed; the final root inventory must bind the dataset, options, rows and journeys. The root's existing complete inventory and P1 denominator remain authoritative. No exclusions remove the above required integrated checks from the scope.

| Acceptance gate | Conclusion | Reason / remaining owner |
| --- | --- | --- |
| Local source/syntax/scope verification | PASS (source-only) | Exact diff, PostCSS parse and 825-file manifest comparison above. |
| Functional regression | NOT VERIFIED | Requires root real browser actions; worker report is not acceptance. |
| Navigation/state/return chain | NOT VERIFIED | Actual holdings horizontal reachability, pagination/detail/return and keyboard regression remain root-owned. |
| Independent visual comparison | NOT VERIFIED | Root did not implement this CSS slice and must directly compare fresh rendered screenshots at required widths/states. |
| DB write for CSS slice | NOT APPLICABLE | No data handlers/state/repository edits or browser writes in this slice. Full P1 real persistence remains NOT VERIFIED. |
| Integrated P1 / final UI delivery | NOT VERIFIED | P1 has two prior FAIL rounds; only root can record the remaining formal candidate result. Needs final manifest, running preview and fresh browser evidence. |

The 3333 isolated-db service was left untouched. Startup/restart instructions and preview verification remain root's responsibility; this handoff does not authorize resetting the existing service or its test data.
