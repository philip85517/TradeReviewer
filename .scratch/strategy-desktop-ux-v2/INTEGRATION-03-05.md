# 03/04/05 并行集成契约

本文件只约定接线，不替代批准规格。依赖01/02接受后实施。root负责整页与跨文件状态；全部模型沿用用户指定Luna6/max，Astra/low独立验收。禁止同时编辑同一文件。

## 唯一写入者

- 03：desktop_workbench_01，running-prototype.tsx、running-prototype.css、running-model.ts、implementation/03.md。01 CSS子任务已结束后回收写权。为04/05提供下列兼容接口并完成所有真实消费者接线。
- 04：desktop_creation_02，creation-prototype.tsx/css、implementation/04.md。多个实验各自持有稳定ID；每个已运行实例保持挂载，visible控制，从而保留图表/结果内部状态。
- 05：desktop_workbench_style_01，新增results-prototype.tsx、results-prototype.css、results-model.ts、implementation/05.md。不能改runtime/creation；消费同一Snapshot/Trade/Calendar账本。结果页真实绘图，不用随机或截图。

## 04提供方/03消费方：派生与列表

running-model导出可选辅助类型（现有RunningDraft字段不破坏）：

- RuntimeProgress：status、knownDate、viewDate，以及可选exposure（date/source/time，字符串）。
- SourceExposure：experimentName、knownDate、可选time。

RunningPrototype在保留原props基础上添加可选experimentName、sourceExposure、onProgress(progress)、onDerive(progress)。03优先发布这些props再做其余接线；04可按此接口实施。

查看配置包含“基于此配置新建实验”；点击先停播再onDerive，原会话保留。04收到配置及来源progress创建独立草稿、撤销partialConfirmed及旧候选；取消/完成可返回原实例。来源提示属于原实验已知边界，不直接把新实验M推进。onStatus保留兼容，onProgress给列表精确进度；隐藏实例不会后台播放。

## 05提供方/03消费方：结果与过程

ResultsPrototype模块导出具名组件，props：

- draft: RunningDraft；calendar: Calendar；strategy: StrategyId；ledger: Snapshot[]；maxCursor: number；initialCursor: number；entryId: number；visible: boolean；可选portfolioName: string（具体组合名称，默认包名）。
- onReturnProcess(): void；onEvent(event: TradeEvent, symbol?: SymbolId): void；onRevealResult(cursor: number): void。

组件保存R/图模式/筛选/滚动；entryId改变时以initialCursor初始化新入口，结果事件回看后重新显示时entryId不变，恢复原R与过滤/滚动。R<=maxCursor，只用该账本前缀。03运行页维护进入结果前V/组合/图表上下文，普通返回恢复该过程上下文；事件回看定位事件日/具体symbol并提供返回来源结果入口。结果模块保持挂载但hidden（图表隐藏resize不得覆盖用户视野）。

03负责T0无区间说明、阶段结果入口默认V、终点主动作查看回测结果及收起失效播放按钮。进入结果停播；主动R超过进入前V调用onRevealResult更新曝光来源，不能改M/重新成交。05不得自行产生未来账本。

结果指标从同一账本核算：收益/最大回撤/调仓数、净值/回撤/标的及现金实际权重、费用0/滑点0说明、换手明确分母；闭合回合净盈亏/未平仓浮盈亏/部分减仓已实现分开，不把部分减仓当闭合回合。贡献与现金合计必须可对账，不支持的统计说明原因。

## 03组合扩展示例

顶部唯一全局选择使用稳定身份，与策略包ID分离；至少两组可用，长名/更多组合为明确标记的合成展示样例，不冒充新插件。各组独立本金/ledger，同步日期；更多组合局部横滚与全部菜单。后续06可按同一组合身份维护Mᵢ，07可消费同一集合比较。

若必须改上述接口，先向root写出具体变更与提供方/消费方，再由唯一owner落地；不能只添加无人调用的callback并声称功能完成。最终root真实浏览器走完整闭环、Astra直接两档截图对照。当前阶段不做06/07范围，也不修改业务页/API/数据库。

实现接口补充：03传入当前具体组合适配后的draft（本金/预设与ledger一致）及portfolioName；结果入口context保留稳定portfolioID，事件回看与来源返回不串组合。更多组合演示至少5组，为后续“最多突出4条而非总数上限”提供可达样例。

完成/回看边界补充：RuntimeProgress可选completed布尔值由M到达终点决定，status仍可为回看中；列表必须区分运行phase与查看状态。完成入口“查看结果”需要实际进入结果，不能只换一个列表按钮标签却仍停在工作台。03/04负责提供显式按实验ID的结果打开请求（不修改旧M），结果打开应明确R并保留原过程V。具体命令字段由两owner同步root记录，不得隐式按每次重开都自动跳结果。

03/04已确认：RuntimeProgress.completed?:boolean；RunningPrototype.openResultsRequest?:number为按实验递增令牌。结果首次进入默认R=当前V；从结果离开列表再开恢复原entryId/R/过滤/滚动；从已继续推进的过程新开结果使用当前V新entry，不能永久锁在首个结果区间。只触发已存在运行实例的可见导航，不改M。03接线，04发请求。

链式派生的已知边界取来源实例已展开/曝光日期及其继承SourceExposure日期的最大值；新实验M仍自己的T0，不复制任何未来数值。
