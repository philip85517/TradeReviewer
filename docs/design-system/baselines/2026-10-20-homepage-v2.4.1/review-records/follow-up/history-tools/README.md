# History/contribution follow-up tools

These copies are the repeatable V2.4.1 R08 tools for the history and contribution artwork. Each script locates the TradeReview repository from its own path and changes into that root, so it can be invoked from any working directory. The scripts never write shared `home*.svg` files unless `--apply` is explicitly passed to `apply-shared-embedded.mjs`.

From a checkout of TradeReview, review the candidate first:

```sh
node docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/apply-shared-embedded.mjs --check
node docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/apply-shared-embedded.mjs --preview
node docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/render-shared-evidence.mjs
node docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/render-evidence.mjs
node docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/verify-final.mjs > .scratch/homepage-v241-repair/work/history/evidence/static-check.json
node docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/hash-evidence.mjs > .scratch/homepage-v241-repair/work/history/evidence/SHA256SUMS.txt
```

After independent root review of the SVG/PNG previews and browser evidence, apply the four full-page child-SVG patches with:

```sh
node docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/apply-shared-embedded.mjs --apply
```

`transform-history-source.mjs` is retained for reference and re-generation of the allowed local history/contribution source images; it writes only the permitted `source/images` files. Browser hover, keyboard, physical-touch, runtime filtering, persistence, and end-to-end market→symbol→detail→return checks remain independent root acceptance gates.
