# F10 无汇率异常使用了正收益色

State: closed
Status: accepted
Assignee: coordinator
Priority: P2
集成负责人: coordinator
Blocked by: 无；仅记录问题，本轮不实施

## Scope / What to build

设计规范修订，不直接修改业务产品。不可汇总的长横线使用盈利绿色，缺数据与正向收益的语义混用。

## Refs

冻结V2：HP07；state-no-fx.svg。关联评论：C09 C16 C36。审查证据见 ../REVIEW-SUMMARY.md 及三份独立报告。

## 验收与反例

- [ ] 缺失值用中性语义，保留原币与原因入口，并与正常/0/负值对照。
- [ ] 正文、控件样例和对应实际渲染一致；原始评论子要求逐项可定位。
- [ ] 独立审查者检查相同视口及相关状态；不得以有标题/有矩阵格替代覆盖。

证据：本报告所述现状是未通过反例，未进行修复或复验。

## V2.1 修复复验（2026-10-17）

原FAIL证据保留如上；本问题已在独立V2.1静态复核中通过。精确图稿、旅程和证据见 `.scratch/homepage-spec-v2.1/DESIGN-COVERAGE.md` 与 `independent-review.md`。仅设计修复关闭，非业务产品验收。
