# 02 全文论述结构扫描与改写

ID: STRATEGY-V10-EDITORIAL
State: closed
Status: accepted
Assignee: root（最终全文改写与接受）；library_form_artboards（gpt-5.6-luna，初稿分组）
集成负责人: root

## Scope
按用户2026-10-23要求，先确立论述结构，再安排规则、参数和引用；围绕标题、先总后分、说明目标与取舍，扫描并改写导读及ST01–ST14。正文修订保留既有画稿、业务设计与数据库。为准确显示分组规则，附带修复本包阅读器的 details 分块渲染；不改业务产品。

## Refs
- 正式包 source/visual-design.candidate.md 全文
- 正式包 editorial-audit.md 逐章问题、所有权与验证矩阵
- 正式包 DESIGN-COVERAGE.md 既有元素及来源映射（保持全部业务约束）
- 正式包 evidence/editorial/before.md 改写前快照
- 用户本轮两条要求为本次论述标准

## Blocked by
None

## 验收与反例
- [x] 导读及14章逐项问题记录；不能只汇总泛泛风格问题。
- [x] 每章首段直接回答标题，先目标/判断再展开方案，说明真实取舍；不能机械加标签却保留规则堆积。
- [x] 图例置于解释之后并说明其证明什么；参数与来源为论点服务。
- [x] 章节/元素ID、全部精确规则和数值、21图与两组分镜不丢失、不改变批准性质。
- [x] 协调者逐章读回和独立内容复核；构建及引用校验通过。
- [x] 生产UI/数据库验收不适用；阅读器 details 修复单独执行14处展开/收起、规则分块、锚点及代表状态视觉检查。

## 派发说明
最初正文owner为library_form_artboards；初稿完成后停止其编辑，由root接管唯一正文owner并完成全文改写。root负责扫描记录、证据、构建、接受及任务状态。独立审查design_review只改editorial-review.md。禁止再委派、改画稿/代码/数据库/历史证据、删除规则或静默新增设计。

## 阅读器附属修复 DOC-RULES-01 / DOC-ANCHOR-01
根因：details 分支先删除空行再合并，非表内容变一段，首行是表则后续内容全变表行。目标为正确呈现已有 Markdown 的分段、标题、多表与列表。time_results_artboards（gpt-5.6-luna）唯一负责 build-visual-spec.py 及专用测试；root构建并实际浏览器检查，design_review独立比较展开规则与源文。正文owner不受旧解析限制。范围为14个折叠及直接受影响的目录/评论锚点，不触及评论持久化实现、画稿或产品控件。

## 最终接受

2026-10-23，root逐章读回与真实浏览器接受完成；design_review独立审查PASS。14处折叠与17目录通过，语义/参数/21图保留，原失败与修订历程保留。最终证据与版本绑定见正式包 acceptance.md、editorial-review.md 和 evidence/editorial/acceptance-version.json。未推送、合并或发布。
