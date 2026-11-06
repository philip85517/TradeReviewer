# Worktree 文档完整性与截止核对

## 范围和时间

全量路径扫描截止 **2026-11-06 09:38:38 +08:00**；其他 worktree 独立补充审计冻结于 **09:50:49 +08:00**；复制时刻及逐文件 SHA256 见各 manifest。扫描覆盖 11 个注册 worktree 的 tracked 与非忽略 untracked 文档候选：docs/**、.scratch/** 及仓库其他 Markdown/文档扩展名，排除 node_modules、.git、.data、vendor。`.scratch/**` 含测试树、日志和数据库路径，因此下表“候选路径数”并非纯设计文档数。

源任务持续更新，本次是有限采集，不是实时镜像。没有把文件 mtime 当决策时间。原用户决定精确时间已核验的沿用原聊天证据；其他日期只是源文件中的记录日期。忽略文件、未来新增和任意外部路径不在这次全量声明内。

|worktree / HEAD|候选路径数 / 原始差异数|主要文档与最新内容|本轮处理与边界|
|---|---:|---|---|
|master · `d95afc37`<br>`refs/heads/master`|6514 / 12|首页 V2.5、交易库 V2.0 已在基线；B2 hover 旧稿与首页原图|当前规范复用并修订；旧图/旧稿保存在历史目录；备份治理文件和 v2.3 临时 fixture 不作最新设计。|
|baseline · `8c8c66c7`<br>`DETACHED`|8203 / 2883|11/5 临时首页性能比较基线，detached|未发现独有最新设计；由 0dc6/38a0/home-read-mvp 演进版本覆盖；不复制重复实验树。|
|0dc6 · `8c8c66c7`<br>`refs/heads/codex/home-read-mvp-base-20261029`|18619 / 13090|首页开发、数据库 B、导入及读性能；后端候选/任务合同|补齐后端文档及有限设计合同；产品代码、测试克隆和数据库留源分支；旧首页包不覆盖 V2.5。|
|0ff3 · `b95929ad`<br>`refs/heads/codex/holdings-valuation-repair`|2718 / 1320|10/6–10/10 首页校准、调整、估值修复的旧视觉与合同|旧视觉有限资料补入历史；保留旧整体 OPEN/局部接受，不将旧尺寸回灌公共规范。|
|25db · `d95afc37`<br>`refs/heads/codex/trading-library-v2-development-plan`|14881 / 8045|10/26–11/5 用户决定；11/6 视觉、返回和首屏视窗资料|14 条后续决定保全并同步当前业务；产品仍未整体验收；内容变化与练习级多空筛选暂缓。|
|38a0 · `8c8c66c7`<br>`refs/heads/codex/homepage-db-1s-20261105`|20788 / 15177|11/5–11/6 写后预计算设计、恢复第 5 轮与最终评审|保留最新架构/计划和 Round5；后台已接通，恢复 5/5 耗尽，整体验收 FAIL 并暂停；早期未实现表述只代表早期版本。|
|80b0 · `270aad42`<br>`refs/heads/codex/review-workspace-visual-spec-v1`|10659 / 3451|复盘 V1.0、candidate45/direct-v5/identity，11/6 Text 变更|原保全与 3 份最新计划/验收文档补齐；candidate45 默认，其他候选隔离；实际输入与拖动限制保留。|
|b387 · `5a94ee3f`<br>`refs/heads/codex/strategy-design-preserved-20261105`|5583 / 24|策略 V1.0/V1.2 及 SW01–08 公共扩展|原包完整保全，本轮四卡与回放契约修订；额外 23 份 V1 scratch/旧 reader/index 变体独立保留为历史。|
|e7e8 · `7a9a46cc`<br>`refs/heads/codex/visual-specs-consolidation-20261106`|8691 / 0|本整合分支；本轮确认图、最新状态入口和来源核对|作为唯一文档整合入口；ST01/02 已确认，其余暂定；不另开长期分支。|
|f42e · `9c2b3d20`<br>`refs/heads/codex/strategy-workbench-v1-design`|2389 / 426|9/30–10/7 策略旧稿、10/6 最终 DOCX、resume06 最终记录|原 637 文件历史另补 117 份有限依赖和最终文档；不整分支合并产品实现。|
|home-read-mvp · `b49b1706`<br>`refs/heads/codex/home-read-mvp-experiment-20261029`|15458 / 10113|11/6 视图驱动数据模型、字段映射、页面读取/生命周期及专家审查|新后端设计候选单独保存；不以设计评审或合成实验宣称真实产品性能通过。|

原始差异数是采集时源字节在整合树未找到的路径数，含过时变体、重复测试树及产品材料；不等于设计遗漏数，也不等于待提交改动数。各分支当时的完整 git 状态、路径、SHA256 与大小见[压缩全量清单](worktree-inventory.json.gz)，分组计数见[可读摘要](worktree-inventory-summary.json)。

## 本轮补齐与来源

- [复盘/旧策略补充清单](supplement-review-strategy.json)：120 文件，含复盘最新 3 份契约/计划及旧策略 117 份最终文档和有限依赖。
- [其他 worktree 补充清单](supplement-other-worktrees.json)：565 文件；其中独立审计选定 542 份，协调者额外保留 b387 历史变体 23 份。源和目标 SHA256 逐文件登记。
- [确认图清单](alignment-manifest.json)：将本聊天外部视觉目录中的图稿及生成源保全到 alignment/；旧摘要图标为被取代。
- [原完整包的快照与提取记录](../2026-11-06-visual-spec-consolidation/README.md)：保留历史、出处和原评论；本轮修订是派生内容，不伪称修订后仍与原快照字节一致。

|本轮其他补充来源|文件数|性质|
|---|---:|---|
|0dc6|188|最新候选、用户决策或有限历史，按来源清单逐项标识|
|0ff3|39|最新候选、用户决策或有限历史，按来源清单逐项标识|
|25db|96|最新候选、用户决策或有限历史，按来源清单逐项标识|
|38a0|41|最新候选、用户决策或有限历史，按来源清单逐项标识|
|b387-history|23|最新候选、用户决策或有限历史，按来源清单逐项标识|
|home-read-mvp|177|最新候选、用户决策或有限历史，按来源清单逐项标识|
|master|1|最新候选、用户决策或有限历史，按来源清单逐项标识|

最新首页模型入口：[view-driven-data-model](worktrees/home-read-mvp/docs/backend-design/view-driven-data-model.candidate.md)；写后预计算入口：[设计](worktrees/38a0/docs/superpowers/specs/2026-11-05-homepage-write-precompute-design.md)、[恢复第 5 轮](worktrees/38a0/.scratch/homepage-db-optimization-20261105/write-precompute/ROUND-5.md)。最新交易库决定见[覆盖表](BUSINESS-UPDATES.md)，复盘/策略见[当前入口](README.md)。

## 排除与历史链接限制

完整保留的是设计、图稿、生成源、原型、评论/身份、最新决定和有限任务/验收文档；不把所有产品实施目录作为文档依赖迁入。明确排除：嵌套测试克隆与其 app/代码副本、业务/测试数据库、构建与性能日志、DOM/AX 原始转储、大量重复运行截图，以及旧 checkout 中已被更新规范取代的索引。产品代码继续在源 worktree。详细分类见[其他分支审计](audit-other-worktrees.json)的 excluded_bulk。

归档按原字节保存，所以某些历史任务首页仍引用未搬入的产品日志/代码；这不是独立可运行的验收包。源路径和 SHA256 可定位原文件，不能声称历史传递依赖全部闭合。原复盘 .scratch 历史 Markdown 已识别的 225 个缺链目标见[历史缺链清单](historical-link-gaps.json)；当前规范入口和当前必要资源另作静态检查。

## Git 状态与后续管理

所有源 worktree 均原地保留，本轮未改其 HEAD/index、未收纳产品实现、未碰数据库。扫描时的展开状态已入清单；其他任务可继续产生新改动，故不把该清单当实时 git status。local master 的 conf/runtime.json、未跟踪旧稿及 tmp 保持原样。

建议以当前独立分支集中审阅文档 PR，评审后再按用户授权合入 master；其他长期分支先保留或排队，不同时启动新的产品目标。后续仍遵循项目默认一个产品实施目标、至多一个设计收尾目标。历史包只用于追溯，继续修订从当前入口开始；产品分支完成独立验收后再分别推进 PR，避免把已知 FAIL 的实现与文档打包。分支/工作目录清理另核对未提交内容后处理，本轮未删除。

[最终文档验收及远端状态](FINAL-ACCEPTANCE.md)。
