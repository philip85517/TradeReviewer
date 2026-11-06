# 复盘工作区原型 candidate-45 版本绑定验收

> **2026-11-06 用户取舍：** 图上文字由用户自行放置和调整，不要求系统专门处理文字之间或文字与成交标记重叠；同点文字同时可读不再是验收条件。以下 2026-11-05 的原始判定和证据保留为历史，不再仅凭此类重叠判定当前方案失败。其余功能、视觉和整体结论仍需依据当前范围独立核验，不能自动转为 PASS。

> **2026-11-06 补充：** 当前版单条 Text 的选点、修改内容与中心拖动尝试见[限定浏览器记录](coord-manual-check-20261106/observations.json)及[说明](../task-04-direct-text-stage/coord-manual-check-20261106-v2/REPORT.md)：本次拖动后位置与锚点不变；临时输入框的纵向调整不代表确认态文字显示范围调整。

> **2026-11-06 I11 独立补充：** 未参与实现的审阅者已在 candidate-45、1440×900 和 1280×800 用 CDP 模拟输入操作第 2 回合，从 28→29→33→34→41→49 观察到 K 线与对应成交的揭示，核查两阶段侧栏职责，并验证第 2/3 回合一个计划字段的内存隔离；这些仅为模拟输入下的局部样本，不计作 computer-use 实际输入验收。侧栏收起后当前回合不持续可见的设计风险及限制见[独立报告](independent-trade2-20261106/REPORT.md)和[问题 26](../../../issues/26-review-round-identity.md)。第 1 回合、所有断点、字段、视野、设备和 I11 其余合同不因此通过，历史台账不覆盖。

日期：2026-11-05  
触发：用户要求完成独立复核后，系统定位并依次修复复盘工作区原型问题。范围为工作区设计原型和支撑审阅的本地预览服务；行情为合成数据，工作区草稿仅在内存中。正式 V1.0 视觉规范、业务页面及交易数据库不属于本轮实现验收。

## 2026-11-05 历史结论（当前范围以顶部更新为准）

- **整页视觉：FAIL。** 非实现者复核与受限样本见 [独立视觉记录](INDEPENDENT-VISUAL.md)。当前 Text 的密集状态仍会遮住行情或与成交标记混淆；[问题 17](../../../issues/17-review-text-overlay-state.md)保持开放。隔离 [candidate-44](../task-04-candidate44-stage/REPORT.md) 并未通过视觉复核，也未并入 3091。
- **功能：局部 PASS，整体 NOT VERIFIED。** 协调者在真实 Chrome 按鼠标、模拟键盘路径重新操作图表、回放、日期、表单、筛选、退出和回合切换。无头浏览器的原生下拉鼠标弹出菜单、方向键、物理键盘及真实输入法仍未完整验证。独立审查者不能连接其浏览器，独立交互为 NOT VERIFIED；静态比较不能替代独立实操。
- **状态：合成数据和内存草稿的限定样本 PASS；真实业务持久化 NOT VERIFIED。** 图表回放实际揭示 K 线和成交标记；原型刷新会重置草稿。预览服务评论文件与真实交易数据不是同一保存链。
- **使用边界：** 样本包括 1440×900、1280×800、1291/1292×800、1200×569 DPR 2 和 390×844 阅读入口；不推断所有尺寸。真实读屏、物理触控、系统日期选择器、完整键盘矩阵、真实 TradingView 功能及精确 1:1 均 NOT VERIFIED。
- **用户确认：** 这是可审阅的原型；局部修复与推进原型不代表设计已获用户确认，也未回填正式视觉规范。

## 版本与方法

- 当前 3091 运行文件与 [candidate-45 冻结清单](../candidate-20261105-45/manifest.json)的九项 SHA-256 一致；manifest SHA-256 `a69c34e22cf086ecf6defcf85abfc8528651116317b28b0b100c96092a3c8002`，`workspace.js` SHA-256 `0504ece60a3f04fc27f78ab13db3f44a8bcfe0ee930bb56a6bcb08be06ff9ca2`。
- 相对 candidate-31 唯一代码变化是 8px Text 锚点偏移由 3px 调整为 4px；截图对照与 [入场/结束坐标诊断](text-coordinate-diagnosis/observations.json)对这一几何修正为限定 PASS，密集视觉问题不随之通过。
- 当前版本重新执行实际 Chrome 回归，原始结果、截图及 `exit-codes.txt` 均位于本目录；`python3 -m unittest tools.document_review.test_server` 新运行 29 项通过，`node --check workspace.js` 通过。最终重新打开的 [1280×800 首屏](fresh-preview-verified/1280x800.png)、[布局读数](fresh-preview-verified/observations.json)及 HTTP 200 仅证明预览可读取。
- **PASS** 为有明确场景、尺寸和输入范围的局部证据；**FAIL** 为已观察到未满足合同；**NOT VERIFIED** 为证据不足；**N/A** 为原型范围明确排除，不计通过。每条 PASS 可能仍有未覆盖子项。
- 以下台账绑定 candidate-45 的实际回归；历史 candidate-31 记录和独立视觉样本保留为对照，不将历史代码的通过自动赋给本版。[设计覆盖与引用](../../../DESIGN-COVERAGE.md)列明原要求、责任与验收依据。

## 2026-11-05 的 40 项控件和旅程台账

40 组中：33 组有明确范围的局部 PASS，1 组含 FAIL，2 组 NOT VERIFIED，4 组 N/A。数量不能替代整体验收。

| 项目 | candidate-45 当前状态 | 当前证据与未覆盖范围 |
| --- | --- | --- |
| I01 顶栏返回与退出选择 | PASS（限定） | `navigation-extra/observations.json` 的 `i01-back-exit-dialog`/`i01-resume-after-back` 与 `navigation-extra-v2/`、`navigation-extra-v3/` 的返回弹层、Escape、焦点循环步骤证明返回入口及继续路径；只覆盖鼠标/键盘和当前视口，不覆盖触控/读屏。 |
| I02 顶栏关闭与退出选择 | PASS（限定） | `navigation-extra/` 的 `i02-close-exit-dialog` 与 `i02-confirmed-closed-workspace`、`navigation-extra-v2/` 的 `i02-close-escape-resume` 证明关闭入口、确认退出与 Escape 继续；其他设备和完整顺序未验证。 |
| I03 退出弹层焦点循环/Escape/继续 | PASS（限定） | `navigation-extra-v2/` 的 `i01-back-dialog-tab`、`i01-back-dialog-shift-tab-wrap`、`i01-back-escape-resume` 与 `navigation-extra-v3/` 的 `focus-v3-modal-first`/`focus-v3-shift-tab-last`/`focus-v3-tab-wrap-first` 记录了首尾焦点、循环和 Escape；不等同读屏/触控验收。 |
| I04 确认退出、返回及内存值 | PASS（限定） | `navigation-extra-v3/` 的 `i03-v3-exact-draft`→`i03-v3-confirmed-exit`→`i03-v3-returned-draft` 记录确认退出、返回工作区及 `57.25` 草稿保留；仅为当前合成数据/内存草稿路径。v2 的两项失败来自测试脚本未清空旧值便追加输入，不能作为产品失败。 |
| I05 三个记录入口、返回和原焦点 | PASS（限定） | `side/observations.json` 有顶栏记录、左栏记录和隐藏/恢复样本；嵌套记录入口、全部顺序和触控未验证。 |
| I06 导出/更多 | N/A | 原型明确为 disabled/范围排除，不计通过。 |
| I07 侧栏开合与价格视野 | PASS（限定） | `side/`、`side-scale/`；1200×569 及部分 1440 组合通过，连续尺寸、手势、触控未验证。 |
| I08 日期/次数筛选与空态 | PASS（限定） | `navigation-extra-v2/` 的 `i08-date-filter`/`i08-date-cleared` 记录日期筛选结果与清除，`i09-mismatch-empty` 记录无匹配空态；只覆盖当前侧栏/合成样本，组合和其他设备未验证。 |
| I09 清除筛选恢复回合 | PASS（限定） | `navigation-extra-v2/` 的 `i09-round-filter`→`i09-mismatch-empty`→`i09-mismatch-cleared` 记录回合筛选、空态与清除后恢复三回合；不外推全部筛选组合。 |
| I10 第 3 回合草稿隔离 | PASS（限定） | `journey/`、`focus/`；指定内存草稿样本通过。 |
| I11 第 2 回合身份、截止及布局 | NOT VERIFIED | `journey/` 有阶段样本，但完整来源、断点和价格视野合同未覆盖。 |
| I12 第 1 回合草稿隔离 | PASS（限定） | `journey/`；指定回合/字段样本通过。 |
| I13 D02 Text 激活、放置、确认/取消 | PASS（限定） | `toolbar/`、`text/observations.json`；少量键鼠路径通过，密集空间不随之通过。 |
| I14 其他绘图工具 | N/A | 原型明确为未实现占位，不计通过。 |
| I15 Text 图内命中与真实锚点 | PASS（限定） | `text-coordinate-diagnosis/` 对入场与结束各一个整数点击样本，编辑器价格匹配 `coordinateToPrice` 的两位小数；8px 圆点的中心与计算锚点一致至布局取整精度。[非实现者静态对照](../task-04-candidate45-stage/INDEPENDENT-VISUAL.md)支持该限定几何修正；连续缩放、其他视口和持久化仍待验证。 |
| I16 两条 Text 创建、编辑后另一条保留 | FAIL（视觉；功能局部 PASS） | `text/observations.json` 证明少量两条 Text 的创建/编辑/取消链可操作，但当前候选仍未达到问题 17 的密集可读、成交标记、编辑器与工具栏共存合同；后续候选证据被排除。功能局部不能抵销独立视觉 FAIL。 |
| I17 Text 取消/Escape 保留原确认值 | PASS（限定） | `text/observations.json` 的 `edit-second-cancel`；仅当前少量对象/视口。 |
| I18 每条 Text 可分别鼠标/键盘编辑且其他文字可达 | PASS（限定） | `text-keyboard-anchor-v5/` 在 1440×900 用鼠标分别放置两条分散的 Text，再用 Tab/Enter 分别编辑、确认并检查另一条文字保持原值；`text/` 另有第二条鼠标编辑和取消样本。只证明这些样本，不覆盖所有鼠标、Space、触控及密集态；密集视觉仍按 I16 判 FAIL。 |
| I19 Text 随平移/缩放及成交标记移动 | PASS（限定） | [v7 补测](text-anchor-pan-v7/REPORT.md)在 1440×900 用命中检查后的鼠标路径真实平移与拖动价格轴；两条分散 Text 的图上锚点随之移动，逆算日期及价格与各自标签保持一致，成交标签位置亦变化。`text/` 另记录 1200×569 含成交标记画面的移动。只覆盖当前内存样本及这些手势；同点冲突、任意视口、持久化和独立交互仍未通过或未验证。 |
| I20 日期定位、阶段/反馈及播放互锁 | PASS（限定） | `date/`、`scene/`、`replay/`；有效/无效日期和阶段样本通过，系统 picker/全速度未验证。 |
| I21 日期弹层焦点循环/背景点击/取消 | PASS（限定） | `date/`、`focus/`；Tab/Shift+Tab/Escape/背景点击样本通过，读屏、原生 picker、窄屏全组合未验证。 |
| I22 三速度播放及变速 | PASS（限定） | `native-typeahead/` 对 0.5x、1x、2x 各自播放 28→31 根并暂停，观察到 0.5x 较慢、2x 较快；播放中变速、精确倍率及完整互锁仍未验证。 |
| I23 下一根真实 Bar/成交标记/持仓右栏 | PASS（限定） | `replay/`、`journey/` 的 28→29 等样本通过，不外推全部视口/输入。 |
| I24 下一停点、加仓/部分退出/结束截止 | PASS（限定） | `replay/` 的 33/41/49 样本通过；全速度、全尺寸和触控未覆盖。 |
| I25 原生速度 SELECT 选项/焦点/播放态 | PASS（限定） | `native-typeahead/` 通过 Tab 与模拟数字首字符选择 0.5x/1x/2x，随后播放和暂停；鼠标弹出菜单、方向键、播放中改速与物理键盘仍未验证。 |
| I26 周期/返回实时禁用候选 | N/A | 原型不提供该能力；不计通过。 |
| I27 两条隐藏/恢复入口及焦点 | PASS（限定） | `date/observations.json` 实际包含 `1200/1280/1440-hide-replay-hide-review-*` 与 `hide-review-hide-replay-*` 两种顺序，以及 Tab/Shift+Tab/Enter/Space 恢复 steps；不覆盖触控、读屏和全部视口。 |
| I28 场景 URL 与回合切换 | PASS（限定） | `scene/observations.json` 有 entry/holding/exit、日期、query/hash、history 样本；`native-typeahead/` 以模拟中文首字符提交三阶段并观察 28/31/49 根、URL 与焦点。原生鼠标菜单、物理输入法未验证。 |
| I29 侧栏组合、持仓右栏和价格视野 | PASS（限定） | `side/`、`side-scale/`；指定组合通过，完整持仓/结束组合、手势、触控未验证。 |
| I30 多空方向与键盘/校验 | PASS（限定） | `right-extra-v2/` 的 `I30-trade2-long`、`I30-trade3-return-short`、`I30-trade2-return-long` 证明两回合方向隔离；`right-extra-v3/` 的 `I30-trade3-short-legal` 以 End+Backspace 输入 56/68/52，做空选中且错误为空。v1 的“trade3 被污染”是初始状态/断言错误，v2 首次小数串联是 Ctrl+A 测试输入错误；均非产品失败。完整键盘/所有边界仍未验证。 |
| I31 三价字段空/长/负值及计划线 | PASS（限定） | `lines/`、`numeric/`；正常/空/负/极小和部分计划线有记录，全部清空、方向及精度组合待补。 |
| I32 三种规模模式与选中语义 | PASS（限定） | `numeric/`、`focus/`；三模式和选中语义样本通过，读屏、全部边界和持久化未验证。 |
| I33 参考资金/来源字段与回合隔离 | PASS（限定） | `numeric/`、`journey/`；正常/空/长值及指定回合样本通过，不推断业务限额。 |
| I34 入场/结束 Text 入口、放置/取消 | PASS（限定） | `text-entry-exit/` 在入场和结束分别用鼠标启用 D02、确认一条并取消第二条；两阶段各仅一个锚点样本，不覆盖全键盘、触控和视觉密度。 |
| I35 提前退出四选项与选中语义 | PASS（限定） | `right-extra-v2/` 的四个 `I35-mouse-*` 和 `I35-keyboard-no` 记录四选项鼠标切换与一次方向键选择；`right-extra-v3/` 的 `I35-I36-trade3-set`、`I35-I36-trade2-exit-clean`、`I35-I36-trade3-exit-retained` 证明“是”状态在两回合间隔离并保留。读屏、触控及全部键盘组合未验证；v1/v2 相关其他失败源于脚本假设或阶段标签断言。 |
| I36 结束原因/符合度/跨回合 | PASS（限定） | `right-extra-v3/` 证明原因和提前退出隔离；`native-typeahead-v2/` 以模拟字符选择“符合”，验证两回合初始、切换与返回保留。其他符合度选项及其他输入方式未验证。 |
| I37 四维评分与隔离 | PASS（限定） | `native-typeahead-v2/` 在第 3 回合选 1/2/3/4、第 2 回合选 4/3/2/1，切回时分别保留；使用模拟数字 typeahead，未覆盖每个评分值、鼠标菜单、物理键盘或持久化。 |
| I38 390 阅读页、阅读、滚动、Back | PASS（限定） | `narrow/observations.json`；390×844 鼠标与 Tab+Enter、阅读、滚动、Back、桌面恢复通过；触控及其他视口未验证。 |
| I39 图表库署名/外部站点 | N/A | 外部站点/真实 TradingView 身份不是本合成原型验收范围。 |
| I40 全部相关键盘旅程（Text/日期/退出/显隐） | NOT VERIFIED | `toolbar/`、`date/`、`focus/` 各有局部键盘证据；Text 全实例、显隐完整顺序、跨视口综合键盘仍待补。 |


## 回归解释与未关闭项

- `side/`、`side-scale/`、`replay/`、`scene/`、`toolbar/`、`focus/`、`narrow/`、`date/`、`numeric/`、`lines/`、`journey/`、`text/` 是对 candidate-45 的新批次；各自的状态和视口以原始 `observations.json`、截图为准。退出码 0 不代表所有业务或视觉合同通过。
- `navigation-extra/` 先记录返回/关闭路径后，脚本错误地把左栏收起当作展开，导致后续筛选点击失败并退出码 1；`navigation-extra-v2/` 的筛选与空态、`navigation-extra-v3/` 的精确草稿和焦点循环提供各自限定证据。v2 的旧值追加导致两个计划值误报，v3 重新输入并验证；原始记录全部保留。
- `right-extra-v2/` 保留合法做空输入和中文阶段标签断言的已知脚本误报与原生菜单未验证；`right-extra-v3/` 用实际键盘和阶段操作复核合法做空、退出原因和跨回合状态，结果无 failures。`native-typeahead/` 本次仅执行阶段及三速度路径，评分隔离由 `native-typeahead-v2/` 在每次切换后先回到结束态补测；模拟首字符不等于物理键盘或输入法验证。
- `text-keyboard-anchor-v4/` 的测试注入与快照表达式在交互前出错，不能作为产品失败或通过；v5 记录两条分散 Text 的键盘编辑，但拟平移手势落在卡片上，范围未改变，不证明平移。v6 挑选第二位置未避开已有卡片、预先命中检查后中止；v7 改为寻找可命中画布的位置，完成平移与价格轴的限定补测。此前 candidate45-stage 的 v2/v3 测试也分别有 Enter 输入方式、点位遮挡和 Ctrl+A 假设问题，原始记录保留。[Text 问题 17](../../../issues/17-review-text-overlay-state.md)的独立视觉 FAIL 不是这些脚本误报。
- 密集 Text、真实 TradingView 对齐、独立浏览器交互、所有设备/输入方式以及业务数据保存与重开均不因局部操作通过而关闭。用户选定并确认方案后，才可把一致内容回填正式 V1.0 视觉规范。

[问题与修复汇总](USER-SUMMARY.md) · [系统修复计划](../PLAN.md) · [原始 candidate-31 台账](../task-final-candidate31/ACCEPTANCE.md)


## 隔离后续记录（不改变本版验收）

3098 的 [自由 Text 轻量 v5](../task-04-direct-text-stage/REPORT.md) 是独立冻结的探索，未替换 3091 candidate-45；其局部编辑提示已复验，但文字与成交标记归属及确认态可读性仍为视觉 FAIL，独立浏览器实操及完整状态链未验。candidate-45 的本记录、问题 17 和历史失败均继续有效。
