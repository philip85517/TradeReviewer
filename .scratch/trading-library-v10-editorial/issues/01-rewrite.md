# 01 — 按评论重写交易库设计文档行文

ID: TLIB-EDITORIAL-01
State: closed
Status: accepted
Assignee: Luna (gpt-5.6-luna)
集成负责人: /root
Blocked by: None

## Scope
只改正文 source/visual-design.candidate.md 的组织与行文，覆盖开篇、十章、未决项。总分结构，标题聚焦，连贯说明与必要表格结合。不得新增产品决定、改图、修改阅读器或评论状态。保留 BT01–BT10 锚点，全部分镜路径、顺序与内容。

## Refs
- [覆盖表](../DESIGN-COVERAGE.md)
- [修改前正文](../evidence/source-before.md)
- [当前两条评论](../evidence/comments-before.json)
- 原始来源：V2.4.2 HP06/07；共享标准及入口契约：V2.5 source/visual-design.candidate.md。

## 验收标准与反例
- [x] 第一章明确总目标、分目标、取舍与边界；不堆积参数细节。[证据](../evidence/semantic-review.md)
- [x] 开篇先说明用途；引用集中于表，迁移历史放附录。[证据](../evidence/browser-review.md)
- [x] 各章主题聚焦，原有业务规则、字段、数值、异常状态无遗漏/误改。[证据](../evidence/semantic-review.md)
- [x] 术语统一；参数默认值只采用已确认来源，未明确者显式记录。[证据](../evidence/semantic-review.md)
- [x] 所有原图和分镜保留；章节锚点不变；原评论另由协调者映射并保持历史。[证据](../evidence/integrity.json)
- [x] 协调者逐章独立审读、重建与链接核验；本票不涉及产品 UI/数据库验收。[证据](../FINAL-ACCEPTANCE.md)

## 派发说明
唯一可写文件：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md`。不自行再派代理，不运行重建，不修改本票或其他文件。完成后报告实际模型、内容调整、语义风险和未决项。

## 验收证据
[最终验收记录](../FINAL-ACCEPTANCE.md)已由 /root 签署；最终正文指纹及文档检查、浏览器证据均绑定该记录。

## 审查历史
- 2026-10-23 /root 第一轮独立审读：FAIL。开篇版本元说明仍先于用途；三个分目标仍挤在同段；API细节进入正文；新增“一次导入=一次练习”、粒度选择器排除和若干未确认异常动作；普通入口“默认范围”有歧义。已交回原负责人逐项修改，保存 `../evidence/draft-one-not-accepted.md`。未接受状态保留至复核通过。
- 2026-10-23 00:43 /root 最终复核：PASS。上述问题及后续审读发现的规则遗漏均已修正；逐章语义、生成产物、图稿保留、评论保留和真实预览检查通过。详见[最终验收](../FINAL-ACCEPTANCE.md)。初稿失败记录继续保留。
