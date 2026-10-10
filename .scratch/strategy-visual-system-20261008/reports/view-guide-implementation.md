# View guide implementation report

- Ticket: [03 — 工作台全部视图导览](../issues/03-workbench-view-guide.md)
- Scope: `public/design-system-20261008/workbench/index.html` only for implementation; no data, service, or database changes.
- Implementation status: `implementation-ready`; coordinator integration and browser acceptance remain pending.

## Delivered behavior

- The existing 38px range strip now exposes `全部视图` and opens the existing modal with a keyboard reachable directory.
- The directory separates `完整交互版（历史布局）` from the current A presets. It links to the approved `strategy-workbench` observe/results/compare URLs and the A creation URL, and explains that full net value/K-line, result drawdown/positions/contribution/fees, and comparison charts are still in the historical full version.
- A presets call the existing state functions: `overview`, `candles`, `results`, `compare`, `events`, `event`, `metrics`, `detail`, and `config`. State scenarios expose `T0`, `running`, `review`, `complete`, `loading`, `error`, and `pressure`.
- `?preview=<preset>` deep links apply on load. Existing `?scenario=<scenario>` remains supported. With no query, the A page starts at `complete`; `?prototype=strategy-workbench&view=observe|results|compare` remains directly usable.
- Preset selection resets the synthetic in-memory demo and is labeled as such. Existing `about` boundary information and appearance links remain available.
- Existing modal Escape handling and opener focus restoration are reused.

## Browser regression and repair

- Historical FAIL retained: `evidence/full-restore-guide-1440.png` showed the directory content was updated while `modalLayer.hidden === true`; the dialog rectangle was zero and no overlay was visible.
- Root cause: `openViewGuide()` populated `modalTitle`/`modalBody` but omitted the existing modal open step.
- Repair: added `els.modal.hidden = false` immediately after rendering the directory content, preserving the existing Escape close and opener focus restoration path. Root must recheck directory visibility, preset/scenario controls, Escape, and focus in the real browser.
- Static visual repair: directory metadata text now uses the STYLE-04 minimum `12px` size and `18px` line height.

## Verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Static implementation | PASS | `node --check /tmp/workbench-inline-check.js` (inline script extracted from final HTML) |
| Source scope | PASS | Only `public/design-system-20261008/workbench/index.html` and this report are in scope |
| Browser behavior | NOT VERIFIED | Historical FAIL repaired; coordinator must check the real browser, including directory visibility, keyboard access, Escape focus return, all preview links, scenario links, and 1440/1280 viewports |
| Visual comparison | NOT VERIFIED | Coordinator/independent reviewer must compare rendered directory and A frame against STYLE-04 evidence |
| Persistence/database | NOT APPLICABLE | This is an in-memory synthetic prototype; the directory does not write business data |

## Source identity

- Final HTML SHA-256: `4ff8a3374f3d8e59deeefafe7e8cabe01fc6bed8a59ff9ac255617332043c235`
- Generated: 2026-10-08
