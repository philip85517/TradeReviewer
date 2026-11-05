# 图上 Text 放置反馈与已有标注可见性

ID: review-audit-17
State: open
Status: open; 当前验收标准已调整，整体验收 NOT VERIFIED
Assignee: unassigned
集成负责人: coordinator
Priority: P1
Blocked by: 无

## 2026-11-06 用户取舍（当前有效）

文字由用户自行放置；影响阅读时由用户自行调整文字控件的范围。文字与文字、文字与成交标记重叠时，不要求系统专门自动避让，也不以同点文字必须同时可读作为验收条件。下文各版本因这一假定而记录的 FAIL 保留为当时的历史结果，不再单凭重叠判定当前方案失败；其他真实功能问题及未验证项仍需按各自版本核验。本次尚未更改正式视觉规范或批准任一原型。

隔离 v5 与 3091 当前 candidate-45 的限定检查发现：首次放置时可选择位置，也可修改已确认文字的内容；在这两个样本中从已确认文字中心尝试拖动，其位置及锚点均未变化。隔离 v5 的独立源码复核没有发现单条已确认文字的位置拖动或显示宽度调整控件；临时输入框高度调整不等于已确认文字的显示范围调整。见[浏览器操作与独立源码复核](../evidence/systematic-fixes-20261105/task-04-direct-text-stage/coord-manual-check-20261106-v2/REPORT.md)。这是一项普通文字交互能力的缺口，不需要因此设计自动碰撞处理；后续按原型讨论和验收推进。

## Scope / What to build

处理 Text 确认/取消后放置提示与实际操作不一致，以及创建/编辑另一条时已有文字暂时消失的问题。持仓自由标注，不增设右侧记录表单；此票仅记录审阅发现，不构成修复授权。

## Refs

- [审阅报告及前中后截图](../evidence/independent-design-review-20261028/REPORT.md)。
- [Text 自由多条合同 R03](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)。

## 最新复开记录（candidate-v10）

2026-10-29：独立视觉报告 [final-review-v10](../evidence/review-fixes-20261028/final-review-v10/REPORT.md) 对冻结版 candidate-v10 判定 FAIL：Text 卡片遮挡加仓箭头，使标签与 Bar 脱节。问题保持 open / acceptance-failed，需修复后以同一冻结版本重验 Text 卡片、锚点/引线、成交箭头及不同阶段/视口。对应清单：[candidate-v10 manifest](../evidence/review-fixes-20261028/candidate-v10/manifest.json)。报告限定为冻结 v10，且记载审阅期间运行目录 `workspace.js` 已变化；后续文件需另行冻结和复核。candidate-v9 的 FAIL 及更早版本历史保留，不以任何旧版 PASS 关闭本票。

candidate-v11 追加（2026-10-29）：据协调者提供的独立审阅发现，成交箭头遮挡在所审图片中改善；但 52.60 锚点仍与另一条 Text 卡重叠，见 1280×800 第34/49根与 1440 平移前后。视觉仍未通过，本票保持 open / acceptance-failed。候选清单：[candidate-v11 manifest](../evidence/review-fixes-20261028/candidate-v11/manifest.json)；尚未找到 v11 正式独立报告，需补齐报告与同版截图后再复验。

## 验收标准与反例

- [ ] 放置、编辑、确认、取消各状态的 T 高亮、顶部提示与点击图表的实际行为一致；明确单次或连续放置。
- [ ] 创建/编辑第二条时，不意外删除或改写其余当前可知文字；取消保留已确认内容，不泄露未来记录。允许用户放置的文字相互遮挡，不要求自动避让或同点文字同时可读。
- [ ] 至少两条文字实走创建、编辑、取消、缩放、前后回放和跨回合，再由非实现者复验。

反例：为了显示文字而突破创建时间/锚点的未来信息截止。

candidate-v12 / v13 追加记录（2026-10-29）：v12 独立视觉报告判定 FAIL：1440 边缘编辑态中成交引线穿过另一条 Text 锚点，见 [报告](../evidence/review-fixes-20261028/final-review-v12/REPORT.md)、[原图](../evidence/review-fixes-20261028/coordinator/v12-edge-editor.jpg)及[裁图](../evidence/review-fixes-20261028/final-review-v12/v12-edge-editor-conflict-crop.png)。v13 边缘态有所改善，但现有 [1280×800 第49根编辑态截图](../evidence/review-fixes-20261028/coordinator/v13-1280-text-edit.jpg)与[引线局部](../evidence/review-fixes-20261028/final-review-v13/v13-1280-edit-line-crop.png)仍显示自由 Text 引线穿过首次买入箭头；该项 FAIL。本轮 v13 独立报告尚在整理、待归档，故以上暂按已有审阅截图记录。问题维持 open / acceptance-failed；需在报告归档后冻结具体版本并复验引线、锚点与成交箭头在编辑及非编辑态的关联。不得将 v12 其他截图的 PASS 推及 v13，也不得声称 v14 通过。

## candidate-v37 版本绑定观察（2026-10-29）

candidate-v37 的源码快照与哈希见[冻结清单](../evidence/review-fixes-20261028/candidate-v37/manifest.json)。协调者真实浏览器记录 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 包含 `text-first-confirmed`、`text-second-confirmed`、`edit-second-keyboard`、`text-pan` 和 `text-price-axis-zoom` 等操作后的状态；配套画面见[两条 Text](../evidence/review-fixes-20261028/coordinator/v37-text-two-confirmed.jpg)、[平移后](../evidence/review-fixes-20261028/coordinator/v37-text-after-pan.jpg)、[价格缩放后](../evidence/review-fixes-20261028/coordinator/v37-text-after-price-zoom.jpg)。未参与实现的审阅者对这些冻结 v37 图像作了独立静态比较：[final-review-v37](../evidence/review-fixes-20261028/final-review-v37/REPORT.md) 认为两条卡片及锚点在所示画面可辨，同时指出卡片/引线覆盖部分 K 线，列为 P3 标注密度风险。静态比较不是独立放置或编辑操作。

v10–v13 的历史 FAIL（包括卡片遮挡成交箭头、引线与锚点/买入箭头冲突）均保留，不由 v37 的局部静态观察覆盖。v37 尚未核实取消/确认的完整语义、创建和编辑时已有文字持续可见、碰撞/边缘态、未来信息截止以及不同回放阶段的连续性；标注密度还待用户确认。本票保持 open / acceptance-failed。

## candidate-v37 独立实操追加（2026-11-04 至 11-05）

独立视觉审阅者在 Chrome、1200×569 CSS、DPR 2、持仓 31 根、两侧栏收起时，从绘图条启用自由 Text 并点击图表 `[900,350]`，确认短文后，Text 的空心锚点与首次买入箭头尖端重合，引线看上去像从成交箭头引出；仅放置一条短文也可复现。见[全图](../evidence/independent-acceptance-20261104/visual/reproduce-anchor-overlap.jpg)、[局部](../evidence/independent-acceptance-20261104/visual/reproduce-anchor-detail.jpg)和[详细复现步骤](../evidence/independent-acceptance-20261104/visual/REPORT.md)。这是锚点与箭头的关联歧义，不是文字卡片挡住箭头，也不代表任意放置位置均有问题。

后续需探索视觉区分或避让方案，同时保留用户自由放置的真实时间／价格锚点，并在不同位置、缩放和平移下复验；本票继续 open / acceptance-failed。本记录只登记验收结果，不构成修复授权。

## candidate-05 独立复测（2026-11-05）

[冻结版 candidate-05](../evidence/systematic-fixes-20261105/candidate-20261105-05/manifest.json) 的真实浏览器复测 **FAIL**：买入箭头重合已检测，但辅助标记仍被 CSS 隐藏，两个共点 Text 的辅助位置和引线完全重叠；原锚环仍覆盖箭头。未来信息截止与编辑取消仅在限定路径通过，其他标记未完成检查。详见[协调者记录](../evidence/systematic-fixes-20261105/task-04-coordinator/REPORT.md)。问题保持 open / acceptance-failed，正在修订；旧证据不覆盖。

## candidate-06 复测追加（2026-11-05）

[冻结版 candidate-06](../evidence/systematic-fixes-20261105/candidate-20261105-06/manifest.json) 的[真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate06/REPORT.md)和[独立静态复核](../evidence/systematic-fixes-20261105/task-04-candidate06-independent/REPORT.md)均为 **FAIL**：冲突提示可见，但多标记/缩放画面形成遮挡、密集及归属歧义。问题保持 open / acceptance-failed；历史结果不覆盖。

## candidate-07 复测追加（2026-11-05）

[冻结版 candidate-07](../evidence/systematic-fixes-20261105/candidate-20261105-07/manifest.json) 的[真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate07/REPORT.md) **FAIL**：首次买入箭头连续创建两条 Text 时，第二条编辑器未出现，控制台报引线终点 undefined 异常。后续路径未验；旧证据继续保留。

## candidate-08 复测追加（2026-11-05）

[冻结版 candidate-08](../evidence/systematic-fixes-20261105/candidate-20261105-08/manifest.json) 的[真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate08/REPORT.md) **FAIL**：第二条 Text 创建流程长时间无响应，Chrome 渲染进程约 100% CPU；[独立性能诊断](../evidence/systematic-fixes-20261105/task-04-performance-diagnosis.md)提示避让候选与引线计算组合增长。继续修订，旧失败记录保留。

## candidate-09 复测追加（2026-11-05）

[冻结版 candidate-09](../evidence/systematic-fixes-20261105/candidate-20261105-09/manifest.json) 的[协调者真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate09/REPORT.md)功能限定路径通过、视觉 **FAIL**：两张 Text 卡被推远，长引线穿过行情，辅助标记覆盖成交标签。性能高负载和其他锚点仍待验，问题保持开放。

## candidate-10 复测追加（2026-11-05）

[冻结版 candidate-10](../evidence/systematic-fixes-20261105/candidate-20261105-10/manifest.json) 的[协调者真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate10/REPORT.md)为 **FAIL**：下方辅助点覆盖成交标签，首条确认及编辑取消态仍有跨图折线。两条创建、取消及日期回看仅限定路径通过；[独立静态报告](../evidence/systematic-fixes-20261105/task-04-candidate10-independent/REPORT.md)针对具体反例补审后更正为多个状态 FAIL。问题 17 保持开放，历史证据均保留。

## candidate-11 复测追加（2026-11-05）

[冻结版 candidate-11](../evidence/systematic-fixes-20261105/candidate-20261105-11/manifest.json) 的[真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate11/REPORT.md)为 **FAIL**：引线穿过成交标签和其他卡片，六条连续标注时卡片受工具条及其他卡片遮挡；三条标注下鼠标移动的脚本开销仍需处理。限定的创建、取消和日期回看操作可用，不代表视觉或整体验收通过。问题继续 open / acceptance-failed，历史证据保留。

## candidate-12 复测追加（2026-11-05）

[冻结版 candidate-12](../evidence/systematic-fixes-20261105/candidate-20261105-12/manifest.json) 的[真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate12/REPORT.md)为 **FAIL**：创建首条 Text 时即出现 `placements is not defined` 运行时错误，布局未可靠完成；压力和其他节点因此尚未验证。本票继续开放。

## candidate-13 复测追加（2026-11-05）

[冻结版 candidate-13](../evidence/systematic-fixes-20261105/candidate-20261105-13/manifest.json) 的[真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate13/REPORT.md)为 **FAIL**：单条及多条冲突 Text 的引线隐藏后无法明确关联锚点与卡片，编辑器及密集卡片仍会覆盖工具栏。限定创建、日期回看与编辑取消路径无异常，50 次鼠标移动的本机脚本耗时下降，但不能抵消视觉失败。本票保持开放，等待定位和修订。

## candidate-14 复测追加（2026-11-05）

[冻结版 candidate-14](../evidence/systematic-fixes-20261105/candidate-20261105-14/manifest.json) 的[真实浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate14/REPORT.md)仍为 **FAIL**：单条连线恢复，但同点第二条仍失去关联；编辑器和密集卡片仍覆盖工具栏或彼此遮挡。[独立代码复核](../evidence/systematic-fixes-20261105/task-04-candidate14-static-review.md)还发现端点例外可能放行整段碰撞。本票继续开放。


### 2026-11-05 candidate-15 复测：FAIL，保持开放

[浏览器复测](../evidence/systematic-fixes-20261105/task-04-candidate15/REPORT.md)：两条同点标注仍有游离的 T 与卡片，编辑器仍遮挡工具栏，密集退出态卡片交叠。冻结保留候选实现，预览恢复至 candidate-04；不将函数测试替代真实画面验收。


## candidate-37 复测追加（2026-11-05）

[冻结版 candidate-37](../evidence/systematic-fixes-20261105/candidate-20261105-37/manifest.json) 在 1200×569、右栏打开、结束态下仍 **FAIL**：五条已知 Text 后新建第六条，列表覆盖输入框，真实鼠标无法输入。详见[实测报告](../evidence/systematic-fixes-20261105/task-04-candidate37-stress/REPORT.md)。本票继续 open / acceptance-failed；几何自测未覆盖实际较窄图表。

## candidate-38 复测追加（2026-11-05）

底部操作区使六条 Text 的限定创建、查找和回看路径走通，但把短窗口图表压至 151px，并把普通单条正文移出图表，同点身份仍重合。协调者与非实现者均判视觉 **FAIL**；见[实测报告](../evidence/systematic-fixes-20261105/task-04-candidate38-stress-scrolled/REPORT.md)和[独立复核](../evidence/systematic-fixes-20261105/task-04-candidate38-independent/REPORT.md)。问题保持 open / acceptance-failed。

## candidate-39 复测追加（2026-11-05）

滚动方案保住图高，但在 1200×569 首次定位时滚动到隐藏顶栏，随后 textarea 焦点位于固定回放条后面，真实鼠标无法点击。[首个操作反例](../evidence/systematic-fixes-20261105/task-04-candidate39-initial/REPORT.md)为 **FAIL**；其他路径尚未核验。

## candidate-40 复测追加（2026-11-05）

输入框焦点较前版可见，但初次进入 Text 仍自动滚离顶栏，编辑的取消/确认按钮仍被回放条遮挡；[真实操作](../evidence/systematic-fixes-20261105/task-04-candidate40-initial/REPORT.md) **FAIL**。

## candidate-41 复测追加（2026-11-05）

鼠标创建六条、真实滚轮逐条查看以及回看截止的限定路径走通，短窗口图表恢复 296px 高；但同点 Text 仍重合且遮住成交标记，密集状态的操作区需要滚动，单条卡片遮住部分 K 线。视觉验收仍 **FAIL**，见[真实浏览器记录](../evidence/systematic-fixes-20261105/task-04-candidate41-scrolled/REPORT.md)。滚动方案是未定稿的设计候选，本票保持 open / acceptance-failed。

## 2026-11-05 candidate-31 预览与隔离候选复核

当时 3091 预览为冻结的 candidate-31，非实现者对该版同态画面的[独立视觉复核](../evidence/systematic-fixes-20261105/task-final-candidate31/INDEPENDENT-VISUAL.md)仍为 **FAIL**：自由 Text 锚点/引线和首次买入箭头视觉混淆，两条文字及长引线还覆盖行情。原型的少量创建、编辑取消和日期回看路径有局部操作证据，不能替代该视觉门槛。

隔离试验 candidate-42 的分组胶囊仍以锚环盖住成交箭头；candidate-43 让成交箭头完整可见，并走通六条创建、查看和回放截止的限定样本，但 Text 引线仍指向成交箭头，且多个成交位置缺少可辨的图上 Text 身份。[协调者复测](../evidence/systematic-fixes-20261105/task-04-candidate43-stage/REPORT.md)和[非实现者视觉复核](../evidence/systematic-fixes-20261105/task-04-candidate43-stage/INDEPENDENT-VISUAL.md)均为 **FAIL**。上述隔离候选未并入预览，滚动区域及其取舍也尚未获用户确认。本票保持 open / acceptance-failed；继续寻找能同时表达自由锚点和成交标记的方案，并保留全部历史证据。

## candidate-44 与锚点精度补测（2026-11-05）

[candidate-44](../evidence/systematic-fixes-20261105/task-04-candidate44-stage/REPORT.md) 改善了同点 Text 身份和成交箭头可见性，但单条正文卡仍遮住 K 线，六条密集状态仍存在空间及可读性反例；[非实现者视觉复核](../evidence/systematic-fixes-20261105/task-04-candidate44-stage/INDEPENDENT-VISUAL.md)仍为 **FAIL**。该候选未并入 3091，不作为用户设计确认。

[candidate-31 坐标复测](../evidence/systematic-fixes-20261105/task-final-candidate31/text-coordinate-diagnosis/observations.json)另发现 8px 锚点圆心在样本中相对计算位置偏移约 1px；实际整数点击像素对应的价格与编辑器价格一致。圆点几何已登记独立修复，不以此替代密集 Text 问题的验收。

## candidate-45 圆点小修（2026-11-05）

当前 3091 预览已切换至 [candidate-45](../evidence/systematic-fixes-20261105/candidate-20261105-45/manifest.json)：唯一相对 candidate-31 的运行文件变化是 8px Text 锚点按圆心定位。入场和结束样本的坐标、确认及取消已由协调者在真实 Chrome 复测，[非实现者截图对照](../evidence/systematic-fixes-20261105/task-04-candidate45-stage/INDEPENDENT-VISUAL.md)对圆点修正给出限定 PASS。新版本回归及边界见[验收台账](../evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)。

此修正没有改变文字卡片的空间策略；同点 Text 与成交箭头的归属、密集态对行情的遮挡经[当前版本独立视觉复核](../evidence/systematic-fixes-20261105/task-final-candidate45/INDEPENDENT-VISUAL.md)仍 **FAIL**。candidate-44 仍为未并入的对照候选，密集态取舍尚待用户确认。本票保持开放。

补充：[两条分散 Text 的平移与价格轴限定实操](../evidence/systematic-fixes-20261105/task-final-candidate45/text-anchor-pan-v7/REPORT.md)显示两者的日期、价格标签和屏幕锚点在该样本中保持一致；此证据不覆盖同点冲突视觉、所有手势或业务持久化，不能关闭本票。

## 2026-11-05 自由 Text 轻量隔离候选 v5

根据 TradingView Text 官方说明及用户“持仓时自由放置”的要求，重新检讨此前大卡片、锚环和引线的设计假设；3098 隔离 v5 将确认态改为直接图上文字，编辑态收敛为较小浮层，详见[版本绑定复测](../evidence/systematic-fixes-20261105/task-04-direct-text-stage/REPORT.md)。该候选尚未进入 3091，也不是已确认方案。

1200×569 的同点样本中，两次绘制建立了 A/B 两个对象；模拟 Shift+Tab/Enter 可打开被覆盖的 A，鼠标可打开 B；取消和指定日期前后切换有局部操作证据。非实现者对 v5 截图确认编辑提示恢复一致，但文字与买入标记仍有视觉归属歧义，确认态 A 被 B 覆盖：[独立静态复核](../evidence/systematic-fixes-20261105/task-04-direct-text-stage/INDEPENDENT-VISUAL.md)。A 的鼠标选择与其他状态仍未完成；视觉 **FAIL**，本票继续 open / acceptance-failed。自然同点遮挡不自动构成强制避让的用户需求；不能用此限定路径关闭已有验收标准或历史失败。
