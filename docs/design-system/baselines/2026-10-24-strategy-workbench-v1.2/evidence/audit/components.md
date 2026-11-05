# 策略台 V1.0 独有组件与公共规范只读审计

审计时间：2026-10-24。审计版本：工作区 HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`；策略 V1.0 目录尚未跟踪，因此以下绑定文件 SHA256，不能以 HEAD 替代。范围仅设计文档、生成源、SVG 与现存截图；不修改产品实现、数据、业务时间语义。真实浏览器新截图交由独立 visual 审查者；本轮曾打开预览但服务当时拒绝连接，故当前渲染视觉验收 **NOT VERIFIED**。已实际查看历史 PNG：`evidence/editorial-rebuild/components.png`、`04-create-final-top.png`、`09-compare-v4-bottom.png`、`11-narrow-final-top.png`；这些仅辅助定位，不能作为 V1.2 通过证据（窄屏旧图 390×1300、现源 390×1600）。运行时鼠标/键盘/触摸/数据库检查 **NOT APPLICABLE：纯设计审计**。

路径缩写：S=`docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/`；H=`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`。L=`S/build-library-forms.py`；T=`S/build-time-results.py`；R=`S/build-responsive.py`；D=`S/visual-design.candidate.md`。行号以本轮读取源为准。`build-artboards.py` 的旧函数被后续构建层覆盖，下面不把旧函数的控件误算成现稿覆盖。

## Findings

### CMP-01 / P1：策略独有组件无公共定义，引用指向不存在的共享项
- 来源：D:568–572 将模式切换映射 SegmentedTabs、搜索映射 InlineFilter、详情映射 Drawer；H visual-design.candidate.md:520–548 明确公共唯一来源及 12 类/96 状态；H component-manual.html 实际无 InlineFilter、Drawer、日期时间复合、步骤条、三包槽、多选完整策略行、回放控制带条目。
- 实际：`12-components.svg` 由 L:393–430 只展示 6 个文字按钮态、3 个输入态和几个泛化容器，不构成这些组合控件的定义/样例。策略正文宣称复用但使用者无法追到参数、状态、键盘或恢复定义。
- 预期：公共扩展放 `docs/design-system/shared/strategy-workbench-v1.2/`，从 H 章九与 V1.2 双向引用；旧 12/96 统计保持其原始边界，新扩展单独统计适用状态与 N/A 理由，策略图以 SW01–SW08 标注具体引用。
- 影响：全部 21 图；详见末尾覆盖表。公共扩展清单见下。

### CMP-02 / P1：公共手册残留首页独占规则，足以误导后续模块
- 来源：H component-manual.html:104 “整理首页的交互方式”；:519 FilterPopover.error “失败恢复使用首页唯一全局修复入口，不增加局部重试按钮”；:1138 “数据表固定八行槽…所有重试动作都遵循首页唯一恢复入口”。相对 H visual-design.candidate.md:469、483 及 D:494 明确这些是首页实例规则。
- 实际/预期：开头有范围免责声明，具体状态和结尾仍写全局断言。应保留旧 96 状态的首页语义，在段落/状态处明确“首页实例”；公共规则允许策略在原业务上下文局部重试，不新增全局修复约束、不强制八行。标题改为全站公共手册，链接策略扩展。
- 影响：01-library、01b-package-management、03-experiments、04b-select-strategies、05-confirm、08-results、09-compare、10-states、12-components。建议 SW08 同时给出局部重试例与首页实例边界。

### CMP-03 / P1：三包组合只显示只读摘要，缺选择/换包/有效参数编辑样例
- 来源：D:193–198 ASM01–06；L:140–187，尤其 :163–166 每槽只有“锁定版本”“查看详情”；:170 详情层只画局部摘要。
- 实际：现稿无法展示空槽如何开始、如何选择/更换包和精确版本、预设与有效参数/单位/来源；不兼容、缺项、错误保存等也无对应图。旧 build-artboards.py 的“更换包”不能替代现覆盖层图稿。
- 预期：SW04 三包槽由公共 Select/Drawer/输入组合，公开 empty/default/selected/locked/loading/incompatible/error，以及值不丢失的更换/取消；详情与选择分开，锁定版本不自动追最新。SW06 480px 包详情层展示标题/关闭、滚动、来源与返回焦点，320px 检查栏另有明确用途。
- 影响：02-compose、04b-select-strategies、05-confirm、12-components。

### CMP-04 / P1：日期时间与步骤条没有角色/状态定义，资金参数仅展示而无编辑示例
- 来源：D:274–280 WIZ01–07；L:218–226 步骤 `i <= active` 全部同色，未区别当前/完成；:237–240 四字段均为通用 input36；:245–249 尚未选择策略就展示 A/B 资金；:302–305 及 :342 后仅只读资金/费用。H:536 要求日期日历图标、36px 与14px。
- 实际：日期无日历入口，时区/运行期限无选择器视觉；无日期展开、超范围、时区、截止原因样例；市场/股票池配置也未表现。步骤当前与完成不可辨。每组独立本金、币种/费率/滑点参数缺可编辑/校验状态，¥100,000 容易被读作既定默认。
- 预期：SW02 保留 T0、业务时区、名义/实际结束与完整交易日区别，登记日期/时间/时区/期限各子控件和校验；SW03 显示当前、已完成可返回、未来不可进入、提交加载、离开草稿确认；SW06 增资金/费用编辑与确认摘要样例；不改业务时序，不把示例本金定为默认。
- 影响：04-create、04b-select-strategies、05-confirm、07-time-controls-detail、07-time-states、07a-t0、07b-first-day、07c-lookback、08-results、09-compare、11-compact、11-narrow、11-responsive、12-components。

### CMP-05 / P1：多选策略行和手动排序的“操作”只有状态文字
- 来源：D:153–159 LIB05；:275 WIZ02；L:125 手动排序仅一句说明；:279–286 多选行用“已选 A/B、未选择”徽章，:297–298 已选摘要无移除动作。
- 实际：多选无法从样例识别勾选/取消的操作位置、行与详情动作边界；无禁用原因/焦点/键盘例。管理图只有“置顶/普通”徽章，没有上移/下移/跨页位置、保存/取消草稿或冲突恢复。
- 预期：SW05 定义多行 DataTable 业务变体（明确行高与两行信息理由，不能冒充48px单行），checkbox/row selection 与详情独立，已选Token可移除，disabled说明、focus、多选与冲突/加载样例。排序可作为 SW05 专属模式，展示组内移动/位置输入、边界禁用、保存失败保留草稿，保留置顶/普通分组边界。
- 影响：01-library、01b-package-management、04b-select-strategies、12-components。

### CMP-06 / P1：异常图把系统承诺画成按钮，且违反本页无匹配恢复规则
- 来源：D:485 ERR02 搜索尾部清除、空态不重复；:489–492 各异常不同恢复；L:368–382 将“保留原页面位置”“等待更新”统一画可点击按钮；:380 所有卡片相同“保留已输入字段；给出恢复方向”；:369 无匹配另加“清除筛选”。
- 实际：加载状态提供无业务动作的主按钮；等待状态没有可执行结果；运行失败只有查看原因缺局部重试样例；冲突只有重新载入、缺保留当前/另存与精确版本信息。12-components 空容器又合并“清除筛选或新建策略”(L:418)。
- 预期：SW08 清晰分 initial-loading / refreshing-retain / empty-data / no-match / no-candidates / coverage-insufficient / local-error / stale-data / conflict / submit-error；只有真实动作使用按钮，系统行为用说明；无匹配使用原查询清除入口。错误输入保留值，外置错误信息。各异常保留最后完整日期/身份与输入，不能用零代未知。
- 影响：10-states、12-components，并关联所有查询、保存、运行、确认图。

### CMP-07 / P2：共用尺寸/字级被多个本地 helper 悄悄改写，未登记业务变体
- 来源：D:605 36px控件、14px文本、24px标签/36px命中、40/48表格；H:525–531。T:66–69 chip 高24/字12，:104 mode_slots 用它做互斥模式，:295/:299 用于图表模式；T:79–84 field 56px 且 label 内置；R:61–64 Metric 值20而公共28；L:74–85列表行70、:121行55、:282多选70。
- 实际：标签、模式标签、只读时间字段、可编辑时间选择、业务两行行卡混用外观；部分24px模式没有36px命中示意。并非所有差异都应强改成同尺寸，但当前无例外定义。
- 预期：SW02 明确56px是含标签容器还是交互本体；SW05登记两行密度例外；SW06窄屏指标先保留28px/缩短金额，若确需20则记录业务例外与可读性证据；互斥模式复用36px SegmentedTabs，标签24px不替代Tab。NAV 54/200/48 属已批准专属尺寸，保留并通过 SW01 说明，不强套首页尺寸。
- 影响：01-library、01b-package-management、04b-select-strategies、06-observe、07全系列、08-results、09-compare、11三张、12-components。

### CMP-08 / P2：数值列右对齐规则在确认/比较表被忽略
- 来源：H:103、107、536；D:572；L:332–333 目标/实际权重明确 anchor=start；T:415–426 所有比较数值与表头默认 start；L:112–124 引用数表头start、数值end。
- 实际：`09-compare-v4-bottom.png` 实际可见金额/百分比列左齐；当前源同样行为。管理引用数表头/数字反向锚点。不同长度数值无法扫描同一右缘。
- 预期：共享 DataTable 数值列使用同一 right edge + end anchor，等宽数字，标题与可见字形边缘核验；SW05/06 展示金额、负值、百分比、—与长表头样例。
- 影响：01b-package-management、05-confirm、09-compare、12-components。

### CMP-09 / P2：比较曲线缺线型冗余编码；贡献负色误用到K线/回撤
- 来源：D:435、452 CMP04 指定“颜色+名称+线型”；T:322与330 两条曲线均实线、同圆点；T:31 NEG=#EF7F89、:186 下跌K线用NEG、:421 最大回撤用NEG。公共基础负色 RED=#FF8592，贡献负色是限定用途的色彩例外。
- 实际：两组只能靠蓝/紫与名称区分；特殊贡献负色外溢为普通下跌/回撤。不得把 A/B 组身份色当作成功/失败色。
- 预期：SW06 比较图例登记实线/虚线等最多4组编码，名称常驻，缺数据/失效保留；K线与普通负数恢复RED，NEG只用于贡献负条/相应图例。不给时间语义新增“统一日期”含混替代物。
- 影响：07-time-states、07a-t0、07b-first-day、07c-lookback、09-compare、12-components。

### CMP-10 / P2：组件错误态以错误文案覆盖字段值，未体现保留输入的契约
- 来源：L:415 错误输入框中直接显示“起点早于数据覆盖”；D:198、492、494要求失败保留输入/可读说明；H:546 明确反馈与恢复。
- 实际：错误样例无法看到用户输入的日期，也没可访问关联的外置错误。禁用/加载有图但原因/焦点处理未覆盖组合控件。
- 预期：SW02/SW08 的 error 保留原值，边框/图标+关联错误文案，disabled原因仍可读，loading防重复但保留上下文；字段 error 和容器业务 error 分开。
- 影响：04-create、02-compose、05-confirm、10-states、12-components。

## 建议公共扩展ID与最低可复用样例

按协调者拟定 SW01–SW08，避免临时再创造不同编号。

|ID|组件范围|必须能看见的样例/状态|
|---|---|---|
|SW01|紧凑导航|200展开、54折叠、48顶部；默认/选中/hover/focus；SVG同源图标、可访问名称；窄屏入口与当前页；不把NAV尺寸错误套回首页|
|SW02|业务日期时间复合|默认/展开/键盘focus/选中/不可用日期/范围不足/加载/错误保值/只读截止；T0/业务时区/名义结束/实际结束分开；日历图标与36px交互本体|
|SW03|四步向导|当前/已完成/未到达/返回编辑/校验阻止/确认加载/失败保留/离开草稿确认；不得把完成与当前都只标蓝|
|SW04|三包组装|空槽、选包/版本、锁定、参数预设/覆盖、缺角色、不兼容、详情阅读、保存加载/成功精确版本/失败/冲突；引用现有Select而非复制新外观|
|SW05|两行多选/管理列表|default/hover/focus/selected/multiple/disabled+reason/loading-retain/no-match/error；选择与详情互不干扰；选中Token移除；排序模式上/下/跨页位置/保存草稿/冲突；数值右缘|
|SW06|摘要/包详情/检查栏|88指标、480包详情层、320观察检查栏的职责分开；展开/长文滚动/关闭恢复焦点/unknown/partial/stale/error；金额与单位；资金费率编辑后确认摘要；最多4曲线+线型|
|SW07|回放控制带|T0/暂停/播放/推进中/末尾/回看/追赶确认/取消/失败保留最后完整步/输入或失焦暂停；V、M、E_i、R、已见记录分别定义；结果态可返回观察与禁用推进区分|
|SW08|局部查询、说明和恢复|查询草稿应用/取消/尾部清除；空数据与无匹配；说明hover/focus；初始加载与刷新；局部重试、延迟、冲突、提交失败；不移植首页唯一全局修复|

复用原子组件八态时需给每个组合组件标出映射；复合组件业务态不机械强凑八态。每个可操作样例交代触发、反馈、退出、键盘/焦点、失败保留与恢复位置。

## 21图稿与公共扩展映射

|图稿|涉及扩展|
|---|---|
|01-library.svg|SW01 SW05 SW08|
|01b-package-management.svg|SW05 SW06 SW08|
|02-compose.svg|SW01 SW04 SW06 SW08|
|03-experiments.svg|SW01 SW05 SW06 SW08|
|04-create.svg|SW01 SW02 SW03 SW06 SW08|
|04b-select-strategies.svg|SW01 SW03 SW04 SW05 SW06 SW08|
|05-confirm.svg|SW01 SW03 SW04 SW06 SW08|
|06-observe.svg|SW01 SW02 SW06 SW07 SW08|
|06-observe-status-detail.svg|SW06 SW07 SW08|
|07-time-controls-detail.svg|SW02 SW07 SW08|
|07-time-states.svg|SW02 SW06 SW07|
|07a-t0.svg|SW01 SW02 SW06 SW07|
|07b-first-day.svg|SW01 SW02 SW06 SW07|
|07c-lookback.svg|SW01 SW02 SW06 SW07|
|08-results.svg|SW01 SW02 SW06 SW07 SW08|
|09-compare.svg|SW01 SW02 SW06 SW07 SW08|
|10-states.svg|SW01 SW08|
|11-compact.svg|SW01 SW02 SW06 SW07|
|11-narrow.svg|SW01 SW02 SW06 SW07|
|11-responsive.svg|SW01 SW02 SW06 SW07|
|12-components.svg|SW01–SW08 总索引并引用公共实际样例|

## 本轮接受边界

只读审计已完成；未修复、未声称21图视觉通过。独立visual审查者正在做当前版本真实渲染截图。父代理需在V1.2修复后逐项复核图文、共享来源与状态样例；禁止把本报告来源审查等同产品交互通过。业务时间 V/M/E_i/R/已见范围、首日执行、失败停于最后完整步须完整保留。

## 审计输入SHA256

- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/visual-design.candidate.md`: `a4fdb7157297eaa16248c6638a6bf3420cc7f7c920b194935f85c902e2a81da9`
- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/build-library-forms.py`: `792276361a18627eeac09f715af222d001a21e8f7525d3fece5da64674a9b014`
- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/build-time-results.py`: `d688af1fc685cb653abd16f2bcfbf61451dfbf2101e44e0e5f3d8f3fdbf5ac71`
- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/build-responsive.py`: `faf91e4148fc7f2a6965c9552df84930ebfb5b6e770da5f980a1eb7954f7af12`
- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/build-artboards.py`: `260711dd43302d6a3391978bf81868f9d7d0381eacc339186ad8a23a5b1774e8`
- `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`: `daa1434e4437c340cbd23e38e15a7a34c31a892685ad7dfd1269ffe418605c22`
- `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html`: `1f532219fc78f52b8c9c7366aa4bf1b02d349fb43c3d0093311f7784bde246f0`
- `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/inherited-contract.current.json`: `957ee997c03a80299d2024616abd77af47d98733b88e50bdfd89f27baed0c585`
