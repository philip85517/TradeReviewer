# Root responsive pre-integration checkpoint

Trigger: ongoing whole-page V2.5 implementation, required matching desktop comparison and narrow-screen reachability. This is an independent observation, not a formal P1/P2/P3 acceptance round.

Scope: existing homepage shell/placeholder sections/holdings, before P2 and attachment integration. Approved reference and viewport contract remain `../../visual-contract.md`; full source/reference matrix remains `../../DESIGN-COVERAGE.md`. No design deviation is approved here.

Root captured the actual page at 1440×1000 and 1280×800, DPR 1 (`root-1440-before.png`, `root-1280-before.png` and AX captures). At 1280 the header was 64px high, performance reservation x96/y88/w1160/h474, holdings x96/y586/w1160/h520. These measurements confirm only the existing scaffold dimensions; required performance/history/contribution content is still unimplemented.

The first 390×844 attempt and subsequent tab selection timed out in the browser tool. A fresh tab in the same browser recovered successfully. A later explicit viewport set produced real 390×844/DPR 1, body width 390, saved as `root-390-before.png` and `root-390-before.metrics.json`. This supersedes the tool-level NOT VERIFIED for obtaining a narrow screenshot, but does not prove all controls usable.

Independent visual finding: narrow header/account control extends into the beginning of the content area; sidebar navigation/settings also crowd the top strip. The wide holdings area is intentionally scrollable, but complete narrow reachability remains NOT VERIFIED. No repair was attempted during concurrent HMR. This is an open visual/reachability finding for the eventual sole UI owner, not evidence that tool timeouts were caused by the product.

| Control/journey | Bound observation | Result |
|---|---|---|
| Desktop scaffold 1440/1280 | Actual screenshots and dimensions only | Limited evidence; full visual comparison NOT VERIFIED |
| Narrow shell/header/account | Real 390 screenshot, DPR 1 | FAIL: header overlap/crowding |
| Narrow holdings horizontal navigation, pagination, detail, return | Not exercised in a stable freeze | NOT VERIFIED |
| Period performance, filters, history/contribution | Still placeholders/disabled or not integrated | FAIL: required content absent |
| Persistence, keyboard and touch in narrow state | Not exercised here | NOT VERIFIED |

Production Surface/CSS/host were unchanged by this checkpoint; financial candidate edits caused HMR during later reads. Screenshots are pre-integration observations and cannot be reused as final frozen-version acceptance. Prior limited search and persistence evidence remains scoped to its original manifests.
