> 归档副本（2026-10-10）。以下原结论保留原时间和范围；标注“本地历史记录”的文件未随远端归档。当前版本入口见 [版本说明](../README.md)。

# E119–E126 独立视觉复核

日期：2026-10-10。复核者：browser_visual_review，未实施本轮 UI。只读本地规范、证据及相关渲染代码；实际使用 `view_image` 查看下列画面，未操作浏览器、HTTP 或数据库，未修改实现及 CONTROL。

范围：X01/X02/R01 的文字选中层级、编辑样式、长文末尾阅读和响应断点。沿用 [CONTROL](../CONTROL-ACCEPTANCE.md) 与 此前 E106–E116 复核（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/e106-e116-independent-visual-review.md`） 的版本和证据分组。该报告是有限视觉门禁，不代表三行复合门禁或 66 组验收整体通过。E124 锚点移动的中间帧、历史命令及数据恢复由 root/env 复验，本报告不重开其他已闭合范围。

## 依据与比较方法

批准依据为 [本轮修复契约](../design-contract.md) 第 3、4 条及 选择反馈规范（本地历史记录：`docs/design-system/drawing-selection-feedback.md:107`）：

- 契约第 4 条：“正文仅一套布局：普通/选中不改变换行、完整原文、宽度和行高；编辑时隐藏底层正文避免重复。” 同条明确“编辑器可以是独立浮层”，主操作常驻、样式入口可见，不能靠隐藏全文或缩字号塞下。
- 选择反馈规范第 108 行要求长文“验证滚动到底”，选中卡片前景遮住底层图形及其他卡片控件。
- 第 109 行要求精确价格与北京时间完整可读、编辑入口与读数分区，同时明确“编辑浮层按契约可独立覆盖图表，完成与取消常驻，样式区可滚动”。

直接查看 E119；E121 完成、取消、重开三图；E122 滚动末尾；E126 的 1321/1320、1101/1100、901/900 六图。另直接查看 E115 1280/1024 编辑图，以重新判断此前遮挡结论。宽度改变与已授权字号/宽度修改按各自状态比较，不把不等价状态要求成像素对齐稿。

现读 Canvas SHA-256 为 `634db6fd9eae94fce96d4adfd5680258ff48e340185766799933e6c7e9ace562`，与 freeze-634db（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/freeze-634db.json`） 一致。历史 final-freeze（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/final-freeze.json`） 保留。E119/E121/E122 文件时间分别在 02:16–02:18，E126 在 02:21；该冻结记录在 02:28 生成，时间先后不能独立证明每张截图捕获时的完整代码版本。本结论绑定具体图像及配套数据，不能将静态画面扩展为 634db 锚点拖动验收。

## 分项结论

| 项目 | 结论 | 直接证据与限度 |
|---|---|---|
| X01：390px 选中前景和正文层级 | **PASS（本图状态）** | E119（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/119-final-narrow-foreground.jpg`） 中原始判断完整呈现；“源柱 55.40 · 北京时间 / 2026-02-18 08:00:00”两行读数清楚；所选正文遮住底层卡片的文字和两个 chevron，卡片自己的编辑入口与收起按钮可辨。不能据截图证明按钮命中。 |
| X02：窄屏样式完成、取消与重开 | **PASS（所测样式与可见状态）** | 完成（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/121-narrow-style-completed.jpg`） 与 取消（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/121-cancel-preserves-committed.jpg`） 保留同一黄色 16px、180px 正文外观与换行；重开（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/121-style-reopened.jpg`） 只有一份可见编辑正文，完成/取消图标常驻。配套 DOM（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/121-style-reopened.txt`） 记录 16px、`#ffcc66`、宽度 180。180px 宽造成“结构失 / 效。”换行是该样式本身，不是选中重排。截图未直接覆盖样式区滚动到宽度/背景控件，不能由 DOM 存在推断全部选项已真实点击通过。 |
| X01：300px 超高长文内容及滚动保留 | **PASS（数据事实）；末尾视觉 FAIL** | 滚动数据（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/122-longtext-scroll.json`） 的普通/选中正文、矩形和滚动位置相同：300×661，scrollHeight 1478，scrollTop 817，恰为最大值 `1478−661`，完整 1215 字符保留至第 35 行。可是 末尾截图（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/122-longtext-last-line.jpg`） 的底部“编辑文字”按钮遮住第 35 行第二个显示行左侧“虑做多”一带；最后一行虽在 DOM 中，仍未完整视觉可读。 |
| R01：六个断点的选中文字段落稳定 | **PASS（静态画面）** | 1321（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/126-boundary-1321.jpg`） / 1320（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/126-boundary-1320.jpg`）、1101（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/126-boundary-1101.jpg`） / 1100（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/126-boundary-1100.jpg`）、901（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/126-boundary-901.jpg`） / 900（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/126-boundary-900.jpg`） 都保留完整四行判断、独立读数与卡片操作。配套 断点数据（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/126-boundaries.json`） 均为 14px/21px、300×136，无文字溢出；每对主图高度均为 258px。900px 处记录栏折叠、主图位置与宽度变化是响应布局切换，正文没有随切换缩字号或改变换行。持仓阶段、03-18 15:00 双截止、56/52/68 计划与 teal-red 配色见证一致。不能由静态图证明各断点全部核心操作可达。 |

## 此前 1280/1024 编辑器遮住底层锚读数的判断

E115 1280（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/115-1280-editor.jpg`） 和 E115 1024（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/115-1024-editor.jpg`） 的确只露出底层读数第一行，日期第二行被编辑浮层盖住；事实成立。但此前由此要求“编辑时同时看清底层完整日期”，超过了已批准的独立浮层契约。

第 4 条明确允许独立浮层；规范第 109 行又明确它可以覆盖图表。规范要求价格批注读数完整及编辑入口分区，不能据此附加“编辑期间所有底层图表读数必须同时露出”的新门禁。两图的编辑正文、样式区、完成/取消均可辨，也没有露出第二份同对象正文。因此，对“浮层遮住底层日期”这一单独现象，结论应改为 **允许的浮层覆盖，撤回原视觉 FAIL**。这不是宣称组件具有原生 modal/`aria-modal` 语义，也不等于编辑取点旅程整体通过。

本轮 E119、E121 完成/取消及 E126 所选非编辑状态的精确价格与完整日期均可读；仍应由 root 把真实编辑完成/取消与取点状态串联，不能从本报告推断原锚点持久化、无未来信息泄露或所有编辑边界通过。

## 剩余具体 FAIL 和 NOT VERIFIED

**FAIL：E122 的长文末行被卡内底部编辑按钮遮挡。** 这与允许编辑浮层覆盖图表无关；它发生在阅读态，并违反第 4 条完整正文可读及规范第 108 行滚到底的要求。当前 DOM 正文层用完整卡片高度滚动，底部 padding 仅 4px（Canvas（本地历史记录：`app/components/chart/drawing-canvas.tsx:2882`）），编辑按钮位于同一卡片底部并有更高 z 序（Canvas（本地历史记录：`app/components/chart/drawing-canvas.tsx:3024`））；截图与结构吻合。修后证据必须保留第 35 行两行完整可读，同时保留编辑/收起操作，再核对普通/选中相同换行和滚动位置。正文字符串及 scrollTop 通过不能抵消这一视觉缺陷。

**NOT VERIFIED：** 本报告没有新增 180/300 所有普通/选中/取消/展开/收起逐状态截图，也没有真实点击全部样式、六断点所有控件、200ms 中间帧、50ms 时延、实体触控、真实 IME 或保存返回刷新。沿用 CONTROL 中对应未验证项；不把它们算 PASS。E124 新修复不属于本次静态复核。

证据指纹：E119 `f5854e5ef4580ffd706ada38a1a25e677c8badc116689962aa1d5edfb8a67dcb`；E122 `d2382a900343ef3c6aafc2d8c73545f7c830fd96fab10d963d7596203783dc77`。这两图分别支撑前景层改善与当前长文阅读 FAIL，后续修图应另存，保留反例。

## E127 有限补证的独立复核

追加只读复核 G02/P03 执行报告（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/g02-p03-pointer-acceptance.md`），并实际 `view_image` 查看 127c 目标价柄的 before（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127c-rr-390-target-before.png`）、during（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127c-rr-390-target-during.png`）、after（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127c-rr-390-target-after.png`）、Undo（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127c-rr-390-target-undo.png`） 和 fallback 滚动末尾（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127c-rr-fallback-0-bottom.png`），以及 127b 的三张取消选中箭头图。本段未自行操作浏览器，功能链依据执行记录，与独立像素判断分开。

| 有限补证 | 结论与映射边界 |
|---|---|
| 三种箭头方向 | **视觉 PASS（这三例）**。水平向右（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127b-arrow-right-unselected.png`）、垂直向下（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127b-arrow-down-unselected.png`）、右下（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127b-arrow-down-right-unselected.png`） 的实际箭头尖清楚，对应各自向量。焦点代理“箭头”标签没有代替或盖住终端箭头尖。结合执行报告，可支持所列创建及端点调整/单次 Undo 段；不能改写为全部角度、所有端点/主体动作或全部输入方式通过。 |
| 390px RR 目标价调整与恢复 | **所列功能段有证据，视觉仍 FAIL**。59.74→62.07 在按住期间更新，松手保持，Undo 后回到 59.74/1.00R，与执行报告的四柄几何恢复一致；Undo 是切到 1440px 执行后返回 390px，不能称“390px Undo 按钮可达”。目标圆柄却被 fallback 标签压住，before/during/after 均难以辨认，违反 [契约](../design-contract.md) 第 7 条“选中/拖动不盖住操作柄”。127c 数据（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/127c.json`） 中 before 的目标柄为 `(173.125,360.109,16,16)`，完全位于标签 `(85.297,266,153.313,120)` 内；during 目标柄 y=340.125，也位于标签 `(76.547,266,162.063,120)` 内。真实坐标拖得动不能抵消此视觉反例，G02 小 RR 标签与柄的复合要求尚未闭合。 |
| RR fallback 滚动 | **PASS（实际 2px 溢出这例）**。末尾 1.00R 可读；记录为 scrollHeight120/clientHeight118、wheel 后 scrollTop2。不能扩成超高 RR 标签、全部更小视口或所有比例数据的滚动验收。 |
| P03 底图像素不变量 | **NOT VERIFIED（整体）**。执行报告明确保留首次创建箭头、127c RR 开始→during 和 wheel 后的底图/时间轴 hash 差异。阶段、双截止、计划及色系的有限见证可保留；静态截图肉眼近似不能证明像素完全相同，也不能为未解释差异指定原因。 |

E127 原始中断、CAS 恢复与成功重跑分别保留，不用后续 Undo 成功抹去此前恢复方式。E122 长文阅读 FAIL 继续保留，待修后同状态截图独立复验；未改 CONTROL/README。

## E129 索引命中修复的独立复核

实际 `view_image` 查看 390px 的 进入前（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-390-before.jpg`）、索引页（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-390-open.jpg`）、返回并刷新（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-390-return-reload.jpg`），及 640（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-640.jpg`）、641（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-641.jpg`）、1440（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-1440.jpg`）；阅读 修复说明（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/128-index-hit-fix.md`）。当前 CSS SHA-256 为 `3abc52fbe9f7a25b3cdc8b936a246f9e057ee0262d49ee6352f6380237e619b0`，与说明一致，仅 ≤640px context 的 `right` 改为 `calc(44px + 8px)`。

**视觉 PASS（索引避让与顶部密度这项）：** 390/640px 的样板索引位于右侧开关左边，文字完整且有清楚间距；标题、阶段行和工具行保留既有紧凑结构。641px 延续既有窄桌面排列，1440px 保留单行顶部；索引与右开关均没有视觉重叠。索引页标题及“进入复盘”入口可读，返回并刷新后恢复持仓页面顶部结构。

 640 命中记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-640.json`） 为 link rect `536..584, y36..54`，641（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-641.json`） 为 `239..287, y59..77`，1440（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-1440.json`） 为 `1340..1388, y18.5..36.5`，三者 hit 均返回索引 `<a>`。390 的 索引页记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-390-open.txt`） URL 实际到 `?index=1`，返回记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/129-index-390-return-reload.txt`） 回到主页面且保留持仓阶段及 03-18 15:00 双截止。它们支持 root 所测导航段；本复核没有自行点击，故不会据此宣称所有视口导航、右开关全旅程或整个框架验收通过。E129 图中的 Canvas 状态不用于接受尚未冻结的 E122/E127 修复。

## E131 长文末尾修后复核

本段版本：Canvas SHA-256 `1044545e55296c324f50e781006dcaa51eef53a01f4e44b15dc652847170b37c`，label helper SHA-256 `16857e39186441446f23b48bec859ca297178a20843f9b5abcf2d440dc1922a1`；只读计算的当前指纹与 root 提供的冻结一致，不把本报告前面的 `634db` 历史结论当成新版本验收。

实际 `view_image` 查看 选中到底（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/131-selected-bottom.jpg`）、普通到底（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/131-ordinary-bottom.jpg`）、重选中到底（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/131-reselected-bottom.jpg`）、末行特写状态（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/131-longtext-last-line.jpg`） 及 Undo（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/131-longtext-undo.jpg`），并读取 三态比较数据（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/131-longtext-state-comparison.json`）。

**PASS（390×900、侧栏打开、35行长文的末尾与三态稳定）：** 第 35 行的三个显示行“第35行：回撤后观察承接，站 / 回56再考虑做多；跌破52则结 / 构失效。”完整可读，左侧编辑按钮与右侧收起按钮均在正文下方，已经没有 E122 的末行叠字。三态矩形均为 `(57,272,236,220)`，14px/21px，padding `4px 4px 48px`；排版文本 1250 字符完全一致，scrollHeight2257、scrollTop2037，恰为 `2257−220`。普通→重选中没有重排、缩字号、改变卡片尺寸或丢失滚动位置。Undo 图恢复为短的原始判断及完整 55.40/北京时间读数，支持该截图中的文本恢复状态；实际单次历史及持久化仍以 root 的功能证据为准。

**场景边界：** E131 三态的视口和侧栏状态相同。JPG 本身确认旧 E122 为 **1440×900**、300×661 卡片，新 E131 为 **390×900**、236×220 卡片，不能称这两轮是同视口的像素对照。侧栏和主图布局所分配的空间会影响卡片可见高度；不同场景换行不同是宽度约束的结果，三态内的换行稳定才是这组比较的有效事实。E131 证明较短卡片中的同类末尾遮挡已经修复；旧 E122 反例保留，1440px 原场景的修后同态截图本次尚未提供，不据源码推断实机通过。也不由三态末尾推断全部文字宽度、全部展开/收起旅程或全部长文滚动位置通过。

## E130 小 RR 四柄与 fallback 修后复核

版本绑定 freeze-10445（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/freeze-10445.json`） 的 Canvas `1044545e…` 与 helper `16857e…`；E130 执行数据（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final.json`） 每个采集状态的 Canvas 指纹一致。实际 `view_image` 查看 390×800 的 before（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-before.png`）、during（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-during.png`）、after（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-after.png`）、Undo 返回窄屏（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-undo.png`） 和 fallback 到底（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-fallback-0-bottom.png`），并逐态直接查看独立底图与时间轴 PNG。

**PASS（四柄可辨且标签不遮柄、所列目标调整与恢复状态）：** 五图中的上方目标圆柄、左侧入场圆柄、下方止损圆柄、右侧宽度柄均清楚露出。fallback 位于左上侧 `(53,266,53.625,80.109)`；目标拖动期间它的高度为 60.125，完全避开目标柄和其他三柄。配套矩形及命中记录中四柄均为 16×16、中心命中对应自身，五态与 fallback 的交集面积均为 0。旧 E127c 目标柄被标签覆盖的具体视觉反例，在这一相同小 RR 目标调整场景中已闭合；历史反例保留。

数据记录目标 59.74→62.07、目标柄 y360.109→340.125，按住与松手状态一致；入场55.99/止损52.24及其柄位置保持，Undo 后四柄矩形、目标59.74与1.00R恢复。该 Undo 是在1440px执行后返回390px，不能写成390px Undo入口可达。本次只有目标柄的真实调整旅程；入场、止损、宽度柄的可见/命中证据不等价于它们的全部拖动旅程已复验。

**PASS（这个 fallback 的真实深滚动及末尾阅读）：** before 可读入场55.99/止损52.24，末尾图可读收益距离3.75 (6.70%)和1.00R。scrollHeight246/clientHeight78，scrollTop由0到168，恰为最大值；比 E127c 的2px溢出补证更充分。完整标签字符串保留目标59.74及全部风险/收益/比例，拖动数据更新为目标62.07/收益6.08 (10.86%)/1.62R。截图覆盖顶部和底部，未直接展示中段目标值或拖动后比例滚到可见的状态，故不扩大为每个值同时可见、全部比例和尺寸的阅读验收。

**P03：有限可见几何、日期与业务读数 PASS；整体待数据审查。** 实际查看的独立 before 底图（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-before-basePlot.png`） / 时间轴（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-before-baseTimeAxis.png`）、during 底图（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-during-basePlot.png`） / 时间轴（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-during-baseTimeAxis.png`）、after 底图（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-after-basePlot.png`） / 时间轴（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-after-baseTimeAxis.png`）、Undo 底图（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-undo-basePlot.png`） / 时间轴（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-390-target-undo-baseTimeAxis.png`）、滚到底底图（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-fallback-0-bottom-basePlot.png`） / 时间轴（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/130-rr-final-rr-fallback-0-bottom-baseTimeAxis.png`），未见可见蜡烛/成交量形状或01/05、02月、03月日期位置变化；独立尺寸均244×230及244×28。记录的颜色分类几何与时间轴前景边界也一致。阶段均为持仓、双截止均03-18 15:00、计划56/52/68及 teal-red 见证一致。

[契约](../design-contract.md)第8条要求的是 phase、cutoff、可见bar、计划与盈亏色保持，以及原数据保护；它没有要求抗锯齿逐像素完全一致。本报告 E127 的“底图像素不变量”标题不能解释为额外的逐像素门禁。E130 during/after/滚到底相对before仍有5524个plot像素、460个时间轴像素不同，最大通道差21/2；Undo与before原始像素相等。raw hash差异事实及其原因未验证，不能被geometryMask抵消，也不能由此直接断言批准契约失败。原始数据与 holding viewport 的新增差异由独立数据审查处理；本报告不关闭P03整体，不据截图接受全部输入方式、全部图形动作或全库不变量。

## E132 原 E122 桌面同态的末尾复核

实际 `view_image` 再看旧 E122末行（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/122-longtext-last-line.jpg`），并看新 [选中](../evidence/132-desktop-selected-bottom.jpg)、普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/132-desktop-ordinary-bottom.jpg`）、重选中（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/132-desktop-reselected-bottom.jpg`）及 Undo原文（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/132-desktop-undo.jpg`）。本段沿用freeze-10445版本，未操作浏览器或数据库。

**PASS（原 E122 同态末行反例关闭）：** 新旧均为1440×900、侧栏打开、300×661卡片，矩形完全相同 `(389.6796875,105,300,661)`；新三态数据（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/132-desktop-state-comparison.json`）的1215字符正文与旧E122数据（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/122-longtext-scroll.json`）逐字相同。第35行仍分成“第35行：回撤后观察承接，站回56再考 / 虑做多；跌破52则结构失效。”两行；旧图的第二行左侧被编辑按钮压住，新三态的两行均完整可读，下方留出操作空间。编辑/收起操作仍可辨，普通/选中/重选中没有改变全文、换行、宽度或14px/21px字号行高。三态scrollHeight均1522、clientHeight均661，相比旧1478增加44px，与新增底部留白的视觉结果一致。

132比较JSON未记录scrollTop或padding，因此本报告仅确认三图均显示末行、三态已记录字段完全一致；不把截图改写成三态scrollTop数值已核验。Undo图显示恢复短原文及完整源柱55.40/北京时间2026-02-18 08:00:00，支持所见恢复状态；历史命令与数据库恢复仍由root证据接受。E131的390px短卡与E132的1440px原场景共同支持这两种布局的末尾修复；不能扩为所有宽度、全部长文内容与滚动位置通过。此前E122 FAIL作为历史反例保留，前节“1440px原场景尚未提供”的NV由本次E132有限同态证据更新。

## E135 刷新前后市场视野的有限视觉补证

实际 `view_image` 查看1440×900的 刷新前（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-desktop-before-reload.jpg`） / 刷新后（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-desktop-after-reload.jpg`），以及390×844的 刷新前（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-narrow-before-reload.jpg`） / 刷新后（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-narrow-after-reload.jpg`）。阅读四份配套AX记录及 E134只读数据诊断（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/134-viewport-diagnosis.md`）；未自行操作UI、HTTP或数据库，版本沿用freeze-10445。

**PASS（这两个视口各自的刷新前后可见K线、日期与计划价）：** 桌面两图的可见蜡烛排列、成交量轮廓、价格轴及日期刻度位置保持；01/05、01/15、02月、02/11、03月、03/11没有移位或新增未来日期。窄屏两图的可见蜡烛片段及成交量排列、01/05、02月、03月刻度位置保持；因已有文字卡片覆盖部分蜡烛，这项结论限于实际露出的市场图形，不从被遮区域推断逐柱视觉相等。两对图上的计划入场56.00、初始止损52.00、止盈目标68.00与摘要56/52/68均保持，盈亏色维持teal-red。桌面当前OHLC为55.38/57.69/54.83/57.04；桌面前（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-desktop-before-reload.txt`） / 桌面后（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-desktop-after-reload.txt`）、窄屏前（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-narrow-before-reload.txt`） / 窄屏后（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/135-narrow-after-reload.txt`）也记录相同OHLC、持仓阶段和03-18 15:00双截止。窄屏截图没有露出底部截止条，截止一致在该视口是AX状态证据，不能写成截图中完整可见。

桌面before的原文展开并选中，after折叠且未选中，锚读数与编辑入口随临时态清除而隐藏。这里是root指定的刷新清除临时态，不是普通→选中的同态文字比较；不要求两图正文高度、显露全文或锚读数位置相同，也不用它替代E131/E132文字同态验收。两种视口只分别比较刷新前后，不把桌面与窄屏要求成相同柱间距。

E134数据报告确认旧/新holding viewport仅width、height、barSpacing改变，logicalRange、priceRange、rightOffset和priceScaleOptions保持；这是独立数据审查结果，本复核没有再查询数据库。E135补上该报告此前缺少的两个宽度实际reload视觉见证，未发现范围改变的可见反例，支持这一有限范围的P03视觉门禁。E134仍保留精确保存请求/effect归因NV；E130的raw hash差异事实也保留。不能扩大为所有resize/reload路径、全部图形动作、全部视口或逐像素一致通过；P03复合接受由root结合数据报告记录。

## E136 箭头方向与 fallback 中段的有限复核

实际 `view_image` 查看 journeys2 的 reverse/short 普通与标为 selected 的四图、narrow-fallback-mid，以及 g02 的 right/down/down-right 普通与 after 六图，共十一张图；读取 journeys2（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-journeys2.json`） 和 g02（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-g02.json`） 的对应状态。两组记录绑定 Canvas `1044545e…`，沿用冻结版本。本段只评估实际画面的方向与阅读状态，未操作 UI、HTTP、数据库或产品文件。

[契约](../design-contract.md)第7条要求“箭头按向量绘制真实箭头，圆形选择柄不能替代方向”，以及小 RR 标签“保留全部重要价格与比例”“选中/拖动不盖住操作柄，边界内可读”。文件命名和 DOM 对象存在不能证明选中状态成立，也不能证明箭头方向可辨。

| 实际画面 | 有限视觉结论 |
|---|---|
| reverse 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-journeys2-arrow-reverse-unselected.png`） / 标为 selected（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-journeys2-arrow-reverse-selected.png`） | **普通方向 PASS；选中态 NOT VERIFIED。** 左端真实箭头尖清楚，方向向左、略向下可辨，两张所示线条都如此。但 selected 图没有两个端点圆柄或选中反馈，左工具仍为箭头；不能接受为选中时仍有可辨方向的证据。 |
| short 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-journeys2-arrow-short-unselected.png`） / 标为 selected（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-journeys2-arrow-short-selected.png`） | **普通短箭头方向 PASS；选中态 NOT VERIFIED。** 约16px长的线段右端仍有箭头尖，可辨向右略下。selected 图也没有端点圆柄或选中反馈，不能由其名称推出短箭头的圆柄未盖方向。 |
| right 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-g02-arrow-right-unselected.png`） / after（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-g02-arrow-right-after.png`） | **这两张方向 PASS；选中态 NOT VERIFIED。** 水平右端箭头尖明确。after 图未显示圆柄，配套 controls 为空；尚不是“普通+真实选中”成对补证。 |
| down 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-g02-arrow-down-unselected.png`） / after（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-g02-arrow-down-after.png`） | **普通与实际选中方向 PASS（本例）。** after 的两个端点圆柄可见；下端圆柄上方仍露出向下的蓝色箭头尖，两翼和朝下尖端能与圆柄区分，没有只剩一条无方向线段。 |
| down-right 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-g02-arrow-down-right-unselected.png`） / after（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-g02-arrow-down-right-after.png`） | **普通与实际选中方向 PASS（本例）。** after 的两个端点圆柄可见，右下终端的箭头尖仍在圆柄左上侧可辨，方向向右下。焦点“箭头”标签覆盖部分线段，未遮住终端方向。 |
| narrow-fallback-mid（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-journeys2-narrow-fallback-mid.png`） | **中段补证执行 FAIL；中段可读性 NOT VERIFIED。** 画面仍是顶部入场55.99/止损52.24，未露出目标59.74、风险距离或收益距离的中段。记录的 fallback scrollTop=0、scrollHeight246/clientHeight78，与滚动前相同；stage 及 fallback 的 y 从266变143，符合整页向上移动123px，不能称标签本身已滚到中段。 |

fallback 顶部入场和止损的数字在本图可辨，但其周围还有底层文字/图形露出；这张图不足以评估未出现的中段目标、风险/收益距离与比例。E130 的顶部/底部阅读 PASS 继续成立，E136 不补上此前缺失的中段阅读，也不能由错误滚动对象直接推断产品不能滚动。应由实际执行 owner 另存 fallback scrollTop 大于0且小于168、目标与风险/收益行可见的真实中段截图，再独立接受；不得用完整 DOM 字符串替代视觉证据。

本轮未发现五个普通方向的新方向缺陷，down/down-right 的这两个选中实例也保留了真实箭头尖；reverse/short/right 的选中态缺口明确保留 NV，待正确选中后重补。以上不能改写为全部角度、所有长度、所有端点/主体动作、200ms中间帧或全部输入方式通过；也未新增接受 journeys2 的编辑、撤销、保存或持久化旅程。

### E136 reverse/short 真选中补图

实际 `view_image` 查看新 reverse 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-arrows-selected-reverse-unselected.png`） / reverse 选中（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-arrows-selected-reverse-selected.png`） 和 short 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-arrows-selected-short-unselected.png`） / short 选中（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-arrows-selected-short-selected.png`），读取 新配套记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/136-arrows-selected.json`）。另从原 PNG 在内存中裁出端点区域，以最近邻放大辨认遮挡，没有修改原图或写派生图片。新记录仍绑定 Canvas `1044545e…`；这是新的图形位置/长度实例，不能当成旧 journeys2 短箭头原坐标同态比较。

**PASS（这例 reverse 普通及真选中方向）：** 新选中图左工具已是选择工具，两个端点圆柄确实出现；左端圆柄右侧保留朝左的蓝色三角翼，与右边主体线条组合后方向向左、略下可辨。普通图也有清楚左向箭头尖。“箭头”焦点代理在右侧起点下方，不盖住左侧方向端。此前 reverse 选中态 NV 可由这一有限实例补上；不扩成全部反向角度/长度和端点动作。

**FAIL（这组 short 普通/真选中时的终端方向遮挡）：** 选中图确实有端点柄，记录的 handles 也为两项，故不再是“未实际选中”的证据缺口。但短线约从 `(925,346)` 到 `(950,352)`，“箭头”焦点代理框的顶边约位于 y350、左边约x929，压住终端尖及下翼；选中图终点圆柄也只露出上部弧线。局部实图只留下上翼/线段与圆柄上弧，无法清楚独立辨认真实终端方向。新普通图保留同一个代理框，箭头终端也被其顶边遮住。这违反第7条真实箭头方向应可辨的要求，不能由 DOM 有两个端点或已切选择工具算 PASS。需实际重补代理不遮终端且普通/选中均可辨方向的短箭头图；本报告未指定实现方式。

旧 journeys2 普通短箭头是在不同坐标、约16px长度，实际方向 PASS 保留；新约25px短箭头的焦点代理遮挡作为新增具体反例保留，不用旧图替它关闭。此前 right 真选中与 fallback 中段的 NV 未由本组证据更新，仍待各自重补。本次未接受新创建/Undo功能链或其他动作。

## E137 向右真选中、锁定及 fallback 中段复核

实际 `view_image` 查看 right 普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-right-unselected.png`）、right 真选中（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-right-selected.png`）、15px外侧（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-hit-outside15.png`）、2px内侧（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-hit-inside2.png`）、锁定（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-locked.png`）、锁定按住（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-locked-held.png`）、锁定松手（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-locked-released.png`）及 fallback 中段（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root-fallback-mid-0.png`），读取 E137记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/137-root.json`）。fallback 局部仅在内存中最近邻放大，没有写派生图。Canvas 仍为 `1044545e…`；本段不适用于尚未提供图像的新 focus/Recall 修复版本。

**PASS（向右普通与真实选中方向、本例）：** 两图的水平右端蓝色箭头尖清楚；真选中图两个端点圆柄可见，右柄左侧仍保留向右的三角翼，方向可辨。图上没有覆盖此终端的焦点代理框，补上此前 right 的真选中 NV。root 鼠标点击中点 `(834,596)` 的执行记录有2柄；外侧15px图没有柄，内侧2px图有2柄，与记录的0/2吻合。它只支持这两个具体位置的选择反馈，不能扩成全部命中边界或其他输入方式。

**PASS（本例锁定前/按住/松手未见意外位移）：** 三张锁定图中的这支向右箭头均约位于 `(748,596)` 至 `(916,596)`，线条、箭头尖与两端圆柄的可见位置不变，锁按钮保持亮起。记录有按住鼠标从中点向右上移动到 `(864,566)` 后松手的事件，静态 held/released 与锁定前所见没有相应位移；临时十字线及顶部OHLC随悬停改变不等于绘图移动。本结论是这次锁定拖动尝试的可见结果，不从静态图接受所有锁定对象、端点拖动、持久化或解除锁定旅程。

**PASS（fallback 实际中段滚动及目标/风险距离两个值）；完整风险百分比 NOT VERIFIED：** 390×800图中目标59.74与“风险距 / 离3.75”可读。记录明确命中点 `(57,270)` 后 scrollTop 从0到84，clientHeight78/scrollHeight246，位于最大168的中间；stage/fallback 仍在y266，故这次确实滚动标签，没有复现E136的整页滚动。目标标题处于上边界，风险 `(6.70%)` 处于下边界并被裁切，不能把整段所有标签和比例写成完整可见。正常滚动容器在某个任意中间位置裁切边界行并不单独构成产品 FAIL；完整风险比例的视觉验收仍需稍下滚至整行露出的另一个位置。E130的顶部/底部及本图中段数值是互补证据，不要求全部内容同时塞进78px。

非空 draft Undo 本轮**未执行/NOT VERIFIED**：root已明确按钮当时 disabled；即便存在命名为 after-undo 的图也不按已执行计算，本复核未拿它作为验收证据。E136短箭头焦点代理遮挡 FAIL 继续保留；本段没有接受正在修复的 focus 或 Recall race，也没有更新 CONTROL/README 或操作共享状态。

## E140 短箭头代理修复的有限视觉复核

实际 `view_image` 查看 [键盘选中短箭头](../evidence/140-root-short-key-selected.png) 与 [Escape 后](../evidence/140-root-short-key-escape.png)，读取 E140记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/140-root.json`）。本段绑定 Canvas SHA-256 `0f450bfcf31fd0ef50817a0259f5e325af51b9a77ab7b96792ca3c4ab21a9ecd`，只读计算的当前文件指纹与记录相同；不是沿用旧 `1044545e…` 作为新修复版本。

**PASS（本例短箭头选中时代理避让与真实方向）：** 新图与E136反例为1440×900、短箭头约 `(925,346)` 至 `(950,352)` 的同位置场景。两个端点圆柄均清楚露出，右下终端的蓝色箭头尖和翼可辨；“箭头”代理已移到左上方，画面中与短线/端点明显分开。记录代理rect `(820.78125,313.875,36,23)`、shortHandles2，支持所见避让状态；不是仅据DOM存在接受方向。E136中代理顶边压住终端尖、下翼及终点柄的具体视觉FAIL由此有限同场景图关闭，旧反例保留，不扩大为全部短长度、角度、边界或代理位置通过。

**PASS（本例 Escape 后反馈清除）：** Escape图中“箭头”代理及两端圆柄均消失，原短箭头本体保留、方向仍可辨，图形没有随反馈清除而移位。配套proxyAfterEsc opacity0/pointerEvents none与像素所见一致；这只接受该次键盘取消选中的可见结果，不替代临时状态不落盘或全部Escape作用域验收。

**未完成执行段明确保留：** 本次读取的E140 JSON result为 `STOPPED`，错误是在overlap-lower的后续drag采集时 `Execution context was destroyed, most likely because of a navigation`。当时没有overlap-selected或fallback-risk-full状态/截图，所以本报告不接受重叠选择反馈与完整风险百分比。停止不抹去已经产出的短箭头两图，也不能把整份脚本写成成功运行；后续重跑应另存记录并保留停止事实。142长数值ordinary/selected/held尚无本次独立图像验收，待实际产出后另补；未查看的动作及Recall race不由本段关闭。

## E141 重叠选择与完整风险比例的补证

实际 `view_image` 查看 重叠趋势线选中（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-root-overlap-selected.png`） 和 fallback 完整风险行（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-root-fallback-risk-full.png`），读取 E141记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-root.json`），版本仍为 Canvas `0f450bfc…`。短箭头同一修复版本的有限视觉结论沿用E140，不用整轮执行结果替代这些逐项图片。

**PASS（本例共线重叠的可见选择反馈）：** 水平长线约从x757到925、y606，选中反馈的一对圆柄位于中间短线端点约x792和889；只出现这对端点圆柄，没有两组重叠柄或另一对象的反馈同时抢占。蓝线与圆柄在底图上清楚可辨，图中没有代理盖住这两个操作点。记录的两个趋势线端点位置与图片相符；这支持实际所选短线区间的有限选择反馈，不从一张图判定所有重叠顺序、所有目标命中、全部z序或叠加密度通过。

**PASS（本例 fallback 风险距离与百分比完整可读）：** 390×800图中“风险距 / 离3.75 / (6.70%)”三个显示行完整露出，百分比的括号、数字、百分号和下沿均没有再被底边裁切；下面可见收益距离标题，但不把边界处的下一个值算完整阅读。fallback scrollTop112/clientHeight78/scrollHeight246，stage保持y266，已补上E137的风险百分比完整阅读NV。结合E130顶部入场/止损、底部收益距离/比例/R，以及E137中段目标值59.74，所列这一小RR的所有重要数值都有实际可读位置见证；不要求78px容器一次显示所有行，也不扩成全部长数值、所有数据与尺寸通过。

**E141整体未通过的边界：** 记录 result仍为 `STOPPED`，但这次是在上述操作段之后的 `page.reload: Timeout 5000ms exceeded`、等待`load`超时，与E140中途上下文销毁的位置不同。这不取消此前两张实际画面的有限PASS，也不能称E141整轮成功或reload已通过。root提供的working逐字段前后相同是独立数据门禁证据，本报告未再查询数据库；后续fresh goto/reload仍待实际执行。E137的非空draft Undo未执行是旧轮事实；E141已有真实新执行记录，本次未单独复核其前后画面，不用旧轮NV否定新执行，也不新增其完整功能接受。E142长数值门禁继续待新图。

## E142 高R数值、拖动读数与恢复画面的复核

实际 `view_image` 查看 [选中](../evidence/142-long-values-selected.png)、普通（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/142-long-values-ordinary.png`）、拖动按住（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/142-long-values-tiny-risk-held.png`）及 恢复后刷新（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/142-long-values-restored-reloaded.png`），读取 E142记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/142-long-values.json`） 与 [freeze-141](freeze-141.json)。版本绑定Canvas `0f450bfc…`；本复核没有改产品/冻结记录或操作UI、HTTP、数据库。

**PASS（本例高R与极小风险的普通/选中完整阅读）：** 两图均完整显示入场55.99、止损55.98、目标59.74、风险距离0.01 (0.02%)、收益距离3.75 (6.70%)和375.00R。选中与普通的读数面板位置、六行层级、价格/比例字符保持，不缩字号、不省略关键值，也未因选中把375.00R截断。选中图四个操作点可辨，左侧图形反馈/“做多盈亏比”代理和右侧数值面板分开，面板没有盖住这些柄；非常接近的入场/止损在不同横向端点呈现，不能把完整价格差写成被人为放大。本例实际值不是精确56/52/60，按画面中的55.99/55.98/59.74接受；也不是更长任意价格小数或无限大R的穷举。

**PASS（本次按住拖动时的当前读数可读）；不声称按住时375R：** 名为tiny-risk-held的图实际显示止损54.11、风险距离1.88 (3.36%)、1.99R，入场55.99/目标59.74/收益3.75 (6.70%)保持。各行和完整百分比仍可读，止损点向下的可见位置与风险区域增大相符，代理和数值面板不盖操作点。这是本次拖动中已经变化后的值，不能因文件名而把它写成按住状态仍为0.01风险/375.00R；也不能用这一单帧接受所有200ms中间帧或实时同步时延。

**PASS（恢复后刷新图的有限可见结果）：** 图中恢复入场55.99、止损52.24、目标59.74，风险/收益均3.75 (6.70%)及1.00R；临时端点柄与选中代理已消失，原始判断、其他卡片和原有绘图仍在。持仓阶段、03-18 15:00双截止、计划56/52/68及teal-red色系保持。它补上E141最后reload超时之后的实际刷新可见状态，不等于仅凭截图证明working逐字段、所有绘图原数据或全部刷新路径一致。

**脚本错误保留，与产品丢失分开：** E142 result为 `STOPPED`，最终断言实际为10个对象、期望为 `[]`；配套baseline确实记录objects空数组，restored-reloaded则记录原始三文字/一个RR/一个趋势线/五水平线共10对象。root明确baseline采集发生在数据未加载时，因此此处是基线采集/断言错误；不能把“最终10对象不等于过早采得的空数组”解释成产品丢对象，也不把脚本整体改写为成功。root已提供142-db-after与141-db-after完整working相同的数据核验，本报告不再查库、不独立追加持久化总PASS。停止记录和实际图片均保留；本段只关闭所列高R完整阅读与恢复画面的有限视觉NV，不扩大到窄屏高R、所有长数值、全部动作/输入方式或全功能接受。

## E141 连续录像解码帧的创建过程补证

实际 `view_image` 逐张查看同一 E141连续录像（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-video/page@1556a06309b6fcc9b37c2e50a595b389.webm`） 的六个解码帧，并对照 E141操作记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-root.json`）。root提供源片29.76秒/25fps；本复核实际查看的是下列5.0–7.5秒采样帧，没有播放或逐帧查看整段录像。画面为1440×900，记录DPR1、Canvas `0f450bfc…`；不冒称与原始DPR2审计像素同态。

| 录像采样点 | 实际可见状态 |
| --- | --- |
| 5.0秒（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-video-5.png`） | 首点已取的提示可见；新增蓝色趋势线从约 `(749,596)` 向右上伸出至约 `(818,578)`，原有下降趋势线和RR仍在。 |
| 5.5秒（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-video-5.5.png`） | 首点位置保持，新线右端已推进到约 `(915,550)`，线段明显伸长；仍显示确定第二点的提示。 |
| 6.0秒（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-video-6.png`） | 伸长后的新线保留，首点/第二点操作提示消失，符合终点提交后的稳定结果。 |
| 6.5秒（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-video-6.5.png`） | 已切到后续Text动作并出现文字预览，新趋势线仍保留；该文字框不是趋势线预览。 |
| 7.0秒（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-video-7.png`） | 非空文字草稿编辑器出现，新趋势线继续保留。 |
| 7.5秒（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/141-video-7.5.png`） | 后续Undo移除新趋势线，非空草稿仍在，原有下降趋势线保留。 |

**PASS（DCA02所列这一创建过程的有限动态可见证据）：** 实际画面见证首点已确认后，固定起点的线由较短预览伸长为较长预览，提交后保留，并进入下一Text动作；不是仅凭对象计数或静态文件存在判定预览生效。JSON顺序为首点 `19:30:21.878Z`、preview `19:30:22.730Z`、created `19:30:23.254Z`，前两步对象10、提交后11且第二点提示消失，与采样画面的“伸长→提交保留”顺序一致。录像PTS与wall-clock起点未独立校准，不把5.0秒等同上述某个精确时间戳。六帧未包含“刚取首点、尚未发生任何移动”的纯首点瞬间，该动作/提示由JSON首点记录补充；这里接受首点已确认后的可见预览变化至提交，不声称该瞬间已经单独逐帧核阅。

**后续Undo与保留边界：** JSON的nonempty-before为 `19:30:24.174Z`、对象11，nonempty-enabled-undo为 `19:30:24.914Z`、对象10，编辑器文本与rect保持。它与7.0→7.5秒中新增线消失但草稿保留的实际画面相符，不能误写成创建提交后自动丢失。此补证只关闭本例创建过程缺少实际动态图像核阅的NV；不宣称已看完整29.76秒、不接受所有采样帧之间无闪烁/200ms时延、实际OS光标、物理触控或全部创建输入组合。DCA02其他动作/数据门禁须按其已有独立证据分别判定，E141最后reload超时的 `STOPPED` 事实继续保留，本段不把整轮脚本或整票改写成全PASS。
