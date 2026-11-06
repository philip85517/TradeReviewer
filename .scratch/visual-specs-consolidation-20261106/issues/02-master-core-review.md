# 02 进入 master 的核心视觉设计评审

- ID: visual-consolidation-02
- State: closed
- Status: accepted
- Assignee: root
- 集成负责人: root
- 独立审查: master_visual_standards、master_visual_spec、master_visual_closure
- 接受时间: 2026-11-06 Asia/Shanghai
- 接受范围: 内容评审与候选清单，不含设计批准、修订实施或 Git 合并

## What to build / Scope

评审最新核心视觉设计，隔离过时、矛盾内容。比较 master d95afc37d30f817edbd6daab41e85f485138de0d 与保全 HEAD 7a9a46cc3daaf36d98b7f79235eb1f0d841f7f9d；三个独立 Agent 分别审查项目标准、最新需求符合性和文件依赖，协调者直接核对原文。

## Refs

- [处理结论与候选清单](../evidence/master-review-20261106/decision.json)
- [Standards 独立报告](../evidence/master-review-20261106/standards.json)
- [Spec 独立报告](../evidence/master-review-20261106/spec.json)
- [依赖闭包独立报告](../evidence/master-review-20261106/closure.json)
- [现行业务规范](../../../docs/design-system/trading-library-design-spec.md)
- [项目流程](../../../docs/agents/development-workflow.md)

## Blocked by

评审本身无依赖。选集落地须先处理下述合并条件；本票不授权改写未决设计、推送或合并。

## Decision

|内容|处理建议|条件|
|---|---|---|
|首页 V2.5、交易库视觉 V2.0 与现行业务规范|保留 master 已存在内容|不被旧执行契约覆盖|
|SW01–08 与首页公共组合说明增量|精简后纳入|明确首页特例作用域；策略尺寸不作全站默认；保留首页旧锚点|
|策略 V1.2 正文、22 图与生成维护链|作为最新待审方案纳入|先统一主动推进可见新 K 线合同；新增尺寸、摘要与页面分配仍待批准|
|复盘明确的用户决策|另外提炼当前决策摘要|采用现行业务回合定义；右侧两阶段、持仓自由 Text、工具条同比缩小及 11/6 不专项避让的取舍|
|复盘旧正文、candidate45、direct-v5、identity|整包暂缓|原型先审，再回填；助手交付或候选编号不代替批准|
|旧策略 V1.0、f42e/0ff3/B2、过程截图与旧任务契约|排除本次核心选集|原件留保全分支，已采用规则保留精确映射与不可变溯源|

## Findings and merge conditions

Standards：1 项 P2。策略 TIME02 只在右边缘跟随新 bar，与项目及正文的主动推进须显示新 K 线要求不一致；这是设计合同问题，未认定运行缺陷。

Spec：3 项。P1 复盘仍以建仓至清仓划分回合，与当前一次主动平仓形成回合冲突；P1 保留后续反馈已替代的加减仓表单；P2 仍以历史交易库 V1.0 为交接依据。

依赖候选共 67 文件、2,145,175 字节：首页 5、策略 51、SW 11。它是修订前候选，不是可直接 cherry-pick 的补丁；不含未来新增的复盘决策摘要与入口修订。必须迁移旧覆盖表中 74 元素的精确映射，修复删历史后产生的 3 处阅读页链接，并重建文档和身份清单。旧 PASS、失败及哈希按归档版本保留，不继承为精简包新验收。

## Acceptance

- [x] 固定 Git 比较版本，保存三个独立报告与逐文件候选；见 Refs。
- [x] 协调者核对业务规范 65–79 行、复盘正文 165/218/346/571 行、后续 R01–R05 覆盖表与策略 359/373/385 行。
- [x] 当前规范、最新待审方案、明确决策与历史材料分别给出处理建议；见 Decision。
- [x] 直接重读复盘聊天最新用户回合，确认 11/6 取消专项避让的范围；摘录见 decision.json。
- [x] 仅新增本地评审记录；保全原文、源 worktree 与 master 保持原样。

## Counterexamples / evidence

mtime、新版本号、候选编号及静态验收均不等于用户批准。11/6 取消自动避让不代表手动拖动或调宽已验证。旧合成回合样例不能成为现行业务契约。文档评审未运行 UI、数据库或会重写源树的构建；不宣称产品或视觉接受。
