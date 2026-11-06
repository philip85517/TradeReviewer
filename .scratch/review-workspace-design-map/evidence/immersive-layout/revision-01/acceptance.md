# 首轮反馈修订验收

> 2026-10-28 复核：在当前原型指纹和新增旅程中，日期回放状态、Text 提示／叠层及 1280 回合切换／1292 价格轴遮挡未通过。下述 C07–C09、C11、C15 与视觉 PASS 保留为历史上各自具体样本的结果，不再代表上述相关范围的当前整体通过；相关功能及视觉门槛现为 FAIL。无证据证明缺陷何时引入，不将其表述为已证实回归。具体发现、复现及重验范围见[独立审阅汇总](../../independent-design-review-20261028/REPORT.md)。

> 2026-10-29 candidate-v10 复核追加：独立视觉报告 [final-review-v10](../../review-fixes-20261028/final-review-v10/REPORT.md) 对冻结版判定 FAIL：成交标签遮挡箭头，Text 卡片遮挡加仓箭头并造成空间关联脱节。C07（Text）与 C05（成交节点/标记可见性）对应范围重新打开，待同态修复和独立复核。candidate-v10 清单见 [manifest](../../review-fixes-20261028/candidate-v10/manifest.json)；报告说明审阅期间运行目录源码已经变化，其结论只适用于冻结 v10。[协调者 v10 成交阶段截图](../../review-fixes-20261028/coordinator/v10-text-34.jpg)和 [Text 编辑态截图](../../review-fixes-20261028/coordinator/v10-1280-text-edit.jpg)仅作图像证据，不代表独立审阅者操作。原 C05、C07 PASS 及 v3–v9 各版失败/通过历史均保留，不迁移到后续版本，也不据此宣称当前整体验收通过。

> 2026-10-29 candidate-v11 追加：据协调者提供的独立审阅发现，成交箭头遮挡在所审图中改善，但 52.60 锚点与另一条 Text 卡仍重叠（1280×800 第34/49根，1440 平移前后），视觉仍 FAIL，C07 保持开放。1291 初次工具条空白、复测图标可见，可能是瞬态，渲染问题尚未排除，C11/断点相关视觉也不得记为通过。candidate-v11 清单：[manifest](../../review-fixes-20261028/candidate-v11/manifest.json)；协调者截图见 [1280/34](../../review-fixes-20261028/coordinator/v11-1280-text-34.jpg)、[1280/49](../../review-fixes-20261028/coordinator/v11-1280-text-49.jpg)、[平移前](../../review-fixes-20261028/coordinator/v11-chart-before-move.jpg)、[平移后](../../review-fixes-20261028/coordinator/v11-chart-panned.jpg)、[1291 首次](../../review-fixes-20261028/coordinator/v11-1291-retest-initial.jpg)、[1291 复测](../../review-fixes-20261028/coordinator/v11-1291-entry-retest.jpg)。v11 正式独立报告尚未找到；上述截图不替代其归档。原 C05、C07/C11 历史结果不迁移到 v11，当前整体验收未通过。

触发：用户四项界面反馈及前端修订后局部影响面检查。合同见 [DESIGN-COVERAGE.md](DESIGN-COVERAGE.md)。实现者 Luna，独立验收 coordinator（未编辑 UI）。2026-10-24 本轮限定原型功能、内存状态链、独立视觉对照三项 PASS，可供用户审阅；不代替最终设计确认。旧验收只适用于旧指纹，当前版本见 artifact-manifest.json。

环境：当前隔离 worktree，基线 270aad42，设计静态服务 127.0.0.1:3091。只使用合成行情和内存；无数据库请求、无持久化，数据库验收不适用。鼠标与键盘检查；完整 TV 绘图、真实保存/交易库导航、手机适配、系统 IME/物理触摸不属于本轮交付能力。

## 局部控件与旅程登记

每行是一个有界验收旅程，内含所列动态实例/选项；不是全页面控件覆盖率。旧完整登记保留在原型 CONTROL-INVENTORY.md，变更后历史结果不能覆盖新实例。

|ID|操作与动态边界|预期|状态/证据|
|---|---|---|---|
|C01|三次交易逐项选择，分别填计划，再返回|固定600000，时间倒序；日期与图表对应，草稿隔离|PASS；round-checks.json；58/57/59分别保留；第2回合0条Text，第3回合买入前0条、持仓2条|
|C02|筛选次数/日期、无匹配、清除|仅当前股票回合，空态可恢复|PASS；filter-checks.json|
|C03|默认A；旧B参数；左右键|A固定，无B/C入口或快捷切换|PASS；旧参数和键盘直接检查；legacy-checks.json|
|C04|买入前填58、首次买入29根|原计划/计划线联动；持仓收起右侧，空间还给图表；无当前判断或记录表单|PASS；first-buy.png，新增蜡烛与首次买入箭头；计划线58仍在|
|C05|33→34→41→49|真实K/买卖标记推进，中途不切加减仓表单；49才评价|PASS；真实播放到33暂停，再单步34；final-node-34.png、final-node-41.png、accepted-exit-1440.png|
|C06|结束原因、提前/符合度、四维选值；回看再返回|同回合评价保留，早期隐藏|PASS；填写原因、符合、未提前、四项4星，回看再返回保留；accepted-exit-1440.png|
|C07|两次T→图上不同点→分别确认→平移缩放→跨成交→回看早期→返回|多条独立自由Text保留，不要求选择Bar/区间、不生成右侧记录；随图定位，未来不提前出现|PASS；text-pan-zoom.json、fixed-text-pan-zoom.png、fixed-future-text.png；最终退出图中越出图面对象隐藏|
|C08|Text编辑取消/Esc、播放后进入Text/字段|取消保留确认值，编辑暂停；回合切换不串Text|PASS；两条分别取消和Esc，确认值保留；播放后T立即暂停；三回合往返及最终两条Text截图|
|C09|三回合日期入口min/max，确认/取消日期|边界与各自实际时间轴一致，取消不推进|PASS；round-checks.json；2025-02-03确认到29根，取消不变|
|C10|买入前/持仓中/结束之后；旧add/partial/resume链接|仅三场景，旧链接落到持仓画面，右侧无记录表单|PASS；legacy-checks.json及最终三场景截图|
|C11|1440买入前四开合组合、1280左开右闭及恢复；持仓→结束|主图填满、轴不遮挡，时点/视野保持；阶段变化时右侧自动开合|PASS；geometry-1440.json；图宽854/1038/1302/1118；1280左开收右、右开收左；最终两视口三场景截图|
|C12|工具条尺寸/比例与T热点|约539×40，比例保持，热点≥36，图标不失真|PASS；内容539×40、含边框541×42，T热点36×40；SVG指纹未变；accepted-holding-1440.png|
|C13|记录开关、退出继续/返回|内容只分计划/结束评价/Text，无旧持仓判断，内存往返|PASS；final-records.png；继续、确认退出、恢复后值保留；早期无结束评价|
|C14|隐藏/恢复审阅与回放、刷新|选定A不丢，刷新仅重置内存符合提示|PASS；依次隐藏/恢复两条；刷新重置Text和评价，A保持|
|C15|1291/1292边界、390提示→桌面|侧栏规则不回归，窄屏只提示|PASS；1291互斥、1292可双开；boundary-confirmed.json、final-narrow-fallback.png；恢复桌面正常|

## 视觉对照与问题

协调者在真实 IAB 浏览器、DPR1 独立查看最终 1440×900 / 1280×800 的买入前、持仓中、结束之后画面，与合同列出的上一版同态截图对照。左栏为同股回合、A连续表单、持仓右侧收起、工具条同比缩小，符合授权差异；原暗色层级、图表/价格轴和回放空间保留。最终图片为 screenshots/accepted-{entry,holding,exit}-{1440,1280x800}.png。1280右表单可滚动，持仓显示两条紧凑Text；退出时移出图表的文字隐藏，无跨左栏覆盖。视觉门槛 PASS。

boundary-checks.json 保留首次采集：390项是在窗口变化后、响应式重绘前过早读取，不能作最终结论。新鲜AX确认后的 boundary-confirmed.json 显示390×844仅提示、无横向溢出；桌面恢复已经实操。鼠标与键盘有证据，仿真触摸、物理触摸及系统IME仍 NOT VERIFIED；均不属于本轮桌面原型交付承诺。

### 首次冻结后的独立发现

|问题|实际复现|证据|状态/负责人|
|---|---|---|---|
|F01 未来 Text 提前出现|28→29，分别在过去两个位置创建 Text；回到28，两条仍可见。实现只检查锚点时间，缺少创建时点限制。|screenshots/F01-future-text.png、two-texts.png|FAIL，已退回 Luna；需复验创建时点与锚点双限制|
|F02 回到买入前未展开计划|从持仓选买入前，右侧仍是40px轨道，计划需要额外点击。|screenshots/F01-future-text.png|FAIL，已退回 Luna；阶段变化展开，同行情阶段保留手动状态|
|F03 自由 Text 被拉宽|保存对象同时带 left/right，短句被拉成长卡片；锚点定位共用编辑器边缘限制。|screenshots/replay-33.png、node-41.png|FAIL，已退回 Luna；内容宽度，跟随时间/价格坐标|
|F04 结束面板仍拆分批次|完成事实仍含部分退出、后进先出及加仓批次；是/否选项丢失具体问题标题。|screenshots/node-49.png|FAIL，已退回 Luna；只展示首买/最终平仓事实，恢复“是否提前退出”题意|

|F05 Text平移缩放脱离锚点/越界覆盖|先发现图表平移后Text留在屏幕原位，修复定位后又发现越出绘图区覆盖左栏。|final-text-pan-zoom.png及修复前直接观察|历史 FAIL；两轮退回 Luna 后复验，见下表|

以上 FAIL 是首次或中间版本记录，保留原件。最后冻结后的独立复验：

|问题|修复与复验证据|最终状态|
|---|---|---|
|F01|创建时点与锚点双限制；第3回合29根创建两条，28根均隐藏，31根恢复；fixed-future-text.png及最终三场景|PASS|
|F02|阶段变化自动开合；持仓→买入前恢复计划，持仓→结束恢复评价；同阶段手动状态保留|PASS|
|F03|两条内容宽度约144/146px、上限280；accepted-holding-1440.png|PASS|
|F04|仅首买/最终平仓事实，题意“是否提前退出”恢复；accepted-exit-1440.png、accepted-exit-1280x800.png|PASS|
|F05|监听视野变化，Text跟随时间/价格坐标；text-pan-zoom.json记录x598→743、895→1069；越界隐藏并限制绘图区；最终退出截图无左栏覆盖|PASS|

静态检查与保护文件比对见 verification.json；JS语法、git diff --check通过，浏览器warn/error为空，静态服务持续监听3091。正式规范源文、HTML及既有TV对齐原型9个受保护文件指纹一致。无业务数据库或持久化代码变更。

> 2026-10-29 candidate-v12/v13 历史追记：v12 独立视觉报告 [final-review-v12](../../review-fixes-20261028/final-review-v12/REPORT.md) 对冻结版判定 FAIL：1440 边缘编辑态成交引线穿过另一条 Text 锚点（[原图](../../review-fixes-20261028/coordinator/v12-edge-editor.jpg)）。v13 正式报告仍在整理、待归档；已有 [1280×800 第49根编辑态截图](../../review-fixes-20261028/coordinator/v13-1280-text-edit.jpg)及[引线裁图](../../review-fixes-20261028/final-review-v13/v13-1280-edit-line-crop.png)显示边缘态虽改善，自由 Text 引线仍穿过首次买入箭头，问题17视觉 FAIL 并保持开放。1291 工具条瞬时空白仍 NOT VERIFIED（问题14）。保留此前版本结果作为其各自范围的历史证据，不迁移 PASS 至 v12/v13，不表示 v14 或整体验收通过；v13 独立报告归档后再补正式版本绑定结论。

> 2026-10-29 candidate-v33 历史追记：[独立复审](../../review-fixes-20261028/final-review-v33/REPORT.md) 与协调者真实操作发现 1280×800 的 28→29 转场中图表下移 17px、回放组横移约 132px；后者为潜在误触风险，自动播放误触未证实。同时 [播放画面](../../review-fixes-20261028/coordinator/v33-play-start.jpg) 的提示“已暂停”与播放中控件矛盾。C05、C11 相关范围重开，整体验收为 FAIL；须在后续冻结版本同态复测，旧 PASS 不迁移。

> 2026-10-29 candidate-v34/v35 问题14回归追加：协调者在 candidate-v34 真实浏览器验证 1280×800 从28根推进到29根，info-row 高度均为49px、chart y=154px不变，play x=540.24→540.57px；但右栏展开时 replay-actions 与关闭按钮重叠：1108×800 分别为 x=284..768 与 x=722..762，1280×800 分别为 x=370..910 与 x=894..934。见 [v34 1108×800 截图](../../review-fixes-20261028/coordinator/v34-1108-entry-right.jpg) 和 [v34 独立预审](../../review-fixes-20261028/final-review-v34/REPORT.md)。candidate-v34 整体 **FAIL**，不迁移任何旧版 PASS。
>
> candidate-v35 的局部回归：1108×800 右栏展开时，8px 间距修正后“下一回放停点”在初始画面完全裁出；原生滚动条在未滚动时不可见，鼠标水平滚动后才显示，见[滚动前](../../review-fixes-20261028/coordinator/v35-1108-entry-before-scroll.jpg)与[滚动后](../../review-fixes-20261028/coordinator/v35-1108-entry-after-mouse-scroll.jpg)。可发现性 **FAIL**，正在修复。问题14继续 open / acceptance-failed；独立复审及最终验收尚未完成。以上追加观察不覆盖本文件历史 PASS/FAIL，也不表示最终版已经验收。


## candidate-v36 / v37 版本回归与整页控件覆盖（2026-10-29）

保留此前 candidate-v29–v36 全部历史结果。v36 因样式优先级导致 1108px 宽“下一回放停点”被裁切，明确记为 v36 **FAIL**，不得将其它版本局部 PASS 转移。candidate-v37 manifest 及截图/AX 记录见 [`review-fixes-20261028/candidate-v37/manifest.json`](../../review-fixes-20261028/candidate-v37/manifest.json)、[`coordinator/v37-audit-ax.json`](../../review-fixes-20261028/coordinator/v37-audit-ax.json) 与 `coordinator/v37-*.jpg`。协调者在 Codex in-app browser 进行了 238 条状态观察，consoleErrors 0。CSS viewport 观察涵盖 390、1107、1108、1280、1291、1292、1327、1328、1440；DPR、缩放、浏览器版本未记录。

[最终控件清单](../../review-fixes-20261028/CONTROL-INVENTORY-FINAL.md)严格统计：40 组，PASS 12（I01/I02/I03/I08/I09/I10/I16/I17/I20/I21/I34/I38），FAIL 0，NOT VERIFIED 24，N/A 4（I06/I14/I26/I39）；PASS只覆盖各行明示边界。N/A 仅表示原型明确禁用/范围外，不代表能力通过。协调者记录显示部分日期/关闭弹层鼠标及键盘动作、日期确认/取消、回放点位、计划/评分输入、多视口状态；其余组仍有未覆盖实例/选项/旅程，保持 NOT VERIFIED。未观察项包括时间轴/价格轴完整定位（虽有一组时间轴拖动观察，但锚点与成交标记准确性未核）、完整键盘路径、未覆盖状态组合、模拟触控、物理触控、正式数据持久化和重开。原型使用合成行情与内存草稿，不访问业务数据库。静态独立报告已归档，审阅者仅查看协调者截图、未独立实操；另见[交互独立审阅记录1](../../review-fixes-20261028/final-review-v37-interaction/REPORT.md)及[记录2](../../review-fixes-20261028/final-review-v37-interaction-2/REPORT.md)，两位审阅者浏览器连接均不可用、未执行交互。最终版仍未验收，不得宣称整体通过。


### v37 日期回退、播放中模态及重新定位（2026-10-29）

协调者后来补录 `v37-audit-ax.json`，总计238条观察：33→28 回退显示33根状态仅首次买入、28根状态为首次成交前；播放中打开日期弹层后已暂停且背景 inert；日期再确认28→49显示49根/退出后状态，随后反向回到33根，仍只显示首次买入，未来成交保持隐藏。证据标签为 `date-rewind-before/after`、`date-modal-playing-before/open`、`date-modal-lock-geometry`、`date-forward-49`、`date-reverse-33`。这为日期定位及模态互锁的明示子旅程补充直接证据，不覆盖日期未变、超限、所有播放速度及完整焦点组合。按控件清单的边界，I20/I21 对应已列路径记 PASS；总体控制统计 PASS 12、FAIL 0、NOT VERIFIED 24、N/A 4，整页仍未验收。

### v37 独立审阅与时间轴补充证据（2026-10-29）

独立审阅报告已归档：[final-review-v37/REPORT.md](../../review-fixes-20261028/final-review-v37/REPORT.md)。其范围为冻结源码与截图静态比较；已查看画面未见新的 P1/P2 静态视觉阻断，保留三项 P3，明确整体视觉、完整交互与最终用户确认 NOT VERIFIED。此前 v36 FAIL 及 v29–36 历史保持不变。协调者新增 1440×900 时间轴拖动 x850→710，见 [前](../../review-fixes-20261028/coordinator/v37-timeaxis-before.jpg)/[后](../../review-fixes-20261028/coordinator/v37-timeaxis-after.jpg)：两条已确认 Text 的卡片位置变化，内容和日期/价格标签仍可见；锚点及成交标记是否与真实坐标一致没有验证。因此 I19 仍 NOT VERIFIED；当前组级统计 PASS 12、FAIL 0、NOT VERIFIED 24、N/A 4（见最终控件登记）。最终整页验收未完成。

### candidate-v37 1327→1328 断点焦点与 Space 暂停补充（2026-10-29）

协调者在同一真实浏览器调用中观察到：1327→1328 时播放按钮由 x=546.74 移至 x=564.24，尺寸保持 36×36 CSS px，焦点仍在播放按钮（`breakpoint-play-1327-1328`）。另一次连续操作以 0.5x 播放，跨断点后立即按 Space；状态由“正在播放”变为“已暂停”，按钮显示“播放”，焦点仍在该按钮（`cross-key-test-start`、`cross-key-test-crossed`、`cross-key-test-pause`；见 [v37-audit-ax.json](../../review-fixes-20261028/coordinator/v37-audit-ax.json)）。因此仅该调用内、0.5x 的键盘焦点保持及暂停路径有直接观察。

此前分开的工具调用间隔过长，播放自动到达停点；之后按 Space 会重新启动播放。该序列受自动停点影响，不作为断点暂停失败证据。此次有限结果不证明鼠标悬停/误触风险已消除，也不覆盖其他速度、所有断点交互或连续播放场景。v37 独立复审所述 P3 断点交互风险按其余未覆盖范围保留；完整断点交互及整体验收仍 NOT VERIFIED。


### v37 Text 日期与回合隔离补充（2026-10-29）

协调者新增三步状态序列：第3回合33根创建“33根创建，回看隔离”，回退28根时不显示，返回33根后恢复；第2回合结束后创建“第2回合独立文字”，切到第3回合33根时只显示第3回合的文字，返回第2回合49根后显示第2回合文字。证据为 `text-rewind-created33/at28/return33` 与 `text-isolation-trade2-created/trade3-return33/trade2-return49` 及同名截图。该结果只覆盖所测两条Text的日期/回合可见性隔离，未核实所有标注、全部锚点精度或其它回合/时点；I18、I19仍 NOT VERIFIED。

### v37 断点播放焦点及 Space 暂停补充

协调者的 [v37 AX 记录](../../review-fixes-20261028/coordinator/v37-audit-ax.json) 显示 1327→1328 时播放按钮 x546.74→564.24、尺寸保持 36×36 CSS px，焦点仍在播放按钮（`breakpoint-play-1327-1328`）。另一连续操作在 0.5x 播放时跨断点后立即按 Space，状态从“正在播放”变为“已暂停”，按钮为“播放”，焦点仍在按钮（`cross-key-test-start/crossed/pause`）。此前分开的工具调用间隔过长，自动到达停点后再按 Space 会重新启动；该序列不作为暂停失败证据。有限结果不证明鼠标悬停/误触或其它速度通过，P3 风险按未覆盖范围保留。
