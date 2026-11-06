# 2026-11-06 逐项根因修复

State: open
Status: in-progress
Assignee: root
集成负责人: root

最新阶段：B07首片四币种全局默认本金[独立验收](b07-global-capital-independent-acceptance.md)与[root局部接受](b07-global-capital-root-acceptance.md)已执行，完整UI因原生下拉键盘NOT VERIFIED仍不接受，整个多币种闭包仍未完成。当前实施[B01首条日线旅程后端](b01-first-journey-implementation-plan.md)，首个安全只读HTTP接口由404到200，过程与UI未验收。覆盖边界已[接受371文件快照](four-entry-source-boundary-root-review.md)；下表旧195候选与42/42结果是历史状态，四入口95%仍未知。Recall原FAIL仍STOPPED，不重跑。

用户本轮授权重新调查先前暂停的问题：逐个定位、修复；连续五轮没有进展则记录并转到下一项。历史 FAIL / STOPPED 证据保留。进展指可重复反例、定位到边界的根因证据、回归测试转绿或真实用户旅程前进；只改方案文字不算功能通过。

测试沿用用户已确认入口：导入校验、预览/保存/重导/失败保护、练习读取及返回、统计；账户/本金切换和保存、复盘保存与行情对应亦已授权。不重复请求确认。测试先红后绿，隔离 SQLite；不更改正式配置或业务数据，不做两库对账。本轮日线优先，触屏、窄屏、小时回放排除。

原设计来源：`docs/design-system/trading-library-design-spec.md`、`docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md`、`docs/specs/2026-09-25-chart-first-review-ui.md` 及原功能 DESIGN-COVERAGE.md。修复保留既有视觉尺寸与层级。整页视觉不因局部功能通过而接受。

项目默认实现模型 gpt-5.6-luna 当前工具不可用；root 负责实现，独立诊断/验收 Agent 按实际可用模型记录，不冒称 Luna。并行仅做互不修改实现的调查，修复顺序如下。

2026-11-06 现状以 [CURRENT-STATUS.md](CURRENT-STATUS.md) 为准；下列八项已更新为有版本与范围限制的阶段结果。后文“实现前合同”和历史 FAIL / STOPPED 继续保留，不作为当前未开始状态，也不因局部通过改写为整体完成。

| ID | 问题/缺口 | 本轮进展 | 当前状态及未完成边界 | 负责人/证据 |
| --- | --- | --- | --- | --- |
| B01 | 日线回放误报版本变化、标题及完整旅程 | 区分缺升级的503与真实409；贯通练习/配对完整标题，第二次CSS修复后独立36/36 | 分类、单步/返回及标题局部PASS；一次下一根完整过程、播放/暂停、上一根、阶段、持仓Text、快照及事后复盘未完成/未验收 | root；[标题复验](replay-title-b01-fix2-independent-review.md)、[剩余根因与合同](replay-controls-remaining-root-cause-and-minimum-plan.md) |
| B02 | 本金旧请求覆盖新值 | 原子CAS及HTTP版本条件、冲突草稿和明确重读/重存；独立59测试，真实Chrome两标签持久化链经独立复核 | CNY并发修复限定PASS；其他币种不在此结论内 | root；[独立测试](capital-independent-acceptance.md)、[浏览器证据复核](capital-browser-independent-acceptance.md) |
| B03 | 浏览器返回、未保存保护与前进记录 | 原生history key恢复替代push；清理互斥恢复状态；真实Chrome含重复/多项后退及恢复后forward/back 8/8 | 已列历史链局部PASS；缺API/恢复失败不push且保留草稿提示，不能称这些环境已恢复URL；完整复盘/失败网络旅程不由此通过 | root；[独立复现与第二版复验§9–10](remaining-diagnosis.md) |
| B04 | 无手续费及原文件名完整导入、筛选应用 | 真实文件上传、确认、1D预览、保存、返回/reload、等价重导及有效日期应用15/15 | 限定旅程PASS；无费用列/全空按用户决定计0，净额不重复扣费；未发现需再修的产品缺陷 | root + independent reviewer；[导入实证](import-browser-independent.md) |
| B05 | V2 模拟列表同态视觉 | 第四次局部修复后，批准E图/正文双桌面独立30/30 | 受影响模拟列表状态PASS；统计、详情、完整回放的整套V2视觉未接受 | root + independent reviewer；[视觉复验](sim-list-visual-fix4-independent-review.md) |
| B06 | 迁移与切换证据 | 只读源在线备份、独占副本升级/重开验证；隔离v19含WAL→21及真实route通过；正式7项+13守卫+native8独立通过 | 隔离迁移局部PASS；实际业务库升级、正式服务切换NOT VERIFIED | root；[迁移拆分复验](migration-split-independent-acceptance.md)、[当前边界](CURRENT-STATUS.md) |
| B07 | 币种与汇率功能缺口 | 已确认来源版本、分币种本金、原币统计及有效FX快照的兼容方案 | 根因与设计已审查；CNY/USD/HKD/USDT完整接线、人工兜底及持久化未完成 | root + independent reviewer；[兼容审查](currency-compatibility-independent-review.md) |
| B08 | 类型检查、旧测试、隔离与覆盖率 | typecheck/build/受影响ESLint通过；迁移20、Tiger/pair65、在用旧资料读取93项分别独立通过并各附native8；27退役清点测试承接10独有保护后归档 | candidate限定路径独立15+native8及19探针PASS；两份旧I33独有Python保护正式承接，20+native8独立PASS并原文SHA归档；最新全量494文件/5064测试：2文件与2测试失败（489文件/5055测试通过，3文件/7测试跳过），634.68s；Recall原FAIL经五次情境调查根因未定，已停止，列表旧用例替换已独立47+native8通过（未重跑全量，不能删除原2 FAIL记录）；四入口联合95%未知，旧本金两文件42/42分支100%仅为历史版本、现已失效 | root + independent reviewers；[安全承接](legacy-active-read-formal-independent-review.md)、[candidate验收](candidate-fix-independent-acceptance.md)、[I33承接/归档复核](i33-formal-replacement-independent-acceptance.md)、[原文归档](../../../../archive/tests/i33-migration-diagnostics-20261106/README.md)、[覆盖候选清单](four-entry-coverage-manifest-review.md)、[现状](CURRENT-STATUS.md) |

## 本轮设计覆盖（局部影响，不替代原完整矩阵）

| ID / 原需求 | 元素/原参考 | 状态/操作 | owner | 可观察预期 | 证据 / 结论 |
| --- | --- | --- | --- | --- | --- |
| B01 / I12 + 主图规格的日线旅程 | 既有内部配对“打开日线回放”入口；原矩阵I12及本页标题合同 | 详情→回放→返回/重开；加载/冲突/失败 | root；非作者独立复验 | 正常练习可进入；缺升级不冒称版本变化；完整练习名/内部配对序号正确，真正版本保护保留 | [当前分类/单步边界](CURRENT-STATUS.md)、[标题36/36](replay-title-b01-fix2-independent-review.md)：局部PASS；[一次下一根、阶段、播放等完整合同](replay-controls-remaining-root-cause-and-minimum-plan.md)仍未实现/未验收，不关闭完整I12 |
| B02 / I16 + 用户本金保存确认 | 既有全局/练习本金保存控件；原矩阵I16 | 并发保存、响应丢失、继承默认、重读/明确重存、返回/reload | root；非作者独立测试与浏览器证据复核 | 较旧保存不能覆盖较新已确认值；冲突保留草稿，重读不自动重发，明确重存后持久化 | [59项独立测试](capital-independent-acceptance.md)、[Chrome两标签旅程及截图复核](capital-browser-independent-acceptance.md)：CNY限定PASS；不覆盖B07多币种 |
| B03 / I14 + 用户返回入口确认 | 既有列表/详情及浏览器前进后退；原矩阵I14 | 保存未决、未知history项、重复/多项后退、重读后前进再后退 | root；非作者真实Chrome复验 | 当前详情/草稿受保护，恢复原history身份且前进链不丢；恢复失败有提示且不push截栈 | [第二版NH-01～08真实Chrome 8/8](remaining-diagnosis.md)：所列历史链局部PASS；旧FAIL保留。复盘未保存、缺API等真实浏览器及完整持久化/reload不由这8项覆盖 |

前端控件审计触发：影响交互及状态接线；仅登记受影响控件和上下游旅程，鼠标/键盘与组件证据分列。视觉/浏览器未实际运行时如实标 NOT VERIFIED。

### V2 模拟列表局部修复合同（实现前登记）

参考：V2.0 正文第二章 `LIB-V20-BT02` 与 `approved-e-sim-list-1440.jpg`；独立红灯 `replay-schema-and-sim-list-independent-20261106.md`。比较视口1440×1000与1280×800桌面，不包含触屏或窄屏。root 负责整页视觉及原有数据链；独立 replay_diagnosis 验收，不删除搜索/生效摘要/账户范围/兼容交易入口，不改变筛选或保存语义。

| ID | 精确参考/目标 | owner | 旅程与证据目标 |
| --- | --- | --- | --- |
| VIS-SIM-01 | 正文二章页面标题24/32 | root | 正常/空/错误标题大小，真实截图+计算样式 |
| VIS-SIM-02 | E模拟列表模式分段外框184×44、每项88×36，邻接列表/统计 | root | 模式/页签真实鼠标，选中状态截图 |
| VIS-SIM-03 | E日期290、市场180，字段高36 | root | 日期展开/取消/应用、市场/账户长标签，不遮挡 |
| VIS-SIM-04 | E表头40px、同卡片表面；正文14/20 | root | 正常/空/加载，表头与数据不重叠 |
| VIS-SIM-07 | 正文二章日历16、搜索18、刷新16，动作盒36 | root | 图标不影响可访问名称与功能，截图+点击 |
| VIS-SIM-05/06 | 完整练习名的列分配、已有交易兼容入口 | root | 保留独立FAIL；本次不以删信息或自行批准新布局掩盖差异 |

布局尺寸修复是原批准合同的恢复，不新增功能；不为纯CSS写镜像测试，使用真实浏览器对照。日期校验、搜索、刷新/返回测试沿用现有用例。

### 列表视觉第三次修复边界（实现前）

独立审查确认 V2 正文没有规定七列的固定百分比。保留完整练习名、共享列锚点及自然换行，不把参考的短样例文字当列宽合同。VIS-SIM-05 恢复 E 原型的正文中性常规字重、左右12px内边距和单行48px行基线；长内容允许自然增高，不裁切练习名。列标题保持12/20、500字重。

VIS-SIM-06 不增加或删除入口。集成负责人决定将列表态的既有交易兼容入口放在列表之后的独立右对齐工具行，详情/回放态维持原入口位置和保存保护。该入口来源是当前 DESIGN-COVERAGE 的旧数据可达要求，E 原图未定义位置；这是明确的兼容入口布局决定，不冒称原图包含它。移除 grid-area 叠放和筛选行300px占位，列表筛选/表格回到连续文档流。独立验收必须分别核查 V2 主体视觉及该附加入口的可达、未保存保护和无遮挡；保留前两轮FAIL证据。

第三次独立检查发现卡片外缘仍缺 E 原型第39行的18px内边距：首列文字较批准图靠左约19px。第四次修复仅恢复卡片18px内边距及10px圆角、工具行改用卡片内边界（下间距16px），分页沿相同左右内边界。表格行列及交互不变；1440/1280双桌面重新截图和检查长名称/空态。此前字重、行高及入口文档流修复已有可测进展，不把这次新发现解释为连续五轮无进展。

### B01 完整回放标题修复（实现前）

用户已确认标题使用完整练习名及“内部配对 n”；当前回放 h1 只有标的名称，根因为浏览器只向回放传 instrumentName，丢失练习日期、编号及所选配对序号。root 为两组件唯一实现 owner；不改变回放阶段、游标、金额或数据模型。沿用原 B01/I12 及 V2 配对命名合同，相关图为原 DESIGN-COVERAGE 中的回放标题参考。选择第 n 行→加载/重试同一 pair→标题应为 `<完整练习名> · 内部配对 n`，返回/重开保持身份一致，旧响应不得显示另一练习。先扩展已有公开入口测试制造红灯，再由独立 Agent 复审并实际浏览器检查长标题布局。该局部不代表完整回放功能放行。

### B08 日常测试维护合同（实现前）

全量红灯及两份独立诊断确认：正式 persistent CLI 的单个 case 串行启动多个进程超过默认5秒，断言已完成；不改变全局超时，不改变产品逻辑。root 将同一公开迁移入口拆成独立命名的输入摘要、来源真实性、缺失关联、中断保护和成功/重试旅程，每项使用新建 v14 隔离源、独立候选目录；保留原来全部错误特异断言和原文件保护。历史独立重复脚本的唯一非空 thesis/psychology 保全验证先转入正式成功旅程，确认通过后才能归档。文件链接旧组合例改正为目标目录保护，正常链接必须先移除目标 marker，保留目录 alias 的独特覆盖；不回退保护。新变更由未实现的 Agent 复核用例覆盖映射。

B01 标题首验保留红灯：真实1440桌面被全局Recall heading的280px预算与h1省略规则截断，1280原grid完整。第二次仅加pair专用class覆盖heading的flex上限及h1换行/overflow；保留当前实际18px字号、现有36px操作盒、阶段和返回位置，不改变实盘Recall。重新按独立红灯同样两练习三配对双桌面比较header/plot高度、完整名和返回焦点。


### B08 旧清点测试迁出前的安全承接合同

根因：legacy-practice-coverage 已无产品调用，仍把支持的迁移列表硬编码为20；当前21使27个清点case中22红、部分 unavailable 用例产生假绿。不能靠把20改21恢复已延期的对账范围。先将有效的产品读取保护迁到当前 `LegacyPracticeReferenceStore.readCurrent` 与 `PracticeStore.readWithLegacy`，保留17/18→21升级后的原始交易、来源、旧复盘和绑定逐值不变，以及升级失败回滚、弱化schema拒绝。v17升级前只使用支持v17的reference读取，升级后才要求详情入口，不人为添加不存在的v17页面支持。

独立probe已确认8个历史schema异常、迁移名称篡改及部分成交关联丢失是需补的唯一读链保护：使用真正的17/18/19/20迁移前缀、先证实正常绑定可读，再制造异常，要求当前读取拒绝且十张保护表及total_changes不变。已覆盖的提交前checksum/未来表/未来版本保护不复制成同义case。root单独修改正式测试，独立Agent负责核对27case去向及真实隔离复验；只有承接通过后将旧清点测试保留原文移至archive，排除日常回归，不调整覆盖率阈值或Vitest排除项。旧工具实现保持原状并明确非生产、未修复。文档和测试维护不改变产品UI或业务数据库。


### B08 历史候选命令的版本漂移修复合同（实现前）

独立当前14例复现为5红9绿：fixture调用latest21，却向只接受16/17静态隔离源的手工candidate命令输入，部分拒绝测试因此假绿。真正16/17隔离反例进一步证明：升级合法新增18–21表，使原snapshot整对象比较误报 `legacy table values changed`，虽交易/复盘原行未改仍无法生成候选。该工具只有显式手工CLI，无应用/UI/正式persistent迁移调用；不将其修复称为正式业务切换，不扩大对账范围。

root唯一owner修改candidate及该测试。先用准确16/17迁移前缀还原输入，保留五条失败链作red；修复只调整保全比较的阶段：升级后先证明原快照全部key逐值和旧schema/migration行不变，再以完整升级后保护快照对照绑定写入及重开。不得把新表放进mutable跳过，不降schema/来源hash保护，不拓宽支持源版本，不改正式配置/数据。原先16→17的旧预期应明确为16→当前21；原source hash不变、四组关联、坏计划/坏Recall/重试/seq与migration触发器保护继续验。独立Agent审查原行和新表均被保护、所有旧拒绝case确实过了支持版本门槛，默认超时复验，不添加复用重复case。

### B08 两份旧 I33 套件迁出合同

当前两套均因缺必填sourceSha256提前失败，初验还记录了旧危险行为的成功断言，不能靠补SHA追绿。独立诊断已区分正式迁移7例、应用打开保护13例及Python配置切换的独有保护。root将最后一项承接到正式persistent既有发布后中断case：复用真正中断的隔离候选，调用历史切换工具，要求精确INCOMPLETE错误、合成配置完整字节/原库/候选/marker不变、无临时配置或sidecar；不另建重复迁移case、不放宽默认超时。该调用只是运维数据库切换工具保护，不是产品中的项目文档管理。现有工具仍是显式手工入口，不推广为已验收正式切换。承接与独立复验通过后才将两份原文移archive，历史FAIL保留，不变产品/config/coverage阈值。
