# P1 third-candidate shell repair: bounded disjoint CSS owner

2026-10-23. Model gpt-6.1-sol / ultra. Root explicitly authorizes this repair within the existing P1 third-candidate preparation; P1 remains 2/3 FAIL, no new task/round reset. One candidate, then root review.

## Design contract and scope

Read current docs/agents/development-workflow.md, task-decomposition.md, frontend-control-audit.md and ui-task-templates.md before implementation. Read approved `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP01 layout42–75, public77–110, HP03 header113–129; actual original `source/images/home-1440.svg`, `home-1280.svg`, `account.svg`, current component-manual.html matching header/control sections, and task visual-contract.md. Inspect actual screenshots `evidence/continue-2026-10-23/root-390-before.png`, `root-1440-before.png`, `root-1280-before.png` and ROOT-RESPONSIVE-CHECKPOINT.md, not just this ticket. Source SVGs are inspectable text; render/view image with approved tools if useful. No new visual design/deviation authorized.

|Requirements/element locator|Reference|Owner|Journey/evidence|
|---|---|---|---|
|HV25-03/HOME-HP11-B001 desktop geometry; HV25-06/HOME-HP03-B001 header; narrow reachability required by task visual contract|home1440/home1280/account original SVG + HP01/03; real 390 before image|/root/responsive_shell CSS only; root whole-page visual/data owner and independent visual reviewer|390 header/account remains fully inside header; navigation/settings do not overlap header; market/account/search, holdings horizontal area, pagination and detail/return remain reachable. Desktop1440x1000 and1280x800 unchanged72rail/64header/24padding. Boundary900 and759 sides. Root screenshot/rect and real keyboard/mouse checks. Physical touch/software keyboard NV unless real evidence.|

## Allowed output / exclusions

Exclusive product write ONLY `app/components/homepage-v25/home-surface.css`, narrow shell/header/sidebar selectors (do not change search/detail/holdings desktop dimensions). Evidence only this responsive-shell directory. No Surface/host/Workspace/global CSS/F/S/series/filter/ledger/deps/config/DB, shared tracker or tests edits. No service/browser ownership: root owns active3333 and CUA, preserve isolated DB. No subagents, commits/push/merge.

First diagnose causal cascade: actual 390 before shows account y128–164 crossing header bottom136/content156. Header has inherited `flex:0 0 64px` despite wrap auto height; homepage rail rules may conflict with global mobile grid. Compare working desktop/mobile patterns; write one precise hypothesis, then smallest scoped repair after cause evidence. No blind pile-on, font shrink, hidden controls or fake spacer. CSS-only change does not need implementation-mirroring tests; browser before/after is the behavioral regression and root will execute. Record syntax/lint relevant checks and unchanged protected files.

Inspect max-width900/759 and pointer-coarse consequences; no four-region filters/period/history/contribution implementation in this task. Interface/state/DB untouched, so DB write gate N/A for this CSS slice with reason; full P1 persistence remains NV. Return IMPLEMENTATION-READY with causal explanation, exact diff, file hashes, expected desktop/narrow geometry and remaining NV. Root may return at most remaining formal P1 third iteration; do not claim feature accepted.
