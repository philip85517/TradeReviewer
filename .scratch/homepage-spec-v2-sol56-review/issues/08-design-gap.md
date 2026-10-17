# F08 低频查看与搜索的细粒度路径缺失

State: closed
Status: accepted
Assignee: coordinator
Priority: P2
集成负责人: coordinator
Blocked by: 无；仅记录问题，本轮不实施

## Scope / What to build

设计规范修订，不直接修改业务产品。搜索文字要求清空入口但图未画；全称/详情仅有最终态及部分Esc注记，外部点击和焦点路径未闭合。

## Refs

冻结V2：HP03/05；search-open.svg；search-selected.svg；holding-detail.svg。关联评论：C11 C22 C39。审查证据见 ../REVIEW-SUMMARY.md 及三份独立报告。

## 验收与反例

- [ ] 补清空/无结果/关闭，hover与focus退出，详情外点策略与关闭后原行焦点。
- [ ] 正文、控件样例和对应实际渲染一致；原始评论子要求逐项可定位。
- [ ] 独立审查者检查相同视口及相关状态；不得以有标题/有矩阵格替代覆盖。

证据：本报告所述现状是未通过反例，未进行修复或复验。

## V2.1 修复复验（2026-10-17）

原FAIL证据保留如上；本问题已在独立V2.1静态复核中通过。精确图稿、旅程和证据见 `.scratch/homepage-spec-v2.1/DESIGN-COVERAGE.md` 与 `independent-review.md`。仅设计修复关闭，非业务产品验收。
