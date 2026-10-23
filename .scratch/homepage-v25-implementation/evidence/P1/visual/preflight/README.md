# P1 first-render preflight

Root directly inspected real browser renders at 1440×1000 and 1280×800, DPR 1, compared with approved home-1440 and holding-option-C-normal-1440 reference pixels and original specification. This is development preflight, not a formal acceptance round; current P1 remains 0/3. Current source was still changing, so these observations do not accept a frozen version.

- Observed nav width72, header64, content x96/w1320, holdings top586; vertical module reservation follows whole-page target.
- Observed toolbar47 plus boundary, table header40, body384, footer48; final populated row/slot checks still required.
- C summary differs: label/value stacked; approved references use single-line parallel amounts with currency and positive sign. Returned to integration owner.
- Legacy fixed market/data-status footer remains visible and consumes 30px absent from approved whole-page composition; owner to verify and resolve within homepage scope.
- Isolated backup has zero explicitly-live eligible open holdings; no populated journey or money correctness conclusion. Seed and actual persistence remain required.
- P2/P4 reservation areas explicitly unimplemented; neither claimed as accepted nor removed from 55/96 denominators.

Screenshots home-1440-initial.png and home-1280-initial.png are actual IAB renders; spec/reference pixels are under resume-2026-10-23/integration-debug/visual-readback. Functional journey, state/persistence and final visual gates all remain NOT VERIFIED.
