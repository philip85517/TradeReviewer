# 策略 Portfolio 历史回测

日期：2026-09-29

## 2026-09-30 第一轮反馈与下一步

已按用户反馈发布[策略库、三类策略包与实验规格](../../docs/specs/2026-09-30-strategy-library-and-experiments.md)，保存[图 1 原始参考](references/2026-09-30-round1-experiment-list.png)。策略库独立管理完整策略，由标的筛选、买入信号、止盈止损三类包组合；实验选择已有策略，允许就地新建和复制历史策略，在指定区间运行并收集结果。新增范围尚未实现、尚未接受。

工作台反馈同时形成[TradingView 风格比较与稳定布局方案](../../docs/specs/2026-09-30-strategy-stable-workbench-design.md)：紧凑摘要、固定图表框架、图下回放条和固定检查区；播放/暂停同槽，结果/比较共享框架，原有时间安全与来源返回保留。两张原始截图已归档；A 原型的 UR01–08 已完成真实图表、固定控件、跨模式返回和两档连续帧修复，证据见[第三轮验收记录](workbench-design/REPAIR-03-ACCEPTANCE.md)及[修复记录](comments/strategy-visual-11/2026-09-30-a-repair-resolution.md)。最终持仓/现金一致性补充复核已通过；任务 11 仍等待 09 共享导航整合和首次用户任务研究。

工作台第四轮已按原站主题、字体、品牌及控件样式对齐，保持已选A布局和时间行为；见[风格验收](workbench-design/STYLE-04-ACCEPTANCE.md)与[当前预览](http://127.0.0.1:3051/?variant=A&scenario=complete)。本轮桌面回归及独立视觉通过，任务11仍待共享导航整合。

下一步顺序：

1. [09 — 策略库交互模型](issues/09-strategy-library-interaction-model.md)与 [11 — 稳定工作台交互模型](issues/11-stable-workbench-interaction-model.md)：09 [整体模型获用户认可](comments/strategy-visual-09/2026-09-30-feedback-resolution.md)，修订04在现有包管理基础上纠正实验入口，库只管理策略，“我的实验”负责列表、新建和选择策略，见[我的实验画板](http://127.0.0.1:3062/#f14)及模型M13；新增具体画板供审阅，整票接受单独记录；11 已交付[工作台视觉交互模型](workbench-design/README.md)，A 的 UR01–08 桌面修复已记录并通过 scoped review，补充数据一致性复核也已通过，下一步对齐导航、身份与返回契约。
2. [10 — 验证策略库组装、历史复制与实验创建原型](issues/10-strategy-library-creation-prototype.md)：等待 09、11 合法关闭，再做视觉与可点击原型。09修订05已补齐两个列表顶部搜索/筛选/排序设计，并给出[卡片空间与视觉评估](strategy-library-card-ui-review.md)；修订06继续统一全局元素与用户文案，见[UI06契约](strategy-library-wireframes/STYLE-06-CONTRACT.md)及模型M15。卡片改版尚为建议，真实检索和返回状态待本票验证。
3. 既有 [05 工作台](issues/05-observation-rebalance-prototype.md) → [06 结果比较](issues/06-comparison-results-prototype.md) → [07 完整交接](issues/07-design-contract-decision.md)，均承接新策略契约。
4. [01 正式功能总票](issues/01-strategy-portfolio-spec.md)仍等待设计地图完成，再拆生产纵向切片。

策略库与A的共同入口、身份和返回以[V1融合契约](../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)及[融合阅读入口](v1-integration/README.md)为准；修订06和A各轮证据仍独立，两个预览尚未共享创建/运行状态。

09 为 open / prototype-feedback / Codex 主协调者；10 保持 open / ready-for-agent / unassigned（仍被依赖阻塞）；11 为 open / integration-pending / root；A 的 UR01–08 桌面修复已通过 scoped review，持仓/现金一致性补充复核也已通过，09 共享导航仍待完成。05 保留已领取的 prototype-feedback 状态，新增 10、11 前置。编号保留历史身份，执行以依赖为准。见[策略库覆盖](DESIGN-COVERAGE.md#第一轮策略库反馈2026-09-30)、[稳定工作台覆盖](DESIGN-COVERAGE.md#稳定工作台反馈2026-09-30)及[文档检查记录](strategy-library-spec-verification.md)。09 的[模型审阅记录](strategy-library-model-review.md)与[画板启动说明](strategy-library-wireframes/README.md)已提供；静态渲染不替代用户决定或任务 10 的可点击功能原型。规格发布阶段只写文档；随后授权的模型设计不改产品代码或操作数据库。

## 既有规格与记录

- [产品规格 v1](../../docs/specs/2026-09-29-strategy-portfolio-backtesting.md)
- [桌面端视觉与交互设计方案 v2](../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)
- [桌面设计规格任务](issues/08-desktop-ux-design-spec.md) · ready-for-agent，设计供审阅，窄屏暂不修改
- [01 — 策略 Portfolio 历史构建与回测功能规格](issues/01-strategy-portfolio-spec.md)
- [策略观察者：从视觉原型确认完整使用动线](issues/02-visual-journey-map.md)
- [仓库核对依据](REPOSITORY-EVIDENCE.md)

本次已整理规格、本地任务与两轮可点击设计原型；没有生产功能实现、远端发布或业务数据库写入。`ready-for-agent` 表示规格任务可供后续领取，不表示设计默认值已获用户确认或功能完成。

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 需求 R01–R06 与产品/架构规格 | 已整理；默认设计供审阅 |
| 测试边界核对 | 桌面 v2 历史已确认完整桌面旅程与独立风格对照；2026-09-30 新增策略库及跨状态几何/视野验收建议已提出、尚未收到答复；真实引擎/生产持久化未验收 |
| 用户角色 | 已确认 A：策略观察者，策略自动执行 |
| 视觉与动线 | A 分步向导与旧创建操作已获认可；策略库整体模型获认可并追加现有风格兼容/详情回退；规模管理M12/F10–F13及稳定工作台按09/11各自范围验证 |
| 实现 | 桌面 v2 已通过原范围技术验收；新增策略库与稳定布局未实现，生产实现未开始 |
| 正式功能、状态安全、真实图表、视觉与持久化验收 | NOT VERIFIED，待正式实施；不与原型切片证据混用 |
| 创建/运行原型验收 | 既有切片技术与视觉PASS，创建操作已接受、工作台设计待反馈；数据库不适用 |

后续派发前必须按当前项目工作流更新 DESIGN-COVERAGE.md，引用已批准的规格/元素/准确画板，分配整页视觉与完整数据流负责人，并拆分纵向任务。桌面 v2 技术证据见[最终验收](../strategy-desktop-ux-v2/FINAL-ACCEPTANCE.md)；新增策略库与稳定布局尚未整体接受；工作台 A 仅布局方向获选，不把旧参考、局部选型或文档覆盖当成新视觉验收。以下各轮原型记录保留为历史，服务状态不由本次文档工作重新验证。

## 继续设计

运行 `python3 .scratch/strategy-portfolio-backtesting/frontier.py` 查看当前可领取问题；`--all` 查看全部决策与阻塞，`--mermaid` 查看依赖。下一轮从首个 frontier 开始，每次只解决一张 HITL 决策票。首次 A 确认角色；预览后的第二次 A 确认分步向导结构，均不代表其余规格默认值获批。

## 首轮可点击原型

- [A：分步向导](http://127.0.0.1:3047/?prototype=strategy&variant=A)
- [B：连续工作台](http://127.0.0.1:3047/?prototype=strategy&variant=B)
- [验收与问题修正记录](prototype-acceptance.md)

此段为首轮原型历史记录：主导航票已按用户选择 A 关闭；固定起点与七个合成日，第二策略仅结果对照。后续创建已接受，运行第一切片已进行，当前进度见上表与后文。返回实验列表/重开只保留内存状态，刷新重置。正式功能未实现、未接受，真实交易数据未修改。

### 启动

在此工作区根目录运行，首次需 `npm ci`：

```sh
TRADEREVIEW_DB_PATH="$PWD/.scratch/strategy-portfolio-backtesting/prototype-isolated.sqlite" npm run dev -- --hostname 127.0.0.1 --port 3047
```

原型不访问数据库；显式隔离路径防止误入正常首页时连接共享业务库。服务于本轮重启（session 55584）；重启前核对端口归属。遵循[开发工作流](../../docs/agents/development-workflow.md)。

## 第二轮创建原型（创建操作已接受）

沿用已确认 A 与现有 TradeReview 风格，处理历史设置、多策略包、组合预览和数据异常。见 [创建契约](creation-visual-contract.md) 与 [独立验收](creation-acceptance.md)。用户已反馈操作基本符合预期，创建设计票按该反馈关闭；这不代表后续桌面 v2 控件改进已经接受。

- [当前创建流程预览](http://127.0.0.1:3047/?prototype=strategy-create&variant=A)
- 支持历史设置、多策略包及独立调仓预设、组合预览、准备运行与内存重开，含四种覆盖场景。
- 类型检查、构建和独立浏览器/视觉对照已通过；详见验收记录。真实数据/回测/持久化未实现。
- 风格约束持续适用于后续页面，本轮验收不自动批准运行与结果设计。

## 工作台原型第一切片（可试用）

用户接受当前创建操作，指出准备页缺少开始按钮。创建票已记录反馈，开始→逐日运行→调仓→回看→内存重开的真实图表旅程已通过独立验收；工作台设计尚未接受。见 [运行契约](running-visual-contract.md)与[独立验收](running-acceptance.md)。

当前同一预览入口的准备页已提供“开始回测”，支持播放/暂停、期限终点、A/B标的K线与组合净值、独立组合和事件。使用合成数据/模板/小数股/零费用，不能作为真实策略结果。类型/构建/浏览器/视觉PASS，保存失败与中断等后续场景仍未实现。启动命令沿用上文，服务session55584。

## 桌面 UX v2 设计方案（历史规格阶段）

用户要求将[UI/产品评审](design-review-2026-09-29.md)除窄屏外生成设计方案，并确认完整桌面旅程验收。已发布[方案正文](../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)与[本地规格票](issues/08-desktop-ux-design-spec.md)，覆盖全局组合身份、净值总览、时间/回看、配置派生、结果比较、创建控件与说明层级。详见[文档检查记录](desktop-spec-verification.md)。

本轮只改设计文档与任务索引，未改原型页面、未运行产品测试、未操作数据库、未提交远端。后续仍由既有工作台/比较/交接决策票逐步验证，不把本稿建议当作用户已接受的新视觉契约。窄屏暂缓且不作为当前改版的专项验收项。

后续技术实施已完成并合入 master（PR #35），详见 [v2 最终验收](../strategy-desktop-ux-v2/FINAL-ACCEPTANCE.md)。以上“本轮”指旧文档生成阶段；2026-09-30 新的策略库反馈及下一步以本页首节为准，技术接受不替代新增范围的模型反馈。
