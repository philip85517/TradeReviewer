# 原生 TradeReview 样板实现记录

## 实现

- 实际 model：gpt-5.6-luna（`design_sample` 任务身份）。
- 新增 [recall-design-prototype.tsx](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.tsx)：合成日 K fixture、原生 `RecallWorkspace` 入口、session 内存 repository、S0 计划、三笔成交、阶段截止与原生 Text drawing。
- 新增 [recall-design-prototype.css](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/design-prototype/recall-design-prototype.css)：推荐模式 scoped CSS，统一控件/标题/正文/图标层级、蓝色主按钮和窄屏自然滚动布局；baseline 保留原样式。
- 为推荐样板增加 opt-in 预览 seam：[`recall-workspace.tsx`](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/recall/recall-workspace.tsx) 的 `designPreview.safeStageProjection` 仅投影已揭示决策并隐藏未来统计分母；[`replay-chart.tsx`](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/chart/replay-chart.tsx) 传入明确 LWC 字体；[`drawing-canvas.tsx`](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/components/chart/drawing-canvas.tsx) 仅推荐 Text 绘制使用 400，未传入时保持生产默认。
- 更新 [page.tsx](/Users/zhoulin/.codex/worktrees/f42e/TradeReview/app/page.tsx)：开发环境支持 `?prototype=review-design&mode=baseline|recommended`，省略或使用其他 mode 时默认为 recommended。

fixture 包含首笔买入 1000 股 @56、持仓减仓 600 股 @64、最终退出 400 股 @70；S0 计划 entry 56、stop 52、target 68、quantity 1000、capital 200000 CNY。原判断为多行中文 Text，持仓阶段补充单独保留，均带 knowledge cutoff；页面明确“样板内存保存，刷新重置”。图表仍由正式 `ReplayChart` / `RecallWorkspace` 渲染，没有 SVG mock。

## 验证

- `npm run typecheck`：通过。
- `curl http://127.0.0.1:3064/?prototype=review-design&mode=baseline`：HTTP 200，服务返回样板入口。
- 浏览器真实下一根、同周期阶段切换、原生 Text 编辑、双截止、窄窗口视觉与未来统计分母：待 root 独立验收，当前未宣称通过。
- 推荐 CSS、推荐安全投影与 opt-in 字体/文字 weight：已实现；root 仍需在真实浏览器复核 computed 样式、1440/1280/390 视口截图、切换阶段后的已知决策导航和统计表现。

## 基础 fixture 校准

- 移除了 header 中硬编码的 `S0` 阶段文案，避免切换阶段后产生错误标识。
- `1W` 改为通过现有 `aggregateCandles` 从日 K 聚合，保留周线的 `tradingDates` 与最大 `knowledgeAt` 截止。
- 中国市场成交改为 09:35 Asia/Shanghai（01:35Z），日 K 收盘截止改为 15:00 Asia/Shanghai（07:00Z）。
- 原判断扩展为完整多行中文，明确原文、关键判断、56/52/68 价格、1000 股/200000 元计划、失效条件和未来信息保护边界。
- 校准后再次运行 `npm run typecheck`：通过。
- 根据真实基础 journey 反馈，成交 source 已补齐 `tradeNature: "simulation"`、统一 `simulationRunId` 与 `feeStatus: "reported"`；样板市场改为支持时区的 `CN-SH`，原判断 anchor 提前到左侧并增大 Text 宽度。
- 样板默认以 `focused=true` 启动并接入 `onFocusedChange`，让图表优先；原生侧栏仍保留未来决策记录，未用 fixture 隐藏。基础验收确认真实 bar、买入 marker、双截止和 Text Control+Enter 保存。

## 推荐样板边界与未验证项

- 推荐 mode 使用 `safeStageProjection=true` 作为明确的样板预览语义：导航只列当前已知成交所属决策，并保留首笔买入计划占位；当前统计只显示已揭示数量。baseline 不启用此配置，继续保留原生行为供对照。
- 推荐 mode 在图表上方显示由当前 `phase`、`historyMode`、`alignedMarketCutoff`、`executionCutoff` 与 `hasSeenFuture` 组成的上下文条，明确阶段、双截止、完整历史/回放模式与补记来源，不写入状态。
- 推荐 mode 的图表/计划区与回放条均恢复自然高度（`chart-and-plan` 不参与 flex 压缩、`position-strip` 不抢占剩余高度），窄屏图表固定 220–240px 后由页面纵向滚动；推荐主动作仍为实心蓝，快照留存为次级动作，粗指针控件最小 44px。
- 推荐 mode 在图表/计划区之后提供图上同源的“文字标注原文”入口，按“入场前原判断 / 持仓阶段新增 / 退出后新增”分组，读取当前 `visibleDrawings` 的完整原文、阶段与 `recallHasSeenFuture` 来源状态；每条可通过“选择图上文字”回到真实图层选择态。桌面默认折叠但入口可发现，窄屏自动展开，全文不受图表壳层裁剪。
- 推荐 mode 1440/1280 视口将图表收敛到 360–460px、计划栏限制在独立可滚动的 360–500px 范围，保留计划字段但让回放主动作在首屏自然可见；计划边界提升为 `#58708f`，控件为 13/20 weight 500，选中态 600。
- 推荐 mode 使用 `'Geist', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif` 和 12px LWC layout 字体；Canvas Text 的真实几何仍由既有 14px/21px 计算，只有字体 weight 通过 opt-in 改为 400。
- 推荐 mode 将真实当前可见 K 线的 OHLC 读数作为 `ReplayChart` opt-in 外部兄弟节点渲染，图内旧读数仅在未启用预览时保留，因此不会覆盖计划价标签；开/高/低/收四项完整保留并允许窄屏换行。推荐态 local-data badge 保持 36px 纯图标（aria label 与原弹窗入口保留），coarse pointer 扩为 44px。
- 文字证据的来源只显示可证实的人话标签：“未看后续”或“已看后续 · 复盘补记”；来源辅助文字为 12/18，原文按最多 680px 排版以保持中文阅读宽度。
- 推荐态文字证据 `<details>` 使用显式受控 summary 开关，避免原生 `onToggle` 回写导致展开状态在截图或选择图上文字后意外收折。901px 边界前将工作区头部切换为三行可滚动工具栏布局，避免阶段按钮、设置按钮和样板标签互相覆盖；计划栏交互 input/select 边界为 `#58708f`，字段标签为 13/20。
- 推荐样板通过 `body:has(.design-prototype[data-mode="recommended"]) { overflow: auto; }` 解除生产工作区的 body 滚动锁；展开计划和完整文字证据现在可沿自然文档流滚动，baseline/default 保持原 body 行为。
- 推荐态 901–1200px 增加 scoped stacked-chart 覆盖：解除原生 220px shell/drawing-toolbar `max-height`，让壳层自然容纳 360px chart-stage 与外置 OHLC；≤900px 继续使用 220–240px 图表规则，1440/1280 桌面保持原推荐高度。
- 推荐态 More/记录展开增加同一组 scoped natural-flow 覆盖：仅当真实 `data-open="true"` 时解除生产回放栏的 bounded grid/flex track、图表壳层 220px 上限与记录 body 的剩余空间预算；阶段图表继续按 ≤900px 240px、901–1200px 360px、桌面 360–460px，外置 OHLC 计入壳层自然高度，完整动作与记录随页面滚动可达。More 开关、计划关闭、双截止与回放状态链未改。
- 推荐图表壳层在窄屏、计划展开和 More 展开路径统一保留 `position: relative; top: auto`，使真实 `recall-fit-all` 绝对定位继续锚定图表；1201px 以上 More 展开显式恢复桌面 `clamp(360px, calc(100dvh - 460px), 460px)` stage 高度，避免导航展开时重新落回原生 220px。
- 推荐态计划展开的 chart-shell/drawing rail 解限覆盖扩至全部 `>=901px`；901–1200px stage 固定 360px，1201px 以上 plan-open 与 More-open 均显式恢复桌面 clamp，覆盖导航展开导致的原生 220px container 规则。
- `npm run typecheck`：通过（推荐 seam 和 CSS 完成后再次通过）。未运行全量套件，也未修改共享主题/业务库。
- 未验证：root 的独立浏览器 computed 字体与颜色对照、推荐 mode 的 390x844 自然滚动和 220–240px 图表、完整计划及 source badges 可读性、推荐 mode 下一根/Text/双截止 journey 冷启动稳定性。
- 触控物理操作：NOT VERIFIED；推荐样板已为 coarse pointer 的工作区、图表工具栏、数据徽标和绘图工具统一预留 44px hitbox，待 root 独立浏览器检查。
