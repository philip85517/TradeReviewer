# 复盘原型断点与价格轴遮挡

ID: review-audit-14
State: open
Status: in-progress
Assignee: diagnose_short_view
集成负责人: coordinator
Priority: P1
Blocked by: 无

## Scope / What to build

在审阅原型的窄桌面与断点状态消除侧栏冲突、工具条对价格轴的遮挡及信息行重叠。此票是只读审阅产物，不构成修复授权。

2026-11-05 用户在独立复核后明确要求定位并依次修复整体问题，授权覆盖本票范围内的原型修复；上句保留为原审阅时的历史授权状态。本轮先修短高度下审阅条覆盖记录入口与日期按钮，随后另行处理切栏改变价格视野；两项均需独立功能、状态及视觉复核，不以局部实现关闭整票。具体顺序与证据见[修复计划](../evidence/systematic-fixes-20261105/PLAN.md)。

2026-11-05 局部复测：短窗 CSS 调整已冻结为 [candidate-20261105-01](../evidence/systematic-fixes-20261105/candidate-20261105-01/manifest.json)。协调者在 1200×569 实点日期、顶栏记录和第 2 次交易左栏记录，确认对话框可打开、审阅条可隐藏和恢复；常见桌面及 1107/1108、1291/1292 默认侧栏采样可见回放与审阅条。[复测证据](../evidence/systematic-fixes-20261105/task-01-coordinator/REPORT.md)，[独立审查](../evidence/systematic-fixes-20261105/task-01-independent/REPORT.md)。左栏内部滚动、键盘与其他场景尚待完成；价格视野、历史工具条瞬态问题仍未关闭，本票保持 open / in-progress。

## Refs

- [审阅报告与截图](../evidence/independent-design-review-20261028/REPORT.md)
- [布局合同 W07 和空间预算](../evidence/immersive-layout/DESIGN-COVERAGE.md)，[用户反馈修订 R01/R04](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)。

## candidate-v11 追加观察

2026-10-29：据协调者提供的独立审阅结论，1291 初次截图中工具条空白，复测截图图标可见；暂可能是瞬态，不能判定已修复，也不能排除渲染问题。协调者截图：[初次](../evidence/review-fixes-20261028/coordinator/v11-1291-retest-initial.jpg)、[复测](../evidence/review-fixes-20261028/coordinator/v11-1291-entry-retest.jpg)。候选清单：[candidate-v11 manifest](../evidence/review-fixes-20261028/candidate-v11/manifest.json)。截至记录时 v11 独立报告尚未归档；该边界行为仍须在冻结版本重复采集并检查工具条 DOM/绘制状态。

## 验收标准与反例

- [ ] 1280×800 依次展开左栏、切换交易、返回右栏，符合 1292 以下侧栏互斥，图表可读，信息行不重叠。
- [ ] 1291 与 1292 两侧，以及 1440，分别验证交易切换、侧栏开合及工具条不遮挡价格轴/标签；标注视口、DPR、截图和几何。
- [ ] 保留既有工具几何、可点击尺寸、用户选择的 A 结构与时间/价格观察语境，由非实现者比较同态截图。

反例：只在页面初始状态验证互斥；靠缩小字体、遮轴或隐藏主要控件腾出空间。

candidate-v12 / v13 状态追记（2026-10-29）：v12 报告所列 1291 静态截图均见工具图标，但既有 1291 初次空白、复测可见的瞬态疑点仍未排除；静态截图不足以证明稳定渲染。v13 独立报告尚在整理，当前没有可用于判定该边界的正式结论。1291 工具条空白的出现时序、复现性与根因继续 **NOT VERIFIED**，本票保持 open / acceptance-failed。历史证据见 [v11 独立报告记录](../evidence/review-fixes-20261028/final-review-v11/REPORT.md)、[v11 初次截图](../evidence/review-fixes-20261028/coordinator/v11-1291-retest-initial.jpg)和[复测截图](../evidence/review-fixes-20261028/coordinator/v11-1291-entry-retest.jpg)；v12 相关图片见 [1291 入场图](../evidence/review-fixes-20261028/coordinator/v12-1291-entry.jpg)。需对冻结版本重复采集初始与稳定帧并检查实际工具条渲染，不能据旧版可见截图关闭问题。

candidate-v33 追记：1280×800 由28推进到29根时，状态行增加一行使图表顶部下移 17px；右栏收起使回放控件组横移约132px。见 [独立复审](../evidence/review-fixes-20261028/final-review-v33/REPORT.md) 及 [转场前](../evidence/review-fixes-20261028/coordinator/v33-1280-phase-before.jpg) / [后](../evidence/review-fixes-20261028/coordinator/v33-1280-phase-after.jpg)。潜在误触需继续验证，本票保持开放并要求同版断点复测。

candidate-v34 回归追记（2026-10-29，协调者真实浏览器）：在 1280×800 从 28 根推进到 29 根时，信息行高度两态均为 49px、图表 y=154px 不变，播放按钮 x=540.24→540.57px，说明这组状态中旧的 17px 垂直跳动未复现。与此同时右侧操作组仍与关闭按钮几何重叠：1108×800 右栏展开时 `replay-actions` x=284..768，关闭按钮 `replay-meta` x=722..762；1280×800 时分别为 x=370..910 与 x=894..934。见 [v34 1108×800 截图](../evidence/review-fixes-20261028/coordinator/v34-1108-entry-right.jpg) 及 [v34 独立预审](../evidence/review-fixes-20261028/final-review-v34/REPORT.md)。**candidate-v34 整体 FAIL**；上述局部几何结果只绑定 v34，不迁移任何旧版 PASS。问题仍 open / acceptance-failed，修复中；独立复审及最终验收未完成。

candidate-v35 局部回归追记（2026-10-29，协调者真实浏览器）：1108×800 右栏展开时，间距修正后核心“下一回放停点”完全被初始画面裁出；未滚动时原生横向滚动条不可见，鼠标水平滚动后才显示。对照 [滚动前](../evidence/review-fixes-20261028/coordinator/v35-1108-entry-before-scroll.jpg) 与 [鼠标滚动后](../evidence/review-fixes-20261028/coordinator/v35-1108-entry-after-mouse-scroll.jpg)。可发现性 **FAIL**；此为正在修复中的候选观察，不表示 v35 已冻结或通过。需在后续冻结版重新验证首屏可见性、滚动提示/滚动条可发现性、键盘可达及完整控件不重叠，再由独立审阅和 coordinator 最终验收。


candidate-v36/v37 冻结回归追记（2026-10-29）：v36 在 1108px 宽度因样式优先级导致“下一回放停点”被裁切，记为 v36 FAIL，见 v36 对应协调者截图/独立报告（如归档）；不得迁移该版本结果。candidate-v37 已采集真实浏览器 AX/截图，包含 1107/1108、1280、1291/1292、1327/1328、1440 及 390 CSS px 状态；AX 记录含 `1108-entry`、`1108-holding-step`、`1107-boundary-start`、`1107-right-open`、`1291-entry`、`1292-both-open`、`1440-entry-left-open` 等。v37 记录覆盖多视口和若干回合/侧栏状态，但 DPR、缩放、完整拖动与所有组合未证；仅几何/首屏截图不等于整个问题通过。v37 完整报告待独立复审；问题14仍 open，未依据局部观察关闭。详见 [v37 控件登记](../evidence/review-fixes-20261028/CONTROL-INVENTORY-FINAL.md)、[v37 AX 记录](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 与 [版本覆盖记录](../evidence/review-fixes-20261028/DESIGN-COVERAGE.md)。


candidate-v37 独立复审与补充操作（2026-10-29）：[独立报告](../evidence/review-fixes-20261028/final-review-v37/REPORT.md)未在已查看画面发现新 P1/P2 静态视觉阻断，但保留三项 P3，且明确整体视觉、完整交互及用户确认仍 NOT VERIFIED。协调者另外在 1440×900 持仓态拖动时间轴 x850→710；两条已确认 Text 卡片位置变化，内容及日期/价格标签仍可见，见 [前](../evidence/review-fixes-20261028/coordinator/v37-timeaxis-before.jpg)/[后](../evidence/review-fixes-20261028/coordinator/v37-timeaxis-after.jpg)。锚点和成交标记是否始终位于正确时间/价格位置仍未验证，不能据卡片仍可见判断绘图定位通过。该补充不改变问题14仍开放状态。

## candidate-v37 独立实操追加（2026-11-04 至 11-05）

未参与实现的两位审阅者分别在 Chrome、1200×569 CSS、DPR 2 的短窗口重现固定审阅条遮挡：

- 第二回合、左栏展开且页面滚动时，“记录与快照”按钮的中心落在审阅条上；中心点击未打开记录，点击露出的上沿可打开该回合记录。见[遮挡前画面](../evidence/independent-acceptance-20261104/workspace/23-side-overlap-before.jpg)、[中心点击](../evidence/independent-acceptance-20261104/workspace/23-side-overlap-center-click.jpg)、[露出上沿点击结果](../evidence/independent-acceptance-20261104/workspace/23-side-overlap-edge-click.ax.txt)及[几何记录](../evidence/independent-acceptance-20261104/workspace/23-side-overlap-geometry.json)。
- 从左栏记录面板返回后，一次观察中焦点落在顶栏“记录”，而非原左栏触发器，见[返回后的可访问性树](../evidence/independent-acceptance-20261104/workspace/21-records-side-return.ax.txt)。这是额外的键盘返回位置问题，不推断其他入口也有同样表现。
- 页面滚动 y=87 时，审阅条覆盖回放日期按钮的下部及中心，点击未打开日期层；隐藏审阅条后可打开。见[遮挡画面](../evidence/independent-acceptance-20261104/visual/default-date-dialog.jpg)及[打开后的日期层](../evidence/independent-acceptance-20261104/visual/default-date-modal-open.jpg)。

这两项是上述视口与状态下的实际点击失败，不推断其他窗口高度也失败。独立审阅者在 1280×800、同一第 2 回合结束态、左开右收时复测，记录按钮中心命中自身且点击可打开记录，页面 `scrollY=0`；该状态未复现左侧记录按钮遮挡，见[中心点击](../evidence/independent-acceptance-20261104/workspace/39-1280-center-click.jpg)和[几何](../evidence/independent-acceptance-20261104/workspace/39-1280-side-geometry.json)。这不是对 1280×800 所有控件的整体通过。应分别在短高度滚动状态、约定桌面高度和相关断点复核命中；本票继续 open / acceptance-failed。本记录只登记验收结果，不构成修复授权。

### 侧栏开合改变价格视野

独立审阅者在 1440×900、同一 49 根行情和成交截止状态下观察左右侧栏：图表和价格轴画布始终位于 `y=154`、高 `598px`。保持左栏打开、展开右栏前后，72.50 标签的像素行从 `181–189` 移到 `169–177`，32.50 从 `722–730` 移到 `739–747`，两者间距变大；保持右栏展开、收起左栏时，两标签又分别移到 `177–185` 与 `728–736`。同一价格的相对纵向尺度发生变化，不能满足 W07 侧栏开合保持价格观察语境的合同；I07、I29 的该门槛 **FAIL**。见[像素测量与图表几何](../evidence/independent-acceptance-20261104/workspace/40-1440-price-axis-measurements.json)、[右栏关闭](../evidence/independent-acceptance-20261104/workspace/40-1440-left-open.jpg)、[双栏展开](../evidence/independent-acceptance-20261104/workspace/40-1440-both-open.jpg)及[右栏展开左栏关闭](../evidence/independent-acceptance-20261104/workspace/40-1440-right-open.jpg)。时间轴标签变化可能来自宽度变化后的重新排布，实际时间范围是否改变及根因均未验证。

- [ ] 左右侧栏分别开合时保持既有价格视野和时间观察语境，按同一行情与成交截止状态记录坐标和前后截图；同时复验 1291/1292 两侧的互斥行为及日期、回放和记录控件命中。

2026-11-05 task 02 首次候选独立复测：在 1440×900、49 根、四种侧栏组合下，价格范围 API 均为 41.8–68，但同一最终 K 的高点从 y=348.076 变至 341.250、低点从 401.006 变至 389.952（图表高度均 627）。因此自动价格轴的视觉位移仍 **FAIL**；同次真实手动价格轴拖动后切栏、以及 28→29→33→34→41→49 回放子路径通过，不抵消该失败。已将反例发回实现者，见[独立复测](../evidence/systematic-fixes-20261105/task-02-coordinator/REPORT.md)；本票保持开放，旧版结果与本次失败均保留。

2026-11-05 候选 `candidate-20261105-02` 补充核验：禁用成交标记参与动态自动缩放后，1440×900 四种侧栏组合下同一 Bar 高低点的屏幕坐标一致；1291/1292、1107/1108 断点和实际价格轴手动缩放后切栏的采样亦保持观察视野，自动缩放模式下 28→29→33→34→41→49 的实际回放可见。非实现者对同版结束态四个侧栏组合及回放节点的静态截图做了[独立视觉复核](../evidence/systematic-fixes-20261105/task-02-independent-visual/REPORT.md)，仅所见截图通过。

同版新增反例：在入场态用鼠标大幅缩放价格轴后推进，41 根时最后一根 Bar 的高低点坐标为 555 / 722（图高 627），49 根低点为 698，部分行情与收盘价位被裁出画布。见[实操数据与截图](../evidence/systematic-fixes-20261105/task-02-manual-replay/observations.json)。回放跟随价格视野 **FAIL**，已返回实现者修复；上述局部通过不能抵消此失败，本票继续 open / in-progress。

2026-11-05 候选 `candidate-20261105-03` 同路径复测：手动缩放后推进至 41 / 49 根，末 Bar 高低点分别为 362.484 / 466.043、347.746 / 451.003（图高 627），成交标记可见且保持手动价格模式；四种侧栏组合与关键断点的采样保持价格及时间观察语境。见[协调者复核](../evidence/systematic-fixes-20261105/task-02-coordinator-final/REPORT.md)、[非实现者视觉对照](../evidence/systematic-fixes-20261105/task-02-final-independent-visual/REPORT.md)。task 02 的采样路径局部通过；历史工具条瞬态和其他未覆盖输入/场景仍开放，因此问题 14 不关闭，也不以局部证据声称整页通过。
