# History stats candidate1 design understanding

This independent leaf is 0/3, P4 entire ticket is 0/3. Approved original design and root dispatch authorize implementation; no design deviation is proposed. Actual worker GPT-6.1 SOL / ultra. No subagents.

Only new history-stats-cards.tsx/css/test.tsx and this candidate evidence may be written. MetricCards candidate3 is frozen; BASELINE-SHA256.json records its hashes. Root owns integrated visual consistency, complete data flow and independent acceptance.

## Controlled contract

Readonly summary contains closedNet and allocatedFees money evidence, and three independent readonly scalar observations closedRounds, winningRounds, winRate ({value:string|null,available:boolean,reasons:readonly string[]}). No extra evidence fields are added. winRate is already a 0..100 percentage supplied upstream. Counts are nonnegative integers. Finite decimal validation, display scaling, grouping and rounding are presentation only. No financial projection or relation is derived between fields. A known zero survives. Invalid/missing evidence does not suppress other independently available values. All values are read from one caller-supplied committed summary; pending/error retain only what the caller passes. sourceId, requestGeneration and reportCurrency define detail lifetime.

Four cards follow original history SVG labels/visual hierarchy: 已平仓净盈亏, 已平仓回合, 范围胜率, 费用（已扣除）, with accessible article names matching dispatch's semantic names 已平仓净盈亏/已平仓回合数/胜率/已扣费用. No title/year/chart is added. Amount card headings expose report currency. The four read-only triggers show explanations, exact source strings, independent availability reasons and money provenance; no repair/retry action or persistent completeness badge.

## Original visual references and implementation decisions

Read source/visual-design.candidate.md HP05:349–394, HP09:467–515, HP08:516–549 and original history SVG/state images; directly viewed eight existing reference PNGs plus shared samples board. Original source SVG DPR is unspecified. Root comparison uses CSS viewports 1440×1000,1280×800,390×1000, zoom100%,DPR1.

Original history card rectangles x56/392/728/1064,y94,w318,h88,rx10,fill#111A26,stroke#283448. Grid uses18px gaps and zero outer margin; parent supplies content start. Labels14px secondary#A8B6CB, values28px/34px weight600, positive#53D7A0,negative#FF8592. Container-responsive four/two/one columns keep cards readable (four columns at≥1014px, two at498–1014px, one below498px; a1168px content area therefore exercises278.5px B cards); card width below300px uses B height104px, otherwise A88px. This places A321 and B278 on their documented sides without relying on viewport. A ratio and value share baseline; B explanatory label is4px above right-aligned counts and shares count/value baseline. Long primary text truncates only visually; exact values are always on accessible trigger and detail; units remain visible. Root must verify this stress behavior in a real browser.

Motion:150ms opacity-only committed group replacement,120ms color/background hover with fixed geometry,160ms popover enter/exit opacity+4px. Closing immediately removes interactive/accessible state and restores exact trigger, while inert aria-hidden visual exit persists160ms. Reopening cancels old cleanup. Context invalidation permanently clears selection. Reduced motion enters/exits directly; changing preference mid-exit completes it.

## Gates and exclusions

HS01–HS15 from ROOT-DISPATCH.md define leaf journeys. Product tests are synthetic DOM/lifecycle checks, not real mouse/keyboard/touch or visual PASS. Root must test all four controls, A/B boundaries, extreme values, initial/pending/error/empty, exact reference comparison and normal/reduced motion at frozen hashes. Actual finance/year switching/chart atomicity/persistence/full page remain NOT VERIFIED here. No IO exists in this leaf: DB writes NOT APPLICABLE by scope. No service/browser/DB/host/financial/config/tracker work is authorized.
