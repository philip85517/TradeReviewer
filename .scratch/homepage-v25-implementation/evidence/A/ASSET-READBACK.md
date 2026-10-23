# Asset readback record

I inspected the source SVGs by rasterizing them with the workspace `sharp` runtime and viewing the resulting PNGs. The inspected originals were `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg` (1440×2346), `home-1280.svg` (1280×2300), `holding-option-C-normal-1440.svg`, and `holding-return.svg`. The 1440 page shows the dark shell, 72px navigation, 64px header, current performance metrics, holdings table, historical cards/chart, and contribution section. The C holdings frame shows the C summary at title right, search/export controls, five data rows plus three reserved rows, and pagination. The return frame shows the focused first-row view action and restoration of the source context.

I also viewed round4 `prototypes/round4/index.html` and its acceptance notes. D07 covers year and view-mode popovers and Esc/outside close; D10 covers metric card widths (A 321×88 and narrow B 278×104), with no layout shift. Round4 acceptance is prototype-only; database is N/A and full-site integration is NOT VERIFIED.

I viewed round5 `prototypes/round5/index.html`, `DESIGN-COVERAGE.md`, and `evidence/ACCEPTANCE.md`, plus `reference/home-1440.svg` and `reference/contribution-current-a.svg`. Round5 is a static history/contribution prototype. History operation is recorded PASS; hover is NOT VERIFIED; contribution is PASS with colour pending; detail is a stub/connection only; persistence and physical touch are NOT VERIFIED. These are reference anchors, not product acceptance.

The contract's historical evidence paths all point to `integration-assets/...`; those paths are absent here and remain `NOT_ACCEPTED` in `CONTROL-STATE-MAP.md`. No source image is silently promoted to an accepted state asset.
