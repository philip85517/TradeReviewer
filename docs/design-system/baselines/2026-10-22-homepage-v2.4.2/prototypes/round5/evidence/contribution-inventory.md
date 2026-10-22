# Contribution control inventory

| ID | Control / state | Input | Expected observable result |
|---|---|---|---|
| C01 | palette review selector | mouse / keyboard select | legacy/proposed colors change while data and geometry stay fixed |
| C02 | fixture review selector | select normal/edge/extreme | normal, tiny/zero/unknown, and extreme values render in the same module geometry |
| C03 | current/history tabs | click or keyboard focus | mode copy, total, legend and segments update; historical hides floating segments |
| C04 | category tabs, sort, open-only | click/select/space | D11 shell state updates and is remembered separately per mode |
| C05 | market row | click | market summary becomes symbol list and breadcrumb appears |
| C06 | symbol row | click | detail placeholder opens with source context |
| C07 | breadcrumb / close | click | returns to source market or detail context |
| C08 | segment tooltip | mouse hover | full amount and solid/hollow composition semantics appear |
| C09 | segment keyboard focus | Tab/focus | same full amount and composition semantics are available without mouse |

Scope exclusions: root index integration, full homepage layout, database writes, replay behavior, and mobile product redesign. Narrow view is only a readable horizontally scrollable prototype boundary.
