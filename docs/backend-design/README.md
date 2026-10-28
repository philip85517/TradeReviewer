# 后端业务与数据设计

这里把业务与数据处理设计按“用户需要什么 → 功能如何拆解 → 领域与模块如何分工 → 对象如何协作”组织。阅读顺序与视觉规范的总分结构一致，面向业务审查、开发和验收。

本轮范围由用户确认：**全项目功能与领域总图，深入导入、存储、读取协议、校验和首页／交易库供数；其他领域保留职责与接口概要。现状和目标分开成文。**

1. [现状说明](current-state.md)：解释当前实现及已发现的设计缺口，附可定位的代码与诊断证据。
2. [目标设计审查稿](target-design.candidate.md)：模块级候选设计，审查处理对象、数据对象、职责和协作约定；尚未批准，不作为实现指令。
3. [后端设计审查地图](../../.scratch/backend-design-wayfinder/issues/00-map.md)：记录需要用户逐项判断的设计问题。开放问题通过本地 tracker 查询，地图只索引已决策事项。

两份文档的章节编号分别以 AS、BD 标识，避免把当前行为误读成目标规则。模块名称描述业务职责，不要求每个对象对应一个类，也不代表把浏览器计算全部迁入服务器。

## 数据库建模专项审查

**数据库现状、开源对照与多Agent意见已单独整理，供审查对象与保存规则时查阅。** 从[专项阅读导航](database-review/README.md)进入，先看[综合结论与问题树](database-review/REVIEW.md)，再按需查询逐表字段和三份独立意见。该专项不修改或自动批准上述两稿，也不改动既有阅读器评论版本。

## 首页与交易库读取接口专项

**页面所需的摘要、分页和详情需要与原始事实、校验和追溯分层设计。** [读取架构与接口审查稿](page-reading-architecture.candidate.md)结合 34 MB 响应的诊断，以业务旅程、模块职责、候选接口、版本和验收要求说明问题；[决策地图](../../.scratch/page-reading-architecture-wayfinder/issues/00-map.md)跟踪尚待审核的选择。该稿为候选设计，不意味着接口已改造或一秒目标已通过，财务与 Bars 暂停状态保持不变。

[多 Agent 独立审查意见](page-reading-architecture-review-2026-10-29.md)汇总模块、性能及接口的可行性判断、反例、实施前缺口和验证顺序。

## 数据库模块重设计：B方向

**用户已选择按业务职责组织模块，具体约定等待审定。** 新的[数据库模块设计审查稿](database-module-design.candidate.md)集中说明成交提交、来源材料、一致读取与运行支撑怎样协作，包含对象、并发、重复请求、迁移和验证要求；它细化原目标稿相关章节，未授权产品实施。独立可实施性检查与状态见[本轮记录](../../.scratch/database-module-redesign-2026-10-26/README.md)。财务与 Bars 继续暂停。

## 交互审查入口

**正文先讲业务结论，技术详情按需展开。** 两稿都设有术语说明；专业人员可以展开对象、规则与源码证据。选中正文后点击“评论”，可保存原文意见、回复、评审及导出。现状和目标分别保存评论。

- [现状说明阅读器](review/current/index.html)：先理解当前链路和问题。
- [目标设计阅读器](review/target/index.html)：再审查建议职责和待决定事项。
- [使用与维护说明](review/README.md)：构建方式、评论保存位置和版本约定。

在项目目录运行：

```sh
python3 docs/backend-design/build-review.py
BACKEND_REVIEW_PORT=3094 sh docs/backend-design/start-preview.sh
```

启动后打开 [现状说明](http://127.0.0.1:3094/backend-design/review/current/index.html) 或 [目标设计审查稿](http://127.0.0.1:3094/backend-design/review/target/index.html)。脚本默认端口为3091；本轮该端口已有其他工作树的审查服务，因此显式使用3094。端口被占用时启动会失败，不会自动切换。

本轮只整理设计审查材料和阅读工具。财务 P1/F07 与行情柱线（Bars）任务保持原暂停状态，原失败记录和验收轮数不变；未修改产品或交易数据库。阅读器验收记录见[本轮记录](../../.scratch/backend-review-reader/FINAL-ACCEPTANCE.md)，不代表产品问题已修复。
