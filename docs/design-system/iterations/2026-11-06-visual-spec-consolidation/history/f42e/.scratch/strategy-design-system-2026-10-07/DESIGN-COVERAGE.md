# 设计覆盖表

来源 U=2026-10-07 当前用户完整要求；E=2026-09-25-chart-first-review-ui-elements.md；DR=2026-10-06-strategy-workbench-review-functional-design.md。参考02/04/05均位于 docs/designs/2026-09-25-chart-first-review；本轮实测源图位于 screenshots/current-*.jpg。root已直接查看02/04/05，不以摘要代替。

|ID / 需求|精确依据与源图|owner|旅程与验收证据（待落地记录）|
|---|---|---|---|
|DS01 当前策略与正式复盘实测|U一；current-strategy-1440.jpg、current-native-review-1440.jpg|root|新截图、DOM computed metrics、源码定位；不把字体栈当glyph证据|
|DS02 信息层级/工具分组/图表空间|U二四；E01–04/19；02-chart-workspace.png|root视觉，design_sample实现|同fixture前后1440/1280图；plot/header/footer实测|
|DS03 中文字型/文字角色/行高/长文|U二四；E08；02/04图上原判断|design_sample|多行中文完整原文、字号/行高、chart字体明确、窄屏文本尾部|
|DS04 控件/图标/间距/基线|U二；E01–03/09/19；07-interaction-states.png|design_sample|同栏36h，独立icon18/19；焦点/hover/selected；coarse44规则与证据分开|
|DS05 语义颜色/对比度/现盈亏配置|U三四；E05–07；02/05|design_sample，root计算|实际computed色复算；主按钮≥4.5，非文字必要边界≥3；不改变绿红设置|
|DS06 同一工作区S0/S1/S2与双截止|U三；E02/04/07/14/15；02/04/05|design_sample，root状态owner|真实bar推进，三阶段截图和两个截止前后值|
|DS07 原判断保留/当前补充/复盘补记|U三四；E08/18/22；02/04/05|design_sample|完整长Text、原判断快照+S1补充、回S0仍可对照，来源标签|
|DS08 计划和实际区分/完整价格|U三四；E05–07/10–18；02/05|design_sample|金色虚计划线、实际成交、侧栏完整价；无截断/不可把未知作0|
|DS09 未来保护|U三；E04/07/14/15；02/04/05|root数据链，design_sample接线|原生SDK图表tooltip/摘要/列表/缩放逐项检查；S0不带未来bar/成交/结果|
|DS10 操作/焦点/选中|U二四；E03/09/19/20；07-interaction-states.png|design_sample|真实键盘focus截图及颜色尺寸，不以hover模拟focus|
|DS11 长内容/窄窗口|U二三；E08/09/10/19；现规格响应式段|design_sample，root|1440/1280/390+实际断点两侧；长数字原文可达；真机未测明确|
|DS12 实际组件推荐样板/同条件前后|U四；上述全部；首页B不迁移|design_sample|dev-only route；同fixture baseline/recommended；非SVG重画、真实ReplayChart|
|DS13 可持续规范/问题报告/固化范围|U二四五；项目workflow|root|真实docs/designs规范文件、每问题8项、选定后公共层修改清单|
|DS14 启动包读取|U一|root|尚未找到，pending用户路径；NOT VERIFIED，不冒充旧包|
|DS15 数据安全和预览运行|U一五；AGENTS/runtime|root|显式隔离DB；原成交hash核对；live URL+startup；无push/merge|

E21导出/完整正式持久化/真实回测：NOT APPLICABLE to scoped visual sample，未修改该功能且不关闭旧正式门槛。阶段安全和真实图表仍适用。仅保存本会话须标注，不能以回调假装 SQLite。

2026-10-07接口增补（owner design_sample，root批准）：DS03/04通过scoped CSS和推荐样板显式chart字体及Text400实现；图上Text几何保留14/21，作为已批准E08局部例外，普通正文14/22。DS09增加推荐样板opt-in已知决策导航/无未来分母统计；baseline保留源问题；不修改三笔fixture来掩盖泄漏。生产默认路径不启用preview props。最小真实图表门槛证据：screenshots/sample-base-calibrated-s0.jpg、sample-base-calibrated-s1.jpg；原生下一根与Text创建已由root操作。

最终校准增补（2026-10-07，派发前 root 批准）：DS03/07/11 读取既有 `visibleDrawings` 的 Text 完整原文，提供推荐模式独有的图上同源阅读区与图形选择入口；按真实形成阶段/补记元数据标识，不能复制 fixture 文案、改写原图形或绕过截止。桌面可明确展开，窄屏全文默认可读。S1 实图显示长 Text 因价格自动缩放被下/右裁切，选择只读图层没有全文入口；故该补充用于保持关键判断可读。DS04/05 包括保存 secondary hover/active、36 方框与 coarse44 方框、输入唯一边界对比；DS06 context 必须使用正在编辑快照的阶段。owner design_sample；root 真实交互/测量；theme_audit 独立画面验收。

最后状态增补（派发前）：DS04/09/11 的“更多 / 记录”展开也属于推荐自然页面流。901px root真实点击More后，计划按原契约关闭，但原生More grid/flex固定预算把图壳与stage压为220、读数另占27，时间轴被裁；回放容器高度不足只露摘要。证据 `screenshots/recommended-boundary-901-more-pre-fix.jpg`、同名报告JSON；D14见补充诊断。owner design_sample仅推荐CSS，保持原有开合/关闭计划/双截止行为；root验1440/901/390展开与关闭，theme_audit直看修前后代表图。先解除这个状态的自然流冲突，不扩展新功能。

最终组合状态回开（派发前）：DS02/04/10/11，E03/09/19，07-interaction-states 与现有图表工具归属；独立视觉审查真实390图显示 `.recall-fit-all` 在回放/More末尾遮挡，源 `.recall-chart-shell` 的 position:static 解除绝对定位锚点（D15）。root 实测1201+More+导航 main981/stage220/shell454（D14扩展），保留 fit-nav-fail 图与JSON。owner design_sample仅推荐CSS修壳为relative并解除sticky、明确所有More stage height/min-height 与原clamp/360/240一致；不改图表数据/More/导航状态。root 复验390原文滚动与More、901、1201导航、1440；theme_audit独立直看修前后，不接受操作遮挡作为审美取舍。

D12组合回开（派发前，DS02/11，E01/19，02参考）：root真实1201导航展开+计划开+More关，main981、stage440、shell220/scroll467，原220容器壳裁切复现；证据1201-plan-nav-fail.jpg/JSON。owner design_sample 推荐plan-open壳/rail解限覆盖所有>=901窗口、保留mid stage360和desktop clamp，不扩成阶段或数据改动；root验普通→More→关闭→plan开，theme直看图。

最终覆盖结果：DS01–13/15的本轮视觉样板代表要求由reports/diagnosis-source、diagnosis-addendum、browser-journeys、verification、visual-review及preview-seam-review对应，分项准确范围见FINAL-ACCEPTANCE。完整三阶段和Text不由worker报告代签；root原生操作与theme直接视觉已分别验收。DS14启动包仍NOT VERIFIED。DS04 hover/active/触控及DS09同K多成交/完整未来矩阵等非代表验收范围明确NOT VERIFIED，规范列作后续必验；不关闭正式功能票。D11/D12/D14/D15历史FAIL保留，最终源审和已见视觉门槛PASS。
