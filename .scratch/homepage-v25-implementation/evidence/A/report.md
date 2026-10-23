# V2.5 asset and P1 journey preparation report

**Status: implementation-ready for coordinator round 2 review; not accepted.** This is documentation-only. All writes are under `evidence/A/`; no product code, tracker, business database, or service was changed.

The shared contract denominator remains 12 classes × 8 states = 96 rows, with 85 applicable and 11 original NA. `CONTROL-STATE-MAP.md` now uses the component-specific manifest frame and each manifest state label instead of claiming one generic inspected image for every state. `MANUAL-ANCHOR-CHECK.md` automatically checks all 12 exact HTML ids and all 12 manifest frame IDs/paths. Historical `integration-assets/...` evidence remains `NOT_ACCEPTED` and absent.

`ASSET-READBACK.md` preserves the real raster readback of the original homepage, holdings, return, round4 and round5 assets and their prototype-only limitations.

`P1-HOLDINGS-JOURNEY.md` is rewritten to the approved target: `/home` holdings row → holding detail → the unique “查看交易” action → ordinary `/trades` library → `/home` return/refresh. It explicitly excludes new replay behavior and treats the current direct `onOpenInReview(...queueIds)` callback only as a migration seam. The table now covers market, account, C summary, local search, name sort, FX-complete floating P/L sort, export, row detail, holding detail, unique trade handoff, ordinary library, direct URL/refresh, invalid source recovery, and all relevant empty/missing states. Every entry includes exact spec lines, manifest block/state location, local visual reference, owner, target state and evidence.

The coordinator must still independently accept the product implementation and its browser/persistence gates. This ticket does not claim product UI, `/trades`, URL refresh, detail navigation, or database behavior is implemented.

Round 2 corrections: the legacy direct review callback is now documented only as a migration point; all P1 rows have the same pending Luna page owner with `/root` data-flow/visual acceptance. The ordinary library and URL contract cites HP06 `:432-464` and Appendix 2 `:646-668`, including explicit accounts, live scope, open trades in execution-date ranges, invalid-market fallback to `all` with warning, and no `queue`. FilterPopover manifest coverage is explicitly limited to the `normal` frame; its other manual states remain awaiting implementation evidence.
