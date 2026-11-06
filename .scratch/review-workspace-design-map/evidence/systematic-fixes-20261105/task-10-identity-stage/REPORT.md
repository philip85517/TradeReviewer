# I11-identity 隔离候选：实现者证据与待验收项

## 定位、范围与结论边界

- 触发：交易列表在 1280×800 进入第 2 次交易后被收起；临时切换提示被回放提示替换，原顶栏无法持续辨认回合。列表、记录弹窗和提示已有 `currentFixture().round`，但原 `.instrument` 副标题只显示“日线 · 合成演示行情”。该缺口见 [candidate-45 原始观察](../task-final-candidate45/independent-trade2-20261106/identity-sample.json) 和本次 [1280 原稿入场](baseline-1280-t2-28-entry.png) / [原稿结束](matched-baseline-1280-t2-49-exit.png)。这是待审设计补充，不声称旧稿违背已定的像素稿，也没有证据表明旧稿草稿串用。
- 候选：在原顶栏副标题的周期与演示行情之间加入已选回合，例如“日线 · 第2次交易 · 合成演示行情”。只引用当前 fixture 已存在的回合名，不新增成交价格、盈亏或结果；其他文字、字体、字号、顶栏尺寸、图表、回放、侧栏及草稿逻辑未改。
- 仅在本目录中制作隔离候选。正式 3091 原稿、视觉规范、数据库和其他历史证据均未由本实现任务修改。相关设计约束与用户覆盖范围见 [问题票](../../../issues/26-review-round-identity.md)、[R01/R02/R05 覆盖](../../immersive-layout/revision-01/DESIGN-COVERAGE.md)。
- 用户明确排除 Text 与 Text、Text 与成交标记的重叠专项；本次未添加自动避让。物理触屏、真实持久化、TradingView 完整功能均不属于本票。
- **本报告仅为实现者观察，不是独立视觉或整体验收。** 由于本会话的 `cua.getState()` 等待 30 秒后超时并重置，本报告使用 Headless Chrome 的 CDP 输入作补充证据；这属于模拟鼠标/键盘，不是物理设备输入，也不把它冒充本项目要求的真实操作验收。在本报告的实现者证据中，独立审阅和协调者真实浏览器验收均为 `NOT VERIFIED`；协调者另告已用 computer use 对照候选与原稿的 1280×720 视口，其操作范围和结果以协调者的独立记录为准，不能外推至本票其他视口。

## 版本、服务和冻结环境

- 工作树 `/Users/zhoulin/.codex/worktrees/80b0/TradeReview`，分支 `codex/review-workspace-visual-spec-v1`，HEAD `270aad42cb807773e716249deb04b03bf53a1e4e`；工作树有未提交设计工作，以内容清单而非 commit 识别候选。
- 原稿基线 `candidate-20261105-45`；复制前九个工作文件及九个冻结快照共 18 项 SHA-256 均一致：[baseline-checks.json](baseline-checks.json)。重新核验 3091 服务的原稿九个 HTTP 响应均与 candidate-45 清单一致：[served-baseline-manifest-final.json](served-baseline-manifest-final.json)。
- 候选九个文件及 SHA-256：[manifest.json](manifest.json)。唯一变化文件为 [workspace.js](workspace-v0.1/workspace.js)，基线 SHA-256 `0504ece60a3f04fc27f78ab13db3f44a8bcfe0ee930bb56a6bcb08be06ff9ca2`，候选 SHA-256 `71803b71b4e69d3fe35eee66e26f7198e802d8c1cc4dd4c2f3d29f92f54c274e`。其余八项 hash 不变。`node --check` 通过。服务 HTTP 响应及隔离目录内容，在截图前后均与候选清单 9/9 一致：[before](served-manifest-before.json)、[after](served-manifest-after.json)，另有匹配基线、补充测试前后清单。
- 候选预览 [3099 工作区](http://127.0.0.1:3099/workspace-v0.1/index.html?variant=A&scene=entry)。服务由协调者启动，核验时 PID 63727 监听 127.0.0.1:3099。重启命令（从工作树根目录）：

  ```sh
  python3 -m http.server 3099 --bind 127.0.0.1 --directory .scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-10-identity-stage
  ```

- Headless Chrome 156.0.8078.81，浏览器 CSS zoom 100%，DPR 1；CSS 视口与截图像素分别为 1280×800、1440×900、1291×800、1292×800。各次新建独立浏览器 target，导航至当前 URL，基线与候选取相同状态；页面滚动位置、几何、输入方式和动作序列保存在 JSON 中。数据为静态合成 `600000-3 / -2 / -1`；无应用 API、业务数据库或写入。
- 项目默认实现模型 `gpt-5.6-luna` 未出现在当前可选列表，使用会话继承模型；协调者负责独立审核。

## 局部覆盖登记

本轮以**身份展示与其上下游**为分母，不是整页全控件普查；候选不改变其他按钮逻辑。下表的“观察”来自 CDP 模拟输入和渲染结果；最终真实输入状态保留 `NOT VERIFIED`。范围内 15 个控件实例类型，1280 与 1440 各一次，共 30 个视口实例：CDP 已操作并记录 30/30；按项目要求的真实鼠标/键盘执行为 0/30，实际点击尝试率、点击覆盖率分别 0/30，不能计算正式结果通过率（已执行真实操作为 0）。状态组合范围为 3 个交易回合 × 3 个阶段 × 2 个视口，共 18 项：CDP 有 18/18，正式真实输入 0/18。1291/1292 的补充观察不并入上述分母。

| ID / 适用对象 | 前置与操作；期待 | 已记录的 CDP 观察 | 项目真实输入验收 |
| --- | --- | --- | --- |
| I01 左侧栏 `[data-action=toggle-left]` | 展开、收起时当前身份连续可见 | 1280/1440，及 1291/1292 空态路径；[主记录](observations.json)、[补充](observations-extra.json) | NOT VERIFIED |
| I02 右侧栏 `[data-action=toggle-right]` | entry 双向切换；不应丢失身份 | 四视口双向切换，[补充](observations-extra.json) | NOT VERIFIED |
| I03–I05 三条 `[data-trade]` | 选择第 2、3、1 回合；标题与选择一致 | 两主视口逐个选择并覆盖买入前、持仓、结束，[主记录](observations.json) | NOT VERIFIED |
| I06 筛选框 `[data-filter]` | 键入日期或无匹配值，仍保留当前身份 | 日期筛选与无匹配均已记录，[主记录](observations.json)、[补充](observations-extra.json) | NOT VERIFIED |
| I07 清除 `[data-action=clear-filter]` | 恢复全部三条交易；身份不变 | 1280/1440 日期筛选、四视口空态后清除 | NOT VERIFIED |
| I08 逐 Bar `[data-action=step]` | 28→29；33→34 揭示实际行情和对应成交 | 两主视口依次有截图、截止和成交标签；断点两侧覆盖 28→29 | NOT VERIFIED |
| I09 下一停点 `[data-action=next-node]` | 29→33→41→49；截止与揭示一致 | 两主视口额外对 33→34 用 step，见下表；四视口有 entry/holding/exit | NOT VERIFIED |
| I10 计划入场 `[data-plan=entry]` | 各回合分别编辑并切换回来，草稿不串用 | 两主视口第 2 次 57.25、第 3 次 58.25，分别切回保持 | NOT VERIFIED |
| I11/I12 顶栏记录及弹窗返回 | 打开当前回合记录并返回 | 四视口显示第 2 次交易，返回后仍为第 2 次，[记录](observations-controls.json) | NOT VERIFIED |
| I13/I14 顶栏返回、关闭 | 打开退出确认，取消后返回当前身份 | 四视口均命中，未确认退出，[记录](observations-controls.json) | NOT VERIFIED |
| I15 弹窗“继续工作” | 返回工作区且身份不变 | 四视口执行；关闭按钮弹窗还分别以模拟 Escape 返回 | NOT VERIFIED |

“导出”和“更多”在原型明确 disabled，属于原有禁用展示，非本轮可点击分母；回放其他工具、Text 布置/重叠、业务保存与触屏不在本票分母。刷新在四视口均观察到页面从第 1 次回到默认第 3 次；这是原型既有内存重置，不是持久化通过。长于现有“第1/2/3次交易”的实际回合名、辅助技术和物理触屏尚未验证。

## 状态与图表观察

两主视口在第 2、3、1 次交易分别走到买入前、持仓和结束，副标题与当前选中回合一致；隐藏列表、筛选掉当前行、清除筛选及关闭右栏后，副标题仍在。第 2 / 第 3 次入场草稿互不覆盖。刷新会重置身份和内存草稿。

第 2 次交易的逐步回放（两主视口均有同样序列；日期为示例数据）：

| 已揭示根数 | 截止日期 | 图上观察到的已揭示成交标签 | 例图 |
| --- | --- | --- | --- |
| 28 | 2025-01-05 | 无 | [1280 入场](candidate-1280-t2-28-entry.png) |
| 29 | 2025-01-06 | 首次买入 | [1280 持仓](candidate-1280-t2-29-holding.png) |
| 33 | 2025-01-10 | 首次买入 | [1280 33 根](candidate-1280-t2-33-holding.png) |
| 34 | 2025-01-11 | 首次买入、加仓 | [1280 34 根](candidate-1280-t2-34-holding.png) |
| 41 | 2025-01-18 | 首次买入、加仓、部分退出 | [1280 41 根](candidate-1280-t2-41-holding.png) |
| 49 | 2025-01-26 | 首次买入、加仓、部分退出、退出 | [1280 结束](candidate-1280-t2-49-exit.png) |

每次推进首个图表 canvas 内容 hash 均变化，截图中可观察 K 线/成交标签改变；28、29、33、34、41、49 的标签顺序如上，并非仅检视状态数字。持仓中右侧为收起轨道，未新增持仓记录。新增副标题仅回合名；该观察不能替代完整行情数据正确性或未来信息的全量业务验收。

## 同态空间对照

1280/1440 的持仓和结束对照中，基线与候选均已输入 57.25；1291/1292 使用默认 56.00。取相同交易、阶段、列表开合、回放截止、CSS 视口、DPR 和数据。几何存于 [主记录](observations.json) 与 [同态基线记录](observations-matched-baseline.json)。

| 视口 | 第 2 次入场 / 持仓 / 结束的同态测量 | 截图参照 |
| --- | --- | --- |
| 1280×800 | 副标题所在容器由 145 增至 171.88 CSS px；顶栏、阶段标签、存储提示、返回/关闭/记录、图表、双侧栏、回放和其逐步/下一停点命中框几何均未变。顶栏 52px；副标题 12px/16px、单行。 | [原入场](matched-baseline-1280-t2-28-entry.png) / [候选入场](candidate-1280-t2-28-entry.png)；[原持仓](matched-baseline-1280-t2-29-holding.png) / [候选持仓](candidate-1280-t2-29-holding.png) |
| 1440×900 | 上述区域含副标题容器的几何均未变；顶栏 52px；副标题 12px/16px、单行。 | [原持仓](matched-baseline-1440-t2-29-holding.png) / [候选持仓](candidate-1440-t2-29-holding.png)；[原结束](matched-baseline-1440-t2-49-exit.png) / [候选结束](candidate-1440-t2-49-exit.png) |
| 1291×800 | 与 1280 同：副标题容器从 145 增至 171.88px，其他登记区域几何未变；单行。 | [原入场](baseline-1291-t2-28-entry.png) / [候选入场](candidate-1291-t2-28-entry.png) |
| 1292×800 | 上述区域含副标题容器几何均未变；单行。 | [原入场](baseline-1292-t2-28-entry.png) / [候选入场](candidate-1292-t2-28-entry.png) |

1291 以下互斥开合、1292 允许两侧同时展开，是原有断点行为；候选未变。以上 12 个候选状态 document 宽度等于视口宽度，最小副标题至阶段标签间隔约 57.52px。实现者对截图的观察未发现副标题截断；独立视觉评定仍待非实现者直接对照，不能由这些数字或实现者自评替代。

## Console、证据与未完成门槛

- 所有本轮 target 记录中 `Runtime.exceptionThrown`、console error/warning、`Network.loadingFailed` 均为 0；该结论限本轮动作和 Headless Chrome。脚本与原始结果：[verify.mjs](verify.mjs)、[verify-matched-baseline.mjs](verify-matched-baseline.mjs)、[verify-extra.mjs](verify-extra.mjs)、[verify-controls.mjs](verify-controls.mjs)、[主记录](observations.json)、[同态基线](observations-matched-baseline.json)、[空态/刷新](observations-extra.json)、[顶栏控件](observations-controls.json)。所有脚本通过 DevTools Input，DOM 只读，不直接调用组件 handler 或注入状态。
- 控件登记参照源码中的稳定选择器，并补存 1280/1440 两视口的完整 AX 树与 DOM backend ID 映射：包括入场左栏展开、入场右栏展开、记录弹窗、退出弹窗、持仓和结束六态。例如 [1280 左栏 AX](ax-1280-entry-left.json)、[1280 右栏 AX](ax-1280-entry-right.json)、[1440 持仓 AX](ax-1440-holding.json)，采集脚本为 [verify-ax.mjs](verify-ax.mjs)。当前回合副标题以 StaticText 出现在入场、持仓和结束 AX 树；这不是辅助技术实机验收。
- 协调者另告已用 computer use 在 1280×720 对照候选与原稿；该独立证据及其覆盖范围由协调者记录。对本报告而言，真实输入与独立视觉门槛仍为 `NOT VERIFIED`；待协调者结合独立视觉审阅和各目标视口证据分别判断功能、状态、视觉门槛，本实现者不作最终通过结论。
- 不将候选写回正式视觉规范，不修改正式预览。刷新持久化、真实交易库、物理触屏及完整 TradingView 功能未验证；用户排除的 Text 重叠专项为 `EXCLUDED`。
