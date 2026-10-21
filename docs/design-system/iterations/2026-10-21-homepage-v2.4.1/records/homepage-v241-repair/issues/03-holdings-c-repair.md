# 将已确认持仓 C 方案应用于关联图稿

ID: V241-03
Parent: [首页规范 V2.4.1 一致性修复](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: open
Status: implementation-ready
Assignee: holdings_c
集成负责人: root

## Scope
在 V2.4.1 承接已有 C 方案，修复当前正文所有持仓汇总为标题右侧并列；正常/极值/空/加载/返回均覆盖。不改变列宽、表头括号、布局次序、其它元素尺寸。历史 A/B 候选保留比较身份。采用可重复运行且有限目标范围的生成/迁移脚本。

## Refs
DESIGN-COVERAGE.md 的 D02；V2.4 source/images/holding-option-C-{normal/large}-{1280/1440}.svg；原诊断 locations.csv；.scratch/homepage-v23-consensus-revision/work/03/design-source.mjs、build.mjs 及 work/01/integration-assets/build-boards.py。

## Blocked by
- [持仓汇总采用标题右侧并列方案](01-holdings-c.md)

## 验收标准
- [ ] 逐图列出修改列表及前后属性；非目标元素保持不变。
- [ ] 同数据同宽度与 C 原图比较，1280/1440 无文字重叠，无工具挤压。
- [ ] 提供兼容正文的默认描述及保留候选身份建议，由 root 集成。
- [ ] 独立浏览器视觉验收与全图一致性复核（root 承接，不得自行宣称通过）。

## Implementation report

已完成有限范围的 C1-2 迁移：标题右侧并列持仓汇总应用到 1280/1440 全页默认图的 source 与 packaged 副本，共 4 个目标 SVG；每个目标保留现有标题、搜索/导出工具、表格列、表头括号和数据文本。source 副本为 4 个逻辑文本节点，packaged 副本为 2 个合并文本节点。

### File manifest

- `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images/home-1280.svg`
- `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images/home-1440.svg`
- `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/images/home-1280.svg`
- `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/images/home-1440.svg`
- [迁移脚本](../holdings-c/migrate_holdings_c.py)
- [迁移清单](../holdings-c/evidence/migration-manifest.json)
- [结构验证](../holdings-c/evidence/structural-verification.json)

### Geometry changes

| viewport | 市值标签/值 | 浮动盈亏标签/值 | result |
| --- | --- | --- | --- |
| 1280 | `545/581, y=610` | `710/820, y=610` | C right-of-title |
| 1440 | `705/741, y=610` | `870/980, y=610` | C right-of-title |

迁移只匹配 holdings module 的旧汇总锚点并断言唯一目标；脚本可重复运行，第二次运行报告 already-migrated。A/B/C 候选参考图共 4 张（normal/large × 1280/1440）未作为迁移目标，保留比较身份。pending header bracket choice 未改动。

### Coverage and acceptance state

- Structural migration and scope assertions: **PASS** via the migration manifest and structural verification.
- Normal/extreme/large/empty/loading/return design coverage: **represented by the approved C references and preserved state/data contracts; browser state rendering not run by implementer**.
- Same-data visual comparison, overlap, and tool fit at 1280/1440: **NOT VERIFIED**; root owns independent visual acceptance.
- Independent browser visual acceptance and full-page consistency: **NOT VERIFIED**; root must complete this gate.

Frontend audit scope: trigger was a frontend layout-affecting change; in scope are the holdings title-row summary, adjacent search/export context, and holdings table; excluded are other modules, persistence, and shared builders. No browser or database writes were performed by this bounded SVG migration.
