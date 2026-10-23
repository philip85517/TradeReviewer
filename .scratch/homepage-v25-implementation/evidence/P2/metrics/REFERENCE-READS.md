# Original references read and directly viewed

Worker `/root/metric_cards` read the full root dispatch and the current AGENTS.md plus docs/agents/development-workflow.md, task-decomposition.md, frontend-control-audit.md, ui-task-templates.md and issue-tracker.md. Read TDD and verification-before-completion skills; using-superpowers explicitly exempts dispatched subagents. The approved parent dispatch supplies the bounded design/implementation plan; no new design or extra child agents were introduced.

Read original `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`:42–75,191–221,467–549, and original `component-manual.html`:611–698. Re-read the metric sections during final review. Read the actual exported money/metric and boundary/current bundle contracts from app/lib/reviews/homepage-v25-performance.ts and homepage-v25-series.ts, and current homepage CSS tokens from home-surface.css.

Direct visual inspection with `view_image`:

| Original | Directly viewed file | Notes |
| --- | --- | --- |
| source/images/atom-metric.svg | /private/tmp/tradereview-atom-metric.png (provided faithful copy) | Eight-state1100×1100 design board; never interpreted as browser CSS viewport. |
| source/images/home-1440.svg | .scratch/homepage-v25-implementation/evidence/environment/reference-home-1440.png (provided copy) | Wide full-home reference used for hierarchy/density and four-card row. |
| source/images/home-1280.svg | metrics/home-1280.png | Original SVG rasterized with installed sharp using pinned Node, then directly viewed. Full-page1280×2346 image is not itself the1280×800 CSS comparison viewport. Tool resized preview to1117×2048. |
| source/images/loading--stale-data.svg | metrics/loading--stale-data.png | Original rasterized with sharp then directly viewed. Image depicts table/stale feedback context; not proof of this leaf's loading render. |
| source/images/error--update-failure.svg | metrics/error--update-failure.png | Original rasterized with sharp then directly viewed. Image depicts table/update-failure context; not proof of this leaf's error render. |

Rasterization used installed `sharp` solely to read the original vector design. No browser/service/network/DB was used, and no implementation screenshot was produced. Root still owns comparable viewport/reference-state rendered comparison, actual narrow breakpoint review and independent acceptance.

Original source and inspected copy hashes are recorded in SOURCE-SHA256.json. The source manual/spec remains authoritative; provided PNG copies and this note do not replace it.
