# 复盘页视觉规范 V1.0

State: open
Status: in-progress
Assignee: coordinator

用户范围：2026-10-22「范围仅限定在复盘工作区」。交付为设计稿与规范；不修改业务实现、首页或历史列表，不操作业务数据库，不提交远端。

输出：`docs/design-system/baselines/2026-10-22-review-workspace-v1.0/`。

流程：梳理权威来源 → 视觉契约及元素覆盖 → 静态设计图与规范 → 独立看图审查 → 协调者检查文档预览与链接。

整页视觉与规范负责人：coordinator；静态画板实现：Luna gpt-5.6-luna（high）；数据/持久化契约负责人：coordinator（本轮仅定义，产品接线不适用）；独立视觉审查：另行派发未实现画板的 reviewer。

触发：设计优化及视觉检查，按 docs/agents/frontend-control-audit.md。检查范围为本轮静态规范、画板、文档阅读器；业务控件的运行、真实图表回放、持久化、真机键盘不在本轮实现范围，不声明通过。画板为合成数据设计稿，不冒充业务截图。

参考与覆盖：[DESIGN-COVERAGE](DESIGN-COVERAGE.md)、[视觉契约](visual-contract.md)。

最终结果：静态设计范围PASS，10/10画板经未实现者直接浏览器复验；最终证据见 docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/acceptance.md 与 independent-review.md。业务实现、数据库、真实触控与真实回放均NOT APPLICABLE，不能用本结果替代实施验收。

## 全文结构改写
[02 — 全文论述结构扫描与改写](issues/02-editorial-rewrite.md)：accepted。导言和10章已完成问题扫描及全文重组，保留规则与画板；本次文档证据见输出目录`evidence/editorial-rewrite/verification.md`。原画板验收历史保持原范围。

## TradingView 参考补充（2026-10-24）

[03 — 工具栏与回放条对齐](issues/03-tradingview-toolbar-alignment.md)：已归档用户直接参考，待逐项设计与核验。以上静态 PASS 为历史版本结果，不覆盖本次新增要求。

## 文档设计任务地图（2026-10-24）

根据当前评论与 TradingView 截图建立[复盘工作区文档设计任务汇总](../review-workspace-design-map/README.md)与[决策地图](../review-workspace-design-map/issues/00-design-map.md)。后续先解决设计决定，再执行全文和画板修订；本次建图不改变历史验收结论，也不代表新版已制作完成。
