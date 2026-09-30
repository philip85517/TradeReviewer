# 策略库与实验交互模型 · 审阅记录

当前修订：04，用户最新要求新建实验与选择策略归“我的实验”，补齐独立实验列表。下方提案01及修订02/03保留历史；本轮结果见末尾“修订04”，不能把旧入口或旧PASS当作当前状态。

日期：2026-09-30。当前范围：[任务 09](issues/09-strategy-library-interaction-model.md)的[交互模型](strategy-library-interaction-model.md)与 [F01–F19 静态画板](strategy-library-wireframes/index.html)。提案01仅覆盖F01–F08，修订02新增F09，修订03新增F10–F13，修订04新增F14–F19并纠正来源入口，各节证据独立。这份记录确认设计产物可供用户审阅，不是任务 09 的用户 resolution，也不是任务 10 的业务原型验收。

协调者/模型及整页 owner：Codex 主协调者。修订01–03独立模型审阅：strategy_todo_audit；独立视觉审阅：verify_compaction_config。修订04独立视觉审阅：entry_visual_review。审阅者未修改对应模型或画板；每轮结论以各自记录为准，旧原型通过记录不代替当前证据。

## 模型复核

| 项目 | 结果与证据 |
| --- | --- |
| 对象和职责 | PASS：M02/M06 区分三类包、完整策略、实验、独立组合及运行；候选、信号、意图、成交分别表达 |
| 两条完整旅程 | PASS（模型表达）：J1 库内保存后明确用于新实验；J2 实验内创建成功追加、取消不改选择、失败保留输入，并列出全部保留字段 |
| 返回契约 | PASS（模型表达）：M05 区分库、列表、草稿、工作台、结果和比较来源，嵌套查阅不丢来源；不统一回实验首页 |
| 历史复制与旧整体包 | PASS（模型表达）：J3/J3-L/M08，复制建立新身份；旧整体包在 F08 明确映射三类槽位，不同名猜测、不复制账本 |
| 预设归属 | PASS（模型表达）：M07 将包内规则参数与实验组合仓位/调仓配置分开；初始持有不静默禁用止盈止损 |
| 版本锁定 | PASS（与现有原型核对）：M08 沿用进入工作台即建立锁定运行、T0 待开始且无成交；未等待首次播放才锁定。核对 `app/components/strategy-prototype/creation-prototype.tsx` 的 ConfirmStep `onEnter`，约 L2084–2101 |
| 异常恢复 | PASS（模型表达）：M09 含空库/无匹配/缺包/不兼容/参数错误/数据缺失/无候选/无信号/未成交/保存失败/过期返回等，均给出后续动作 |
| 覆盖与范围 | PASS（模型表达）：SL-C01–12、LIB01–05 在正文第 8 节和 DESIGN-COVERAGE 有映射；四步、五档期限、独立本金、截止及来源不被删减 |
| 用户选定与 09/11 合并认可 | NOT VERIFIED：未收到用户对提案 01 的反馈，未写 resolution；09 保持 open / prototype-feedback，10 仍阻塞 |

审阅修订过程保留：首次模型审查指出来源返回表、旧整包路径、两类预设边界不足，已在 M05/J3-L/M07 补齐。审阅曾建议首次推进才锁定；协调者查当前 v2 代码后保留进入工作台锁定，第二次独立复核确认无剩余模型阻断。具体止盈/止损交易阈值及执行冲突仍是后续明确契约，不冒充已支持规则。

## 静态文档浏览器与视觉

真实浏览器：Codex IAB，127.0.0.1:3062；分别设置 1440×900、1280×800。16 次画板导航均显示对应内容，全部无页面横向溢出。截图为视口截图；F02/F03/F05 的 1280 内容额外真实滚动后捕获。查看完恢复临时视口设置。

| 检查 | 结果与证据 |
| --- | --- |
| 文档画板导航 | PASS：F01–F08 在两档尺寸逐一点击文档导航并截图；[渲染检查数据](strategy-library-wireframes/screenshots/render-checks.json) |
| 整页风格/密度 | PASS（静态模型范围）：独立审阅直接查看现有应用基线与旧创建页，比较 F01/F02/F03/F05/F07 的两档截图；约 200px 侧栏、深色框架、蓝色主动作、组成摘要与层级一致。浅色顶部为明确标识的设计文档导航，不属于产品 UI |
| 历史与追溯可读性 | PASS（协调者检查）：[F04 历史版本](strategy-library-wireframes/screenshots/f04-1440.png)、[F06 锁定配置](strategy-library-wireframes/screenshots/f06-1280.png)、[F08 旧包映射](strategy-library-wireframes/screenshots/f08-1280.png) 主体及动作可读 |
| 底部内容可达 | PASS：见 [F02 组装滚动到底](strategy-library-wireframes/screenshots/f02-1280-scrolled.png)、[F03 面板滚动到底](strategy-library-wireframes/screenshots/f03-1280-scrolled.png)、[F05 实验选择滚动到底](strategy-library-wireframes/screenshots/f05-1280-scrolled.png)；独立复核确认正文与固定底栏不重叠 |
| 键盘、表单保存、新建返回、重载 | NOT VERIFIED：业务按钮仅静态示意，没有执行这些旅程；M10 是后续原型的交互要求 |
| 真图表/引擎/数据库 | NOT APPLICABLE：09 只设计模型，未修改应用、执行脚本或写业务库；后续必需门槛保持 |

独立视觉审阅的原始 FAIL 与复核：首屏截图曾被判断为 F02/F03/F05 底栏遮挡。协调者补充真实滚动截图与边界测量：F02/F05 内容下边界和 footer 上边界同为 738px；F03 drawer body 下边界与 footer 上边界同为 736px。复核撤销遮挡判断，确认是允许的内部滚动。保留非阻断观察：1280 首屏密度较高，需要滚动阅读全文。未据此缩小文字或删除信息。

## 交付与后续

文档检查通过：`git diff --check` 无错误；本轮相关 7 份 Markdown 的 124 个本地链接全部存在；生成器语法可解析，HTML 含 8 个画板、无脚本，19 张浏览器截图齐全。frontier 确认 09 已领取且未关闭，10 仍等待 09/11。应用目录没有本轮改动。

预览：[提案 01 画板](http://127.0.0.1:3062/#f01)。[启动说明](strategy-library-wireframes/README.md)包含生成与静态服务命令。服务只绑定本机，不连接数据库。

下一步收集用户对四项具体提议的反馈：完整策略优先；每类一个命名包；全页组装加包选择面板；组合预设归属及编辑/复制版本语义。与 11 合并导航/身份/返回约定后，按真实反馈记录 resolution，再进入 10 的视觉细化和可点击旅程。

本轮交付结论：模型提案与静态画板具备审阅条件；用户批准未验证，完整策略库功能未实现。不提交、推送或修改任何历史交易数据。

## 修订02 · 整体认可后补充风格兼容及包详情（2026-09-30）

用户原话和接受边界见[独立反馈记录](comments/strategy-visual-09/2026-09-30-feedback-resolution.md)。首版模型获得整体认可，追加 SL10/SL11：沿用现有网页风格、包说明/细节可进入并方便返回。已落实模型 M11、F09、LT-J、覆盖 SL-C13/LIB06 及任务10的功能/状态/视觉验收。09保持open，未把新增画板、10或11记作用户已经验收。

本次改动画板为F02槽位详情意图、F03详情链接、新增F09，以及9页文档导航。F03移动退出的“说明与细节”跳F09；F09顶部/底部两个返回链接均回F03。其他保存/选择/运行仍静态，不进行业务保存。画板中的阈值/数据声明为内容字段示意，未绑定真实包规则。

| 项目 | 结果与证据 |
| --- | --- |
| 模型入口/返回 | PASS（独立模型复核）：strategy_todo_audit复核M10/M11、反馈resolution和10新增验收，无模型矛盾或错误接受范围。目录、完整策略详情、已选槽位、选择列表、实验草稿与锁定运行入口齐全；查看不选择/升级，逐层返回保留身份、草稿、搜索、滚动、待选项及外层来源。详情层Escape先退列表；业务验证列入10 |
| 真实浏览器文档跳转 | PASS：点击F03详情链接进入F09；分别点击F09底部、顶部返回回F03。只证明设计文档链接，没有使用静态文字冒充可编辑状态验证 |
| 两档全页渲染 | PASS：1440×900、1280×800 共18次文档导航，9页目标全部正确，无页面横向溢出；见[测量](strategy-library-wireframes/screenshots/feedback2/render-checks.json) |
| F09可读性/底部可达 | PASS：[1440首屏](strategy-library-wireframes/screenshots/feedback2/f09-1440.png)、[1440末尾](strategy-library-wireframes/screenshots/feedback2/f09-1440-scrolled.png)、[1280首屏](strategy-library-wireframes/screenshots/feedback2/f09-1280.png)、[1280末尾](strategy-library-wireframes/screenshots/feedback2/f09-1280-scrolled.png)。1280正文底部和footer顶部均736px；scrollTop527+clientHeight528=scrollHeight1055，内容完整可达 |
| 返回后的选择视图 | PASS（静态表达）：[1440返回态](strategy-library-wireframes/screenshots/feedback2/f03-return-1440.png)、[1280返回态](strategy-library-wireframes/screenshots/feedback2/f03-return-1280.png)明确区分当前固定退出与待选移动退出，详情不会在画板语义上替换原选择 |
| 独立视觉审阅 | PASS（静态范围）：未修改画板的verify_compaction_config直接查看上述首屏/末尾/返回图，对照creation-baseline-1440.jpg和旧create-strategy-1280.png；侧栏、深色框架、文字层级、间距、边框、蓝色链接/主动作及提示色兼容，无阻断差距。长正文需面板内滚动是允许行为，未缩字删信息 |
| 业务返回/焦点/浏览器历史/持久化 | NOT VERIFIED：本轮仅静态模型；M11/LT-J和任务10明确后续分别验证，未以截图代替 |
| 用户新增画板反馈 / 09整票接受 | NOT VERIFIED：整体认可是真实记录；本次新补画板没有追加真实审阅反馈，09保持open，不跳过11或共同框架对齐 |

本轮六张截图及测量保存在 `screenshots/feedback2/`，原19张及原FAIL复核历史不覆盖。服务仍运行在 [包详情预览](http://127.0.0.1:3062/#f09)，启动方式见[README](strategy-library-wireframes/README.md)。完成检查后已恢复浏览器临时视口设置。

最终文档校验：`git diff --check`通过；相关10份Markdown的181个本地链接无缺失；生成器语法通过、9个画板、无脚本、6张新增截图。frontier确认09/11仍claimed、10依赖仍阻塞；应用目录无本轮差异。独立复核指出旧审阅记录易混淆，已在顶部标明历史范围并追加本节；F04/F06包名的实际可点击入口按M11和任务10实现，当前静态画板不宣称已接通全部入口。

## 修订03 · 大量策略包的查找与整理（2026-09-30）

本轮需求及部分决定见[反馈记录追加段](comments/strategy-visual-09/2026-09-30-feedback-resolution.md)。新增SL12–SL15、LD10、LT-K–M、模型M12/J4与覆盖SL-C14–17/LIB07。用户明确希望支持规模管理；当前默认排序、个人偏好、统计去重、归档影响及恢复位置是供审阅的设计提案，未伪造逐项批准。

整页和模型负责人：主协调者；静态画板实现：library_scale_boards（gpt-5.6-luna），只允许写build.py/index.html；独立模型审查：strategy_todo_audit；独立视觉审查：verify_compaction_config，两名审查者均未实现对应画板。沿用现有应用参考与1440×900、1280×800比较视口，授权差异仅本轮新增目录/管理内容、文档导航增加画板和内部滚动。

F10为紧凑包目录，F11为独立整理顺序，F12为目录来源的全页说明及统计，F13为归档影响确认。统计样例区分包级12个不同当前策略与v3子集8个，历史策略版本/实验另列。包目录顺序不改变策略执行，归档不删除引用或禁用原实验；实际操作由任务10验证。以下为本轮新证据，不沿用旧PASS作为本轮结论。

| 项目 | 结果与证据 |
| --- | --- |
| 独立模型复核 | PASS：strategy_todo_audit核对M12、LD10和09/10，当前策略去重、版本子集、历史引用、排序/置顶及归档恢复一致。按审查意见补齐F05/F02/F03归档入口表，区分已有完整策略继续实验、复制显式沿用、新增槽位禁选；审阅顶部和09证据均已区分历史与当前范围 |
| 真实浏览器文档路径 | PASS：[10次链接走查](strategy-library-wireframes/screenshots/feedback3/journey-links.json)涵盖目录包名→详情→归档确认→取消回详情→目录、整理→取消回原查询，以及原F03→F09→F03。仅证明图示导航，未宣称真实筛选/草稿/焦点已经保存 |
| 两档导航与尺寸 | PASS：[26次导航](strategy-library-wireframes/screenshots/feedback3/navigation-checks.json)涵盖1440×900、1280×800的全部13张画板，页面及工作区无横向溢出。[16组首屏/滚底测量](strategy-library-wireframes/screenshots/feedback3/render-checks.json)确认200px侧栏、48px身份栏；新归档面板480px，两档正文下边界与底栏上边界分别均为775.5px/675.5px |
| 目录及整理可读性 | PASS：[F10 1440](strategy-library-wireframes/screenshots/feedback3/f10-1440.png)、[F10 1280](strategy-library-wireframes/screenshots/feedback3/f10-1280.png)、[F11 1280末尾](strategy-library-wireframes/screenshots/feedback3/f11-1280-scrolled.png)。目录10行、2置顶/126普通的样例与排序一致，1280保留备注和操作列；整理动作及取消/保存可滚动到达 |
| 详情及归档长内容 | PASS：[F12 1280末尾](strategy-library-wireframes/screenshots/feedback3/f12-1280-scrolled.png)具体引用项及常驻返回可读；[F13 1280首屏](strategy-library-wireframes/screenshots/feedback3/f13-1280.png)和[末尾](strategy-library-wireframes/screenshots/feedback3/f13-1280-scrolled.png)固定标题/底栏、正文独立滚动，恢复说明可达 |
| 独立视觉比较 | PASS（静态设计范围）：verify_compaction_config直接查看F10–F13两档首屏/末尾，对比既有应用1440与旧创建页1280参考。框架、密度、颜色、层级、包名/标识、统计日期、入口和归档层无阻断差距。F13滚动途中行被正文边界裁切与文档导航末尾标识需横滚，属于允许的内部滚动；未通过缩字或隐藏列解决密度 |
| 业务与持久化 | NOT VERIFIED：搜索、标签编辑、个人置顶/跨页移动、保存/取消草稿、归档/恢复、统计计算、焦点与真实原处返回尚未实现。任务10/LT-K–M保留合成多页操作与异常验收；正式数据写入阶段必须使用隔离库并验证返回/重载及原引用不变 |
| 用户对新增具体规则的接受 | NOT VERIFIED：需求方向已明确，本轮默认值与新画板供审阅；09保持open / prototype-feedback，10保持等待09/11，不因静态PASS关闭设计票 |
| 图表、执行引擎、业务库 | NOT APPLICABLE：本轮仅设计文档和无脚本HTML，没有连接或改写业务数据 |

初次发现及修复保留：目录搜索/标签条件与样例不符、非置顶日期未按所示顺序排列、F10/F11置顶数不同、取消误写成切换手动排序，以及归档后计数仍16，均已校正。F12补具体引用项并将返回摘要设为sticky；协调者移除整理页中会绕过整理返回上下文的额外详情链接，保留目录包名与“查看详情”入口。[F13原FAIL截图](strategy-library-wireframes/screenshots/feedback3/f13-1280-before-fix.png)显示整框滚动使取消/确认不在首屏；已改为应用内容层覆盖、固定头尾、仅正文滚动，并通过两档复核。旧截图及旧结论不覆盖。

生成器语法与HTML结构检查通过，13张画板、所有内部锚点存在、无脚本。修订03保留18张截图（16张新画板首屏/末尾、1张原FAIL、1张F03回归），以及导航/测量/路径记录。预览继续运行在[大量包目录](http://127.0.0.1:3062/#f10)，[启动说明](strategy-library-wireframes/README.md)可重启本机静态服务。结论仅为交互设计已更新并可审阅，未称策略库功能完成。

## 修订04 · 实验入口归“我的实验”（2026-09-30）

用户纠正库内“用于新实验”入口，要求在“我的实验”选择和使用策略。当前模型M13、SL16/LD11/LT-N、覆盖LIB08/09与任务09/10已同步。F01/F04只管理策略；新增F14列表、F15–F18四步创建及F19库内独立新建；F02/F03/F09明确实验来源。F05保留两策略保存后态，独立于F16–F18的一策略样例，不用跨样例跳转冒充保存后状态。

整页与完整来源流程owner：主协调者；画板先由library_scale_boards实施，续作finish_entry_boards修正（均为gpt-5.6-luna，仅build.py/index.html）；独立模型审阅strategy_todo_audit，独立视觉审阅entry_visual_review，未实现对应画板。对比参考为现有应用基线（文件名1440，实际1417×900，仅作风格参考）、旧创建页1280×800、修订03 F10两档图及M13明确的200px侧栏/48px身份栏/40px业务tab。

| 检查 | 结果与证据 |
| --- | --- |
| 模型及任务边界 | PASS（独立语义复核）：策略管理、实验创建/选择、两类策略编辑来源一致。LD03按复核意见写清库内独立保存后须切到实验主动选择；没有把用户此前“整体ok”扩大为新画板已接受 |
| 业务入口及静态路径 | PASS：[20次实际点击](strategy-library-wireframes/screenshots/feedback4/journey-links.json)，含策略库→F19→取消、业务tab→我的实验→四步→逐级返回，以及实验内新建→换包→详情的顶部/底部返回→取消回原选择。仅证明图示链接正确，不证明草稿/选择/焦点持久化 |
| 两档整体渲染 | PASS：[38次文档导航](strategy-library-wireframes/screenshots/feedback4/navigation-checks.json)覆盖全部19张画板；1440×900与1280×800，实测DPR1、visualViewport.scale1，无页面或工作区横向溢出。文档导航自身横滚属于设计工具，不是产品工作区 |
| 实验列表和四步内容 | PASS（协调者静态核对）：[F14列表](strategy-library-wireframes/screenshots/feedback4/f14-1440.png)及[末尾](strategy-library-wireframes/screenshots/feedback4/f14-1280-scrolled.png)包含五状态、研究区间和对应动作；[F16选择](strategy-library-wireframes/screenshots/feedback4/f16-1280.png)显示数据待预检，F17再展示通过示例；[F18确认](strategy-library-wireframes/screenshots/feedback4/f18-1440.png)保留完整包名、时间、独立本金和执行限制。样例统一为趋势回撤v1/1组合/¥100,000/一周/定期再平衡 |
| 长内容和返回可达 | PASS：[41组测量](strategy-library-wireframes/screenshots/feedback4/render-checks.json)对应首屏或滚底图。F01/F04/F19的1280末尾完整可达；F15–F18页内底部操作滚到末尾可见；[F09 1280末尾](strategy-library-wireframes/screenshots/feedback4/f09-1280-scrolled.png)正文scrollTop527+528=1055，正文底和固定底栏顶均736，顶部/底部返回仍可見 |
| 独立视觉比较 | PASS（静态设计）：entry_visual_review直接对照参考与M13，审阅F01/F04/F14–F19/F02/F03/F09两档首屏及必要滚底图。框架、配色、密度、层级、来源高亮及返回一致；F14研究区间、F16数据状态的原FAIL已复核消除；F18完整包名在1280无截断，无剩余视觉阻断 |
| 功能、状态安全与持久化 | NOT VERIFIED：真实搜索/选择、新建保存/失败、草稿保留、重开原运行、焦点/键盘/浏览器历史与重载仍归任务10；静态按钮不执行这些操作。鼠标证据仅是图示链接；触摸未验证 |
| 用户最终接受与任务依赖 | NOT VERIFIED：09保持open / prototype-feedback，10继续等待09/11共同导航、身份和返回契约；未启动功能开发，不关闭设计票 |
| 图表、执行引擎与数据库 | NOT APPLICABLE：本轮仅文档和无脚本画板，不执行交易或连接业务库；后续正式写入仍需隔离库验收 |

修复历史保留：待开始实验曾误链新建确认页，已改为重开原运行的静态动作；起点页的多余步骤已统一为四步；F18曾误写整数股限制，已恢复既有零费用/分股演示和交易日历未接入的边界；F17明确T0可知候选与后续逐日揭示。F14缺研究区间、F16缺数据可用性是独立审阅的原FAIL，已修正并在`feedback4/`保留8张`*-before-fix.png`；不覆盖原失败证据。保存策略和使用此包保留静态意图，不链接到不匹配的普通选择/旧退出槽位。

当前共19张无脚本画板，生成器语法、内部锚点检查与`git diff --check`通过；10份相关Markdown的210个本地链接均存在。新增49张浏览器图（41张最终状态和8张原FAIL），以及导航、尺寸、路径3份JSON；此前轮次证据保留。预览为[我的实验](http://127.0.0.1:3062/#f14)，服务只绑定本机3062；[启动说明](strategy-library-wireframes/README.md)给出生成和启动命令。交付前已在真实浏览器重新打开F14并滚至顶部、恢复临时视口设置，确认静态服务仍监听3062；本轮交付为可审阅设计，不代表业务功能或用户最终验收完成。

## 修订05 · 双列表工具栏与卡片效率（2026-09-30）

规格SL17/LD12/LT-O、模型M14、LIB10及任务09/10同步。仅补齐F01/F14工具栏，卡片未改版；[专业评估](strategy-library-card-ui-review.md)给出实测、问题和建议。root负责整页/模型及真实浏览器验收，finish_entry_boards（gpt-5.6-luna）仅实施build.py/index.html，entry_visual_review独立直接读图。参照修订04同状态截图，两档CSS视口1440×900和1280×800，DPR1、缩放1；旧产品基线仅作风格参考。

| 门槛 | 结论及证据 |
| --- | --- |
| 静态设计内容 | PASS：F01补显式排序和控件式定义状态筛选；F14统一工具栏，均有搜索/筛选/带方向排序及数量。控件40px高、搜索实测440px、间距10px；4个场景无水平溢出。见[尺寸](strategy-library-wireframes/screenshots/feedback5/after-measurements.json)与[F01 1280](strategy-library-wireframes/screenshots/feedback5/f01-1280.png)、[F14 1440](strategy-library-wireframes/screenshots/feedback5/f14-1440.png) |
| 静态路径 | PASS：[6次实际点击](strategy-library-wireframes/screenshots/feedback5/journey-links.json)确认F14→新建F15→返回、业务tab→F01→新建F19→取消→F14。实验与策略入口归属未回归；不证明保存或真实查询状态 |
| 独立视觉比较 | PASS（本轮工具栏范围）：entry_visual_review直接成对打开feedback4/feedback5四状态共8图，控件/条目数完整、同层级且风格兼容，新建各在所属页右上。卡片内容、内部层级和尺寸保持；F01首卡整体上移4.5px、F14上移0.5px是工具栏间距变化，不声称绝对位置未变 |
| 卡片评估 | 已交付：实验194.7px，双档首屏完整2张；策略151.0/157.0px。独立审阅赞同优先减少实验冗余、保留策略三类包横向对照。策略缺更新时间、实验重复字段等作为后续建议保留；120–150px/112–136px仅试稿目标，未实施、未批准，不写成卡片优化PASS |
| 文件验证 | PASS：生成器语法、19画板、所有内部锚点、无脚本、四场景控件高度和原卡高不变、本地文档链接、git diff --check。检查记录见[verification.json](strategy-library-wireframes/screenshots/feedback5/verification.json) |
| 真实查询与状态 | NOT VERIFIED：输入搜索、菜单展开、组合筛选、排序结果、分页、详情返回恢复、键盘/触摸仍由任务10验证；当前div/span只是设计意图 |
| 数据库/引擎 | NOT APPLICABLE：无业务代码或数据写入，本轮无需持久化验收 |
| 用户最终设计接受 | NOT VERIFIED：09继续open / prototype-feedback，10仍被09/11前置阻塞；卡片评估不当成用户已同意重构 |

证据目录 `strategy-library-wireframes/screenshots/feedback5/`：4张原始图、4张修订05图及前后测量、导航和文件验证JSON。旧证据未覆盖。预览服务仍为127.0.0.1:3062，Python PID93685；交付前实际浏览器检查并返回F14，临时视口已恢复。入口：[我的实验](http://127.0.0.1:3062/#f14)、[策略库](http://127.0.0.1:3062/#f01)；[重启说明](strategy-library-wireframes/README.md)。
