# F07 尺寸与命中区合同不统一

State: closed
Status: accepted
Assignee: coordinator
Priority: P2
集成负责人: coordinator
Blocked by: 无；仅记录问题，本轮不实施

## Scope / What to build

设计规范修订，不直接修改业务产品。局部搜索正文280宽而图350；36默认命中区与Token24、Retry32未区分可见框和点击框。图标应统一资产/viewBox；不同图形墨迹包络本身不是必须相等的硬要求。

## Refs

冻结V2：HP05/08；visual-design.md:188,295,305,309,315；local-search.svg。关联评论：C27 C35 C37 C39。审查证据见 ../REVIEW-SUMMARY.md 及三份独立报告。

## 验收与反例

- [ ] 统一局部搜索尺寸及覆盖/reflow规则；分别标注视觉框、命中区、焦点环；复用同一图标资产。
- [ ] 正文、控件样例和对应实际渲染一致；原始评论子要求逐项可定位。
- [ ] 独立审查者检查相同视口及相关状态；不得以有标题/有矩阵格替代覆盖。

证据：本报告所述现状是未通过反例，未进行修复或复验。

## V2.1 修复复验（2026-10-17）

原FAIL证据保留如上；本问题已在独立V2.1静态复核中通过。精确图稿、旅程和证据见 `.scratch/homepage-spec-v2.1/DESIGN-COVERAGE.md` 与 `independent-review.md`。仅设计修复关闭，非业务产品验收。
