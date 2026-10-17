# F04 范围与日期切换缺身份化成功失败和竞争分镜

State: closed
Status: accepted
Assignee: coordinator
Priority: P1
集成负责人: coordinator
Blocked by: 无；仅记录问题，本轮不实施

## Scope / What to build

设计规范修订，不直接修改业务产品。有原子更新声明，缺A→B→C乱序、失败回滚、重试中切换；日期分镜结束于草稿/非法/通用更新。

## Refs

冻结V2：HP03/04/07；visual-design.md:79,124,280；date-draft.svg；state-updating.svg。关联评论：C08 C16 C19 C20 C21。审查证据见 ../REVIEW-SUMMARY.md 及三份独立报告。

## 验收与反例

- [ ] 标注旧/请求中/新scope与日期，定义响应采纳和取消规则；完整展示成功、失败、重试、迟到响应。
- [ ] 正文、控件样例和对应实际渲染一致；原始评论子要求逐项可定位。
- [ ] 独立审查者检查相同视口及相关状态；不得以有标题/有矩阵格替代覆盖。

证据：本报告所述现状是未通过反例，未进行修复或复验。

## V2.1 修复复验（2026-10-17）

原FAIL证据保留如上；本问题已在独立V2.1静态复核中通过。精确图稿、旅程和证据见 `.scratch/homepage-spec-v2.1/DESIGN-COVERAGE.md` 与 `independent-review.md`。仅设计修复关闭，非业务产品验收。
