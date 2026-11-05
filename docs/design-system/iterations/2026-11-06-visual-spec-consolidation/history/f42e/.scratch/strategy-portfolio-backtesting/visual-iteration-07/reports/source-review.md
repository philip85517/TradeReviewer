# 修订07：独立原型源码审查

审查者：prototype_source_review；只读源码审查，未参与实现、未操作浏览器、未运行业务服务或写数据库。本报告是 scoped 源码审查，不能替代真实浏览器功能/视觉接受。结论：**FAIL**，下列在本轮范围内的可复现问题须修复并复核。

范围依据：当前 `visual-contract.md`、`DESIGN-COVERAGE.md`；主规格 `docs/specs/2026-10-06-strategy-workbench-review-functional-design.md` 的 DR03/05/07/08。已读当前 AGENTS.md、开发工作流、拆解标准、UI验收模板及本地任务跟踪。未把真实确认、数据库持久化、创建→A生产接线或引擎扩展作为原型缺陷。

## 被审版本

创建文件在审查期间保持以下 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| strategy-library-wireframes/build.py | `80125ed2689eee65b46bc586329801b664973cb6b94f67a0d65e1b5af2ffabc0` |
| strategy-library-wireframes/index.html | `dd5b0775d29a72c42dac45755b20f52b116de77c9fee936386ccc75f16c57b90` |
| workbench-design/index.html（主要审查读取） | `c5ca6292e97bfcbdd01438d40b739d37350173fd58fe45bccfe0359f510ff6e6` |
| workbench-design/index.html（交接前重新读取，修复仍在进行） | `37e11435446b37b626a7c14d9c3f22e3236647de3088c1366b5685705c06eb45` |

原始 before/manifest.json 三个 SHA 分别为 `b2ef5d51b40109edcd1614090f3707e5a79143d7ead493252c40266a57fa28f8`、`3255408033915d9f92624ab50d92371739ce53f99958351a20a3e6c241313701`、`15d53141389bb3ec615100083a412f88fbbedddaf18636562d2171c87be8c2a7`。A 文件后续修改不能沿用本次查验作为最终放行；协调者已收到问题并交回对应 owner。

## 可复现问题

### SR01 · P2 · F17目标/实际表仍固定单组合，选择身份未贯穿

定位：`strategy-library-wireframes/build.py:316` 的 `preview-portfolio`；`:475` 的 `renderSelection()`，对应生成 HTML 同名节点/函数。

步骤：F16 选择 trend-v1 与 moving-exit-v1 → F17；再返回 F16 取消 trend-v1，只保留 moving-exit-v1 → F17。

实际：计数、候选和说明行随选择变化，但 `preview-portfolio` 始终只有固定“组合1 · 目标权重/实际”及 A60%/B30%/现金10%。第二独立组合没有自己的目标、持仓0和现金行；仅保留移动退出时仍展示原先固定目标，无法确认目标属于哪个稳定配置。`renderSelection()` 完全没有更新这个表。

预期：按稳定策略/版本身份生成每个组合的目标及实际行；删除指定选择只删除对应行。依据 DR07/RD07“两个独立组合，不能落到固定单策略预览”，DR03/RD03 的独立现金/实际持仓分层。Owner：creation_visual。

### SR02 · P2 · F17演示状态互相残留

定位：`strategy-library-wireframes/build.py:476` 的 `[data-demo]` 分支。

步骤：F17 中依次点击设计工具“无候选”→“无信号”→“数据缺失”。

实际：只在无候选时改 candidate，只在无信号时改 signal；没有恢复前一状态。“无信号”样例仍同时显示“无候选”，随后“数据缺失”继续保留两者。变化的说明文字与正文数据不是同一状态。缺数据的 `preview-next.disabled=true` 本身有效，但不消除场景混同。

证据：将当前生成 HTML 的 exact-source demo 分支放入最小 DOM 契约，Node 按上述序列执行：无候选后 candidate=无候选/signal=pending；无信号后 candidate=无候选/signal=无买入信号；缺数据后两者仍残留，disabled=true。此为源码分支执行证据，不冒充浏览器证据。

预期：用单一场景状态完整生成候选、信号、目标和原因；每次切换恢复其他字段。依据 DR03/RD03、契约“候选、信号、缺数据分别作为明确样例”。Owner：creation_visual。

### SR03 · P2 · A名称层Escape先关闭事件详情

定位：`workbench-design/index.html:575` 通用 keydown 与 `:587` 名称 keydown（主要被审 SHA）。

步骤：长文本场景 → 从结果/对比打开事件 → 聚焦完整实验名称使名称浮层可见 → Escape。

实际：较早注册的通用 Escape 监听器先执行 `closeEvent()`；较晚名称监听器随后才隐藏名称。这会让一次 Escape 同时越过名称层关闭事件详情，违反最内层关闭。该后置监听器使用 `stopPropagation()` 也不能取消同一 document 上已执行的前置监听器。若事件关闭重建名称入口，后续 `.focus()` 还会再次触发 onfocus 打开浮层。

预期：名称浮层优先消费 Escape，事件日/详情状态不变，并恢复名称入口焦点。依据 DR08/RD08 与 DR05 的逐层退出。Owner：workbench_visual。

### SR04 · P2 · A鼠标返回配置累加重复历史按钮

定位：`workbench-design/index.html:558` 的 `openPackageHistory()` 与 `:584` 的 `packageHistoryBack` 点击分支（主要被审 SHA）。

步骤：运行配置 → 查看策略包历史 → 点击“返回锁定配置”；重复此往返。

实际：`configSnapshot` 保存的 modalBody 已含 `packageHistoryBtn`。返回分支恢复该 HTML 后又无条件创建同 ID 按钮并 append。首次返回出现两枚“查看策略包历史”；后续往返继续累加并产生重复 ID。Escape 分支没有这次 append，因此鼠标/键盘行为也不一致。

预期：原配置仅恢复一枚历史入口，层级、输入和焦点一致。依据 DR05/RD05，当前明确可演示的嵌套配置路径。Owner：workbench_visual。

### SR05 · P2 · 关闭事件后命名返回来源丢失入口焦点

定位：`workbench-design/index.html:529` 的 `closeEvent()`、`:532–536` 的 `returnSource()`（主要被审 SHA）。

步骤：结果/对比中的事件入口 → 事件详情 → 关闭详情停在事件日 → 使用保留的“返回阶段结果/组合对比”。

实际：`closeEvent()` 立即将 `eventOpenerEventId=null`；`state.source` 没保存该身份。后续 `returnSource()` 的 focusId 因而为 null，返回渲染后选择不到原事件入口且没有备用 focus。来源滚动与视图恢复并不证明键盘焦点恢复，当前活动 headerReturn 还会在来源渲染时 hidden。

预期：关闭详情仍保留命名返回所需的来源入口身份；返回后焦点进入原事件入口或明确可达备用入口。依据 DR05/RD05、DR08/RD08 与契约“来源/scroll/focus连续性”。Owner：workbench_visual。

## 已查证与限制

- 两页 inline script 的 `node --check`：PASS（读取被审文件后经 stdin 检查，不改原型）。
- F16 两策略使用 Set 与稳定ID，详情/历史不替换所选完整策略 v1；F17/F18 身份与包版本说明随同一选择集生成：该部分静态检查 PASS；SR01的目标/实际表例外。
- F16 Escape 分支有历史→完整策略→F16逐层路由，focus回入口由独立click监听器安排：静态实现存在；真实键盘焦点仍 NOT VERIFIED。
- F17 缺数据使用真实 disabled 按钮；F18实际未接入仍禁确认：静态检查 PASS；SR02场景一致性例外。
- 原有 `effectiveLimit`、`portfolioCutoff`、`advanceBlockedByData`、`unavailable`、`compareCutoff`、`stepForward`、`togglePlay`、`backLatest`、`eventLimit`、`nextKnownEvent` 代码与 before 源码相同；现有引擎/截止计算未因本次改动扩展。`drawChart`主要函数也与before相同。不能由此宣称真实chart行为/视野 PASS。
- A event source保存R/V/组合/视野/滚动，关闭详情不推进M，返回来源保持暂停；滚动提示根据真实overflow/atBottom计算。相关静态路径存在，浏览器最终版本与滚动/焦点接受仍由协调者执行。
- 未操作浏览器；视觉比较、真实渲染推进、最终尺寸、鼠标/键盘旅程均 **NOT VERIFIED**。数据库写入/生产创建接线 **NOT APPLICABLE**（当前范围明确禁止），未来功能门槛不能因此视为通过。

修复后应重新记录最终三文件 SHA，保留本次 FAIL，再复核对应分支。此报告不关闭09/11或整体功能任务。


## 冻结版本复审（2026-10-06）

本节追加复核原 SR01–SR05，保留上文首次 FAIL、复现步骤及版本证据。只读取冻结原型、执行提取源码的最小契约，仍未操作浏览器。复审结论：**FAIL（SR02 部分修复后仍残留；其余 4 项原问题静态复核 PASS）**。

### 本次冻结 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| strategy-library-wireframes/build.py | `e887f27ee0ebfd0af571f49ba5a580ea9ecf10fc4d982f1bbef0da0461beb048` |
| strategy-library-wireframes/index.html | `0588099d48c82c4e9dca942a1c12e107546da795cffbf72e89dab34aa92cf2d9` |
| workbench-design/index.html | `5a4c4266c0a8e1c7d10a84fd2514d8138da0bf293ca1c9a3ac9548336c416b18` |

重新读取三文件所得 SHA 与协调者给定冻结版本一致；两页全部 inline script 经 stdin `node --check` 均 PASS。

| 原问题 | 复审结果 | 定位与证据 |
| --- | --- | --- |
| SR01：每组合目标/实际 | 静态 PASS | `build.py:475` / `index.html:211` 的 `renderSelection()` 现由稳定选择 ID 逐组合生成目标行与持仓0/现金¥100,000实际行。提取此函数执行最小 DOM 契约：两选择生成目标2行、实际2行且两身份都存在；删除 trend-v1 后目标1行、实际1行，只保留 moving-exit-v1 身份。通过依据是每组合生成，不是计数变化。真实 F16→F17 渲染由协调者另验。 |
| SR02：演示状态残留 | **FAIL（部分修复）** | `build.py:476` / `index.html:212` 在 demo 分支先调用 `renderSelection()`，已恢复候选；该函数未恢复 `preview-signal`，后续也只有 no-signal 分支写信号。因此“无信号→缺数据/无候选”仍保留无买入信号。详见下列复现。 |
| SR03：名称 Escape | 静态 PASS | A `:408–409` 增加 `suppressNameFocus`；`:597` 的名称 Escape 监听器以 capture 注册，先 `stopImmediatePropagation()` 再关闭名称层、恢复名称入口焦点，并在下一帧解除 focus 抑制。可优先于 `:576` 的通用 bubble Escape 消费按键；同步 focus 不会重开名称。真实名称→事件逐层行为仍由协调者另验。 |
| SR04：历史按钮重复 | 静态 PASS | A `:594` 鼠标返回恢复快照后先查找已有 `packageHistoryBtn`，仅不存在时 append；`:583–591` 还在下一帧清理重复节点并恢复焦点。原无条件 append 路径已消除；`:596` 的历史 Escape 仍只恢复配置层。鼠标往返/键盘路径的实际渲染由协调者另验。 |
| SR05：返回来源焦点 | 静态 PASS | A `:530` 在清空 eventOpenerEventId 前将原事件身份保存到 `state.source.returnEventId`；`:534` 的返回来源读取即时 opener 或这个保留身份。原“关闭详情后焦点 ID 必为 null”的链路已修复。实际来源滚动/焦点由协调者另验。 |

### SR02 残留的冻结版本复现

提取当前生成 HTML 的原文 `renderSelection()`、策略身份定义及 demo 分支，在 Node 最小 DOM 契约按同一顺序执行（初始信号文本来自当前 HTML）：

| 操作 | 候选 | 信号 | 继续按钮 disabled |
| --- | --- | --- | --- |
| 无候选 | 无候选 | 信号待逐日运行确认 | false |
| 无信号 | 移动退出 v1：12个候选（合成样例） | 无买入信号 | false |
| 数据缺失 | 移动退出 v1：12个候选（合成样例） | **无买入信号（残留）** | true |
| 再点无候选 | 无候选 | **无买入信号（残留）** | false |

此序列说明候选恢复的修复有效，但 signal 未恢复。数据缺失按钮确实禁用仍单独 PASS；场景一致性必须继续 FAIL。应完整重建每一演示样例的信号字段，再按包含“无信号→其他样例”的顺序复验。

本报告仅解除对应源码问题，不关闭功能/视觉接受门槛；全部浏览器、截图对照、最终视口与实际键盘焦点检查对本审查者仍为 **NOT VERIFIED**。上文原始证据继续有效并保留。


## 创建原型第二次复审（2026-10-06；A 不冻结）

只复核创建原型的 SR01/SR02；本节不更新正在修订的 A SHA 或其最终结论。当前读取 SHA 与协调者给定一致：build.py `446d3c05ef8d4cb217a30b81ce1d60fbf6df555e940d14433d682b23131bb54c`；index.html `68df36606a53ad20d86f07371ca518afc55ddb028a00b2501b930f3817010900`。

`build.py:475` / HTML `:211` 已在 `renderSelection()` 恢复 `preview-signal='信号待逐日运行确认'`。当前 inline script `node --check` PASS。将原文身份定义、renderSelection 和完整 delegated click 分支装入最小 DOM 契约，以下样例按钮顺序 **PASS**（不替代浏览器检查）：

| 顺序 | 候选 | 信号 | 说明 | disabled |
| --- | --- | --- | --- | --- |
| 无候选 | 无候选 | 待逐日运行确认 | 无候选 | false |
| 无信号 | 两策略各12个合成候选 | 无买入信号 | 无买入信号 | false |
| 数据缺失 | 两策略各12个合成候选 | 待逐日运行确认 | 必需数据缺失 | true |
| 无候选 | 无候选 | 待逐日运行确认 | 无候选 | false |
| 正常恢复（重建初始页面/刷新契约） | trend-v1 12个合成候选 | 待逐日运行确认 | 初始说明 | false |

上次复审记录的 signal 残留在此版本已解除。SR01仍静态 PASS：双策略目标2行/实际2行；点击取消 trend-v1 后目标1行/实际1行且仅保留 moving-exit-v1；重新选择后重建2行/2行。每行仍具有对应版本、目标、实际持仓0和独立现金¥100,000。

### SR02 选择重建仍混合场景：FAIL

新增复核要求包括删除组合后重建。当前 `renderSelection()` 重建候选、信号与组合行，却没有维护 `preview-demo` 和 `preview-next.disabled`。两个同页路径的 exact-source delegated click 执行结果：

1. 两策略 → 数据缺失 → 点击删除 trend-v1：只剩 moving-exit-v1 的正常候选/待确认信号和1组目标/实际；说明仍是缺数据，继续仍 disabled=true。
2. 再点无候选 → 重新选入 trend-v1：候选已恢复为两策略各12个合成候选；说明仍为“演示状态：无候选”，继续 enabled。该说明与候选正文直接矛盾。

定位仍是 `build.py:475–476` / HTML `:211–212`。应在选择变更时完整恢复正常样例，或按保存的演示类型完整重建，确保候选/信号/说明/disabled 同属一个场景。不能用刷新通过代替同页删除/重新选择的状态一致性。因此创建原型本次限定复审结论仍 **FAIL（原 signal 残留已修；选择重建的场景一致性仍未修）**。不要求生产创建接线或数据库写入；真实浏览器接受仍 NOT VERIFIED。


## 创建原型第三次冻结复审（2026-10-06）

当前创建冻结 SHA：build.py `ea8cc125c883a6b93da293331d075eac2695629bedf5d1a971c372a38161abed`；index.html `159f3a8f6db7c558df7e56b6d3f11f7cfee2a576e219f5843a05571717de9870`。独立读取与协调者给定 SHA 一致。A 正在诊断 compare→event 空 canvas，本节不读取或冻结其最终版本，也不据此前 A 静态复核对当前 A 放行。

创建原型限定源码复审结论：**PASS（SR01、SR02）**。上文各次 FAIL 继续作为历史证据保留；此 PASS 仅对应本节两文件 SHA，不代表两原型整体接受。

`build.py:475` / HTML `:211` 的 `renderSelection()` 现完整恢复候选、信号、默认说明及 `preview-next.disabled=false`，随后 demo 分支完整覆盖当前样例。原 signal 残留与选择重建后说明/disabled 残留均已解除。

提取本版原文身份定义、renderSelection 与完整 delegated click 分支，在最小 DOM 契约执行并断言，全部 PASS：

| 路径 | 核验结果 |
| --- | --- |
| 两策略 → 无候选 → 无信号 → 缺数据 → 无候选 | 各步骤候选/信号/说明一致；仅缺数据 disabled=true，目标/实际维持每组合各一行。 |
| 无候选 → 点击删除 moving-exit-v1 | 恢复正常候选、待运行信号、默认说明、enabled；仅 trend-v1 的1组目标/实际。 |
| 缺数据 → 点击继续 | 当前 hash 维持 #f17，禁用不会进入下一步。 |
| 缺数据 → 重新选入 moving-exit-v1 | 完整恢复正常状态，重建2组目标/实际；继续入口恢复可达 #f18。 |
| 无信号 → 点击删除 trend-v1 | 完整恢复正常状态，仅 moving-exit-v1 的1组目标/实际，trend-v1 身份不残留。 |

当前 inline script `node --check` PASS。上述为 exact-source 分支执行证据，本审查者未操作浏览器；真实渲染、视口/截图和焦点接受仍由协调者独立完成。当前追加不关闭09/11或整个功能任务。


## 最终候选源码复审与空图根因证据（2026-10-06）

本节仅复核原 SR01–SR05、创建名称浮层定位及 A 当前图表适配器；没有扩大原型、生产接线或引擎范围。上文所有 **FAIL** 与历次版本证据保留。本次限定源码结论：**PASS**，未发现这些修复分支仍存在的重要可复现问题。浏览器/视觉接受仍由协调者独立完成，本审查者没有操作浏览器。

### 本次独立读取 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| strategy-library-wireframes/build.py | `97f0bdfa9bfed01fb08af63ea4e4b356f65e53cad5ecef4f6ace93e130fc50b5` |
| strategy-library-wireframes/index.html | `570a2767b91ca61b3c223bd41b9269199d6f969014cec4f5c4d4ec28c14ce89a` |
| workbench-design/index.html | `32db7ca126cb43328757a85c64b980b3284bbaad4917977e1ae03b20fc0200e6` |

两页全部 inline script 经 stdin `node --check`：PASS。创建源码的身份定义、`renderSelection` 与完整主 delegated click 分支再次按本版原文执行：双策略逐组合目标/实际/独立现金，无候选→无信号→缺数据→无候选，缺数据阻断 F18，删除 moving 后正常恢复、重选 moving 后正常恢复并进入 F18，删除 trend 后仅剩 moving 身份，全部 PASS。SR01/SR02 当前定位仍为 build.py:475–476 / HTML:211–212。

| 修复项 | 当前局部源码复核 |
| --- | --- |
| SR03 名称 Escape | A:413–416、:617；capture 消费按键先关闭名称层，同步恢复焦点期间抑制 focus 重开，原通用 bubble Escape 不会同时关闭事件。静态 PASS。 |
| SR04 历史返回重复按钮 | A:603–614、:616；快照恢复只查找/补建缺失入口，鼠标下一帧清重并恢复焦点，历史 Escape 返回配置。静态 PASS。 |
| SR05 命名返回来源焦点 | A:550–556；关闭详情先将 opener 身份保存入来源，后续返回使用保存身份，并恢复来源视图、组合、R/V、视野、滚动和暂停状态。静态 PASS。 |
| 创建 DR08 浮层定位 | build.py:93–95、:470 / HTML:206；浮层使用 fixed 与根据入口 rect 计算的视口坐标，hover/focus 定位，Escape dismissed。F16 普通短名称移除 tabindex，明确长名称压力样例保持 focus 入口。定位实现静态 PASS，最终 rendered 浮层边界/对照由协调者验收。 |
| A 安全守卫 | 与 before/workbench-design--index.html 对照，effectiveLimit、portfolioCutoff、advanceBlockedByData、unavailable、isReviewGuard、compareCutoff、stepForward、togglePlay、backLatest、eventLimit、nextKnownEvent 内容未变。当前适配器只改变库数据提交方式，不改变计算结果、截止或原始行情。 |

### A compare→event 空图：历史 FAIL 与独立根因复现

协调者的真实浏览器红色证据保存于 screenshots/chart-event-diagnostic-before-recovery.json、chart-event-diagnostic-steps.json 与 chart-event-diagnostic-after-recovery.json。逐调用结果：事件进入后 `lwCandle.setData([])` 仍有时间范围和坐标；`lwNet.setData` 同日期3点后立即时间范围/价格坐标/时间坐标全为 null，净值与比较序列却仍各有3条数据。后续配置开关触发第二次渲染恢复。此失败保留，不能用第二次渲染作为原路径通过证据。

本审查者执行官方 5.2.0 的实际 DataLayer 类，无 DOM、无图表和浏览器；只给类加观察出口，未修改其算法。本地 production vendor 与固定版本分发逐字节相同，SHA `c0992580867c4912cc9385b3c2728315bcc1a76c7f1087dca908430fccdf31d7`。脚本与输出保存在本目录：

- `chart-data-layer-reproduction.py`：下载固定版本，检查本地 vendor 一致性，直接执行实际数据层，并提取当前 HTML 的适配器原文执行。
- `chart-data-layer-reproduction-output.txt`：原失败与恢复、当前适配器各分支的逐步结果及所审 A SHA。可用 `python3 .scratch/strategy-portfolio-backtesting/visual-iteration-07/reports/chart-data-layer-reproduction.py` 重跑。

独立复现结果：初始净值3点→唯一序列同日期 setData（数值相同、数值不同两种）→加入比较3点→事件净值 setData，公共 time points 和 point map 从3变0，而两个序列 rows 仍各3、baseIndex 仍2；清除比较不能恢复；第二次配置净值提交恢复3。根因是唯一序列优化重建 point map 后，同日期分支保留旧 sorted point 引用，后续多序列清理按旧 mapping 删除新 map 的时间点；并非 baseIndex 变 null、空数据 fixture 或价格尺度独有问题。依据 [官方 DataLayer 5.2.0 源码](https://github.com/tradingview/lightweight-charts/blob/v5.2.0/src/model/data-layer.ts#L153)，对象清理与同日期分支见 [cleanup/replaceTimeScalePoints](https://github.com/tradingview/lightweight-charts/blob/v5.2.0/src/model/data-layer.ts#L425)。

当前 A:432–445 的适配器完整 payload 相同即跳过；时间序列相同但值/OHLC变化，只历史更新变化项；时间序列变化才 setData。传给库的 item、setData payload 与缓存快照均克隆，避免历史 update 原地转换日期而污染原始数据或破坏下一次 timeline 比较。该原地转换依据 [官方 updateSeriesData](https://github.com/tradingview/lightweight-charts/blob/v5.2.0/src/model/data-layer.ts#L245) 与 [时间行为 preprocessData](https://github.com/tradingview/lightweight-charts/blob/v5.2.0/src/model/horz-scale-behavior-time/horz-scale-behavior-time.ts#L93)。

当前 **exact-source 适配器执行 PASS**：重复完整 payload 不再 setData；同日期连续两次数值更新保留3点，比较→更早事件正确截为2点，后续推进扩为4点；同日期连续两次 OHLC 更新保留3点；两种更新后调用方原始 time 仍是 ISO 字符串，未被库原地改写。输出中的 A SHA 与本节冻结 SHA 一致。协调者另提供首次 compare→event 已显示线、marker、轴与网格的 candidate-a-event-compare-1280.jpg；该浏览器证据不冒充本审查者亲自验证。

此 PASS 只解除上述源码问题与数据层反例；整体功能/视觉接受、最终尺寸、鼠标/键盘焦点门槛对本审查者仍 **NOT VERIFIED**，生产/数据库 **NOT APPLICABLE**。不得沿用旧截图放行其他 SHA。

## VIS07-08 footer 与 A 只读原因换行最终补丁复审（2026-10-06）

范围仍是静态视觉原型，审查者仅修改本报告，未操作浏览器、实现或数据库。此前全部 FAIL 保留。本节 supersedes 上节源码 SHA；此前数据层执行证据仍对应上节明确记录的 SHA。

### 初次 footer 候选：FAIL 保留

| 文件 | 首次补丁 SHA256 |
| --- | --- |
| creation build.py | `6db5ea811acd2a6c913c86012ff5df3b38ff082456fec57b4d93a8d52f09431b` |
| creation index.html | `78cb7273fa05508e8f562f28055a46917ef1fe7ebc74dca9176f18762b74b7e6` |

**SR06 / VIS07-08 [P2] FAIL：查看缺失详情落在通用未知占位。** 复现：F17 → 演示数据缺失 → 查看缺失详情。build.py:316（生成 HTML:199）的 `#preview-data-gap` 仍为「未知；将在实际检查中确认」，build.py:476（HTML:212）只滚动并 focus 此单元格；当时 missing-data 分支更新 footer、禁用按钮，却不更新缺失单元格。详情入口因此没有提供当前阻断的原因。已当场向协调者报告，不能把入口存在或 focus 成功计为通过。

### 最终修正：scoped PASS

| 文件 | 最终复核 SHA256 |
| --- | --- |
| creation build.py | `5ca69b5fcb981203d619a5f442bb619ecc54b952463604a765164e2dd7d47d61` |
| creation index.html | `cfa83fc0da95212773243af51bf8552ddfeeac1f36be07edb0e75ea6b7e50b8c` |
| A index.html | `d12096e92a19cc944205a445ba366dec9634ee16a961b263bcc0827e42a8acea` |

当前 creation build.py:475–476 / HTML:211–212 已在 missing-data 分支把缺失单元格设为「合成示例：必需市场数据缺失（未接入），无法继续确认」，这是明确标注的当前合成阻断原因，不再是通用未知占位。详情保留 F17 hash，滚动至该单元格，添加 tabindex=-1 并 focus。正常 renderSelection 恢复「未知；将在实际检查中确认」，不会把演示缺失误留成正式检查结论。

审查者提取当前生成 HTML 的 selected 定义、renderSelection 与完整主 delegated click handler 原文，以 Node 最小 DOM 接口执行，**PASS**：正常 → 无候选 → 无信号 → 数据缺失 → 无候选 → 无信号；缺失状态真实 disabled、显示详情、显示当前合成原因，详情点击 hash/focus/scroll 目标正确；其余状态启用下一步、隐藏详情、恢复简短正常 footer 与默认 gap。缺失后增加 moving 策略、再次缺失后移除 moving 均恢复正常，并保留 2 / 1 个独立组合的目标行。执行前后 index SHA 一致。上述是源码分支执行证据，不冒充浏览器布局或真实键盘焦点验收。

A 的相对差异逐字节验证：从当前文本反向移除 A:291 `.replay-reason` 的 `white-space:normal; overflow:visible; text-overflow:clip`，以及 A:573 只读原因 `inline-block` span 的呈现分支，得到 SHA **恰为此前已审 `32db7ca126cb43328757a85c64b980b3284bbaad4917977e1ae03b20fc0200e6`**。因此最新 A 仅有这两处文字换行呈现改动；只读状态判断、禁用守卫、来源/事件截止、图表数据适配器和其余原有逻辑无变化。每次 updateReplay 先写 textContent，再按当前原因加 span，旧换行 markup 不会残留到其他原因状态。当前两份 HTML inline script `node --check` **PASS**。

最终源码范围结论：**SR06 / VIS07-08 复审 PASS，此前已解除的 SR01–SR05 无新增源码回归；A 换行差异 scoped PASS。** 协调者报告已在真实浏览器验证缺失原因焦点与 normal/no-candidate/no-signal 的 hidden computed none / 恢复可继续。本审查者未操作浏览器，视觉和真实鼠标/键盘门槛仍由协调者的独立证据完成；生产实现与数据库仍 **NOT APPLICABLE**。

## DR03 缺失详情披露完整性最终增补（2026-10-06）

此前 `5ca69b… / cfa83fc…` 的 scoped 状态恢复与详情入口 **PASS 保留**，但该结论只证明存在实际合成阻断说明，不证明 DR03 披露完整。协调者转达的独立 visual review 随后将披露不全判为 **FAIL**：缺失详情没有逐所选独立组合关联策略/三类包版本、缺失能力/区间和处理动作。此 FAIL 保留；主规格 [DR03](../../../../docs/specs/2026-10-06-strategy-workbench-review-functional-design.md#dr03--预览实际预检与演示能力分层评审-r03p1) 原本要求这些信息，并非扩大范围。

本次仅复核这一详情分支。最终 source SHA256：

| 文件 | SHA256 |
| --- | --- |
| creation build.py | `c7e0f6816431b1994242a6a15bc8bfbe4e02959aa8e3c76a9faa28473b973b17` |
| creation index.html | `118b31a2483f5ed44144d46d9f3fa1a7b6c44ef83234a7951d622357c5b23dc9` |
| A index.html（无新增变化） | `d12096e92a19cc944205a445ba366dec9634ee16a961b263bcc0827e42a8acea` |

build.py:476 / HTML:212 当前缺失详情按 `Array.from(selected)` 生成，逐项显示完整策略名称与版本，以及三类包名称、版本和稳定标识。双选时分别包含固定退出 `exit.fixed-stop.v1` 与移动退出 `exit.moving-take-profit-stop-loss.v1`；每项明确「市场数据覆盖未接入；缺失区间无法确认（未知）」，结尾提供「请返回选择策略调整配置，实际接入后重新检查」。没有把未知区间虚构为已覆盖或零不足。

审查者再次提取此冻结 HTML 的 selected 定义、renderSelection 和主 delegated click 原文执行，**scoped PASS**：单选 trend、双选、仅 moving 均只披露当前选择集与各自三类包；详情保持阻断、F17 hash 和原 focus 目标；无候选、无信号、添加/删除选择均清掉旧详情内容，恢复默认 gap、隐藏详情入口、正常 footer 和可继续状态。生成 HTML 语法检查 **PASS**。反向只替换新缺失详情分支为旧文本分支，build/index SHA 分别精确恢复 `5ca69b… / cfa83fc…`，证明没有正常布局、恢复逻辑或其他实现差异；A SHA 也保持不变。

源码层面的 DR03 披露反例已闭环为 **PASS**；此前 visual FAIL 保留，其最终浏览器/视觉关闭证据由协调者独立记录。本审查者未操作浏览器、修改实现或扩展到生产功能。

## VIS07-09 历史弹窗按钮 CSS 最终冻结增补（2026-10-06）

本次仅复核新增按钮配色与尺寸规则，**scoped PASS**。最终 source SHA256 更新为：

| 文件 | SHA256 |
| --- | --- |
| creation build.py | `aa66c44dae6441af3e2a8f9b63b45fb40948e7392bc85d9203c8d67f4dd2edf1` |
| creation index.html | `ce278f9022cfd396bc7037bf627dae3375b343528edbfe8886e295d19e1ddc09` |
| A index.html（无变化） | `d12096e92a19cc944205a445ba366dec9634ee16a961b263bcc0827e42a8acea` |

build.py:101 / HTML:86 仅增加 `.strategy-detail-overlay .action{min-height:36px;background:#142742;border-color:#3a4860;color:#d9e4f2}`，给详情与嵌套历史弹窗中的 action 按钮明确深色底、浅色字与最小 36px 高度。独立反向移除此唯一规则后，build/index SHA 分别精确恢复上节 `c7e0f681… / 118b31a248…`。因此行为、选择集详情、状态恢复、嵌套 Escape 与其他源码逐字节不变，上节限定源码 **PASS 继承**；所有历史 FAIL 继续保留。

审查者未重跑大范围检查或操作浏览器。最终详情/历史按钮的实际渲染比较仍由协调者交独立 visual reviewer 接受，本节 CSS 源码结论不替代该视觉门槛。
