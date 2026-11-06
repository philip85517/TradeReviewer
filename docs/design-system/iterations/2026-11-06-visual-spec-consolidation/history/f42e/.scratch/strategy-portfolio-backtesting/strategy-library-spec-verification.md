# 第一轮策略库与稳定工作台反馈：规格发布检查

日期：2026-09-30。范围：用户两次调用 to-spec，把策略库反馈及工作台/TradingView 风格对照固化为规格和本地后续任务；未开发交互模型或产品功能。

## 交付与事实依据

- [规格正文](../../docs/specs/2026-09-30-strategy-library-and-experiments.md)：按 to-spec 七部分模板，包含 SL01–SL09、36 条用户故事、领域边界、验收入口与反例、范围和引用。
- [风格比较与稳定工作台方案](../../docs/specs/2026-09-30-strategy-stable-workbench-design.md)：七部分模板，8 个差异维度、SW01–SW10、31 条用户故事、固定分区和控制语义、状态/来源转移、两档桌面及连续过渡验收目标。
- [09 策略库模型](issues/09-strategy-library-interaction-model.md)、[10 创建原型](issues/10-strategy-library-creation-prototype.md)、[11 稳定工作台模型](issues/11-stable-workbench-interaction-model.md)：均 open / ready-for-agent / unassigned，未领取或关闭。
- [策略库覆盖](DESIGN-COVERAGE.md#第一轮策略库反馈2026-09-30)与[稳定工作台覆盖](DESIGN-COVERAGE.md#稳定工作台反馈2026-09-30)：各12行覆盖需求、关键状态、语义区域、任务责任与证据计划；全部 NOT VERIFIED。
- 原产品/桌面规格增加日期明确的优先级与替代关系；旧 tracker 01/02/05–08 接入新要求；v2 README/最终验收只追加后续范围说明，原技术接受与失败证据保留。
- 用户图 1 按原始字节归档为 [参考截图](references/2026-09-30-round1-experiment-list.png)，2348×1346 像素。SHA-256：`c00a797ae297a70ea720ccc0cbb99d08452745c9bc38438b6a3bd91eb2e547ba`。截图没有 CSS 视口/DPR/缩放信息，不冒充新设计稿。
- [当前工作台](references/2026-09-30-round1-workbench-current.png)：2460×1498 像素，SHA-256 `f1115f0dea3824e6d40c92a225022f8fb5362995d36a1d4a12ddeaed697da2cd`；[TradingView 参考](references/2026-09-30-round1-tradingview-reference.png)：2864×1662 像素，SHA-256 `4561cbd236fca09a68a16fcf19d1f08a8a187a0a3309432aa40ed92683e8e447`。均原字节归档，未知CSS尺度，且静态截图不证明运行时抖动原因。
- 仓库核对：现有创建原型硬编码 EMA/quality 两种策略，选择发生在实验步骤内；没有本轮要求的独立策略库、三类组装和复制策略。现有会话草稿/派生/返回是原型复用边界；策略实验服务仍为生产规格规划边界，不是已实现服务。

## 文档检查

| 检查 | 结果 |
| --- | --- |
| to-spec 模板、19 项需求、67 条连续用户故事、24 条覆盖、三张票必需字段 | PASS；两份规格结构与三票元数据实际检查，24条新增覆盖均NOT VERIFIED |
| Implementation Decisions 无具体实现文件路径或代码片段 | PASS；结构脚本实际检查 |
| 本轮修改/新增 Markdown 的相对链接/锚点、冲突标记及差异空白 | PASS；实际检查18份Markdown、219个本地链接目标、14个标题锚点均有效，无冲突标记；`git diff --check`退出0 |
| Wayfinder 依赖完整、无环、当前可领取票 | PASS；`python3 .scratch/strategy-portfolio-backtesting/frontier.py` 与 `--all` 实际运行 |
| 09与11→10→05→06→07→产品拆票的顺序 | PASS；最新frontier实际输出09、11；10等待09/11，已领取的05等待10/11，06/07保持依赖，01等待地图 |
| 用户原话与已确认/建议/未决内容区分 | 协调者核对：三类包、复制、就地新建、先模型后设计是用户要求；每类包数量、布局和执行细则未伪记为已批准 |
| 独立文档复核 | PASS；策略库初稿由strategy_todo_audit只读复核；工作台由workbench_design_comparison直接查看两张原图、核对旧时间/结果契约，修后复核规格/依赖/覆盖/README无剩余文档阻断 |
| 变更范围与三张原图完整性 | PASS；18份Markdown及3张原图，全部限定设计文档/任务与参考；三图字节、SHA-256与尺寸均匹配原附件；旧03/04及v2实现票未改 |

## 独立审查与修订

`workbench_design_comparison`只读审查发现：①无条件保留旧图可能在早期回看/换组合时暴露未来或串身份；②结果点事件可误解为只换检查区，未同步事件日投影；③10票依赖文字仍有只提09的旧说明。协调者核对旧DD06/DD09后修订WD05、WD04及关系图、WT-C/WT-E和10票，将反例写入覆盖矩阵。另将420–480px覆盖抽屉拟改320px检查区明确列为待11验证的设计变化，保留完整解释与关闭/来源返回语义。此文档审查不构成UI接受。

修后独立复核通过上述三项与覆盖矩阵/README一致性；其附带措辞建议也已落实：README将已确认测试边界明确标为桌面v2历史确认，新策略库与稳定性验收建议仍未收到用户答复。

本轮 to-spec 测试边界已在当前聊天提出核对；截至文档生成未收到答复，规格中仍记录为建议。不能将用户沉默视为批准，也不以此阻止已授权的需求记录。

## 适用性与未完成边界

- 产品测试/构建/浏览器/数据库：NOT APPLICABLE，本轮只改文档及保存参考截图，没有产品代码变化。
- 新交互模型、可点击原型、功能/状态/视觉/持久化：NOT VERIFIED，后续按09/11→10→05/06/07与产品总票逐级执行。
- 未重新验证任何历史服务是否运行，不以旧预览链接声称本轮新 UI 已交付。
- 未修改业务数据、`conf/runtime.json`、应用代码、旧03/04用户 resolution 或v2已关闭实现票；未提交、推送或合并。
- 本记录只接受需求发布工作的文档边界，不关闭任何新增设计票，不替用户确认新交互。
