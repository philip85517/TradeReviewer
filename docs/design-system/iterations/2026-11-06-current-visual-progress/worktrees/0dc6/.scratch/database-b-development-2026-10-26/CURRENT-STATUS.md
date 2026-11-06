# 数据库B开发：当前状态

## 2026-10-27 用户明确授权的 TDD 恢复

原共同候选 5/5 停止记录保留；用户后来明确要求对上述问题开展测试先行修复，并确认三个测试边界。新的有界尝试与原轮次分开记录，不能将旧失败改写为通过。详细计划见 [TDD 恢复计划](TDD-RESUMPTION-2026-10-27.md)。下文凡写“不得续修”“未授权运行”均为原停止时的历史裁定，不代表本次用户授权后的状态。

- TradingView 来源校验候选 1、2 的独立验收 FAIL 历史保留。候选 2 的问题是篡改平台或夹带字段仍可能被接受；候选 3 经 Luna 独立验收局部 PASS，相关 202 PASS、4 SKIP，root 另复跑存储导入 39/39 PASS；这不代表桌面或整体通过。[审查](evidence/tdd-import-2026-10-27/candidate-3/luna-review-candidate3.md)
- 浏览器存储候选 1、2、3 的整体独立验收未通过；候选 3 核心 32 项通过，但非空别名的完整旅程未验证，且发现同版本旧复盘内容因别名顺序选择不同。用户已明确裁定 SQLite 优先、无 SQLite 且冲突时暂停自动恢复并提示、保留原始数据；候选 4 独立验收 FAIL：不同格式的新旧名称数据冲突会静默选中一份；完成复盘路径仍未验证。候选 5（最终轮）已冻结：实施者核心测试 50/50 PASS、root 另行复跑 50/50 PASS；专属 Luna 独立验收进行中，旧完成/暂存页面入口未验证。[审查](evidence/tdd-storage-2026-10-27/luna-review-candidate4.md)；[证据](evidence/tdd-storage-2026-10-27/)
- 迁移合法重试错误：候选 1 的定向修复由 Sol 实现、Luna 独立验收 PASS；root 独立复跑 81/81 PASS，Luna 五文件 193/193 PASS。仅接受维护重试及其事务保护边界；整体交付仍未通过。[审查](evidence/tdd-migration-replay-2026-10-27/candidate-1/luna-review-candidate1.md)
- 桌面隔离库正向旅程：在 1280×800 页面完成模拟交易上传、审核、确认、返回、刷新；交易库显示 4 笔、2 回合，数据库来源关联数量对应。该证据属于此前冻结版本；当前代码变化后必须重验，独立视觉对照及错误恢复尚不完整。[操作与证据](tdd-desktop-iXObCs0m/JOURNEY.md)
- 官方 V8 工具对此前冻结版本的 9 个完整文件测得分支 2537/3646（69.58%），未达到目标；其中包含职责较广的 SQLite 文件。代码冻结后须按最终文件集重新测量，不得把该结果当作当前版本。全仓类型修复候选 1 经 Luna 独立验收 PASS，全项目 tsc exit 0，root 已独立复跑 exit 0；页面导入测试候选 1 实际 35 PASS / 5 FAIL：两项是导入历史重复数量错误，三项为范围外名称失败；专属 Luna 正在审查，不以类型修复掩盖运行失败。[测量报告](evidence/tdd-coverage-final-2026-10-27/FINAL-MEASUREMENT-REPORT.md)
- 财务 P1/F07 和 Bars 保持暂停，完整首页 1 秒未验证；不得据模拟盘结果声称实盘首页修复。

给非技术审核人员：[问题、案例与历轮尝试说明](PLAIN-LANGUAGE-STATUS.md)。

**整体仍未验收通过。** 本页便于查看当前责任人、轮次和卡点；原始失败、历轮证据和裁定继续保留在各任务及验收记录中，不由本页覆盖。

更新时间：2026-10-27。实施：Sol 6.1 Ultra；每项独立审查：Luna 5.6 Max；最终协调与接受：root。受保护业务库未授权访问，所有验证只使用自建合成输入和隔离环境。无提交或远端操作。

| 原问题 | 实际修复轮次 | 当前结果 | 卡点与下一步 |
| --- | --- | --- | --- |
| H6：旧修订重试与过期冲突 | 5/5 | 定向范围通过；原运行验收失败保留 | Sol 107/299、root独立107及Luna通过；真实HTTP、重启、完整回归仍未验证。不得开始第6轮修复；同一问题若仍需改动即暂停并记录 |
| I-1：导入计划确认 | 2/5 | 局部通过；整体未接受 | 仍有完整导入、异常恢复与持久化旅程缺口，原记录保留 |
| V-1：修订预览可读性 | 2/5 | 桌面限定旅程通过 | 其余规定视口、相关旅程仍未验证，不能当作整页通过 |
| DBB-11：存储边界 | 5/5，停止 | 候选5静态验收 FAIL；旧局部接受保留 | Storage.key/length 可枚举旧业务 poison 键名；专属 Luna 与 root 确认，停止修补与运行；A27/B8 未运行，真实 UI/HTTP/文件重启未验证 |
| DBB-12：工作区57项失败 | 5/5，停止 | 原 G5/adapter 限定接受保留；整体未接受 | 共用 SBUI 门失败；TV13生产＋6测试已停写，只封存；C35/D15 未运行，其余33迁移因前置旅程未通过受阻 |
| DBB-13：判重7项与截图3项 | 1/5 | 十项测试契约限定接受；正式链未接受 | Sol10项、关联36项、类型检查及root独立10项通过，专属Luna三门PASS；正式Store/HTTP/持久化/UI仍未验收，原10FAIL历史保留 |
| DBB-14：性质模型72项＋仪表盘70项 | 4/5（限定接受） | 90项输入迁移限定接受；整体未接受 | Sol与root独立exact90均90PASS，静默tsc通过，专属Luna三门限定PASS；关联68按75文件依赖未变复用，非新运行。候选1 FAIL保留；候选3错误pattern导致0执行/97skip，FAIL封存；候选4仅修运行器，Sol/root77均PASS、tsc通过，专属Luna三门限定PASS，root已接受测试合同；52排除、037 Recall持久化及产品门未接受 |
| 财务P1/F07、Bars | 保留原暂停记录 | 暂停 | 不修复、不新增候选。W39证据投影仅静态疑点，未运行复现 |
| 首页完整首屏≤1秒 | 未达验收条件 | 未验证 | 当前局部通过不能替代完整首屏达标 |

**停止规则按原问题累计。** 同一问题第5次实际候选仍未解决就停止该问题的迭代，记录输入、改动、首断点、未通过原因和未验证项；不得换名或拆成新票重置次数。诊断、审查、同一冻结版本的独立验证不冒充新的修复候选，也不抹去失败。

当前中央全量回归仍为原 FAIL：24个测试文件失败、351通过、3跳过；244项测试失败、4973通过、6跳过。其后限定范围的通过应分别看证据，不能从原总数直接相减得出新的全套结果。完整检查未重跑，build及新的运行验收仍未启动。

证据入口：[最终验收](FINAL-ACCEPTANCE.md)、[覆盖矩阵](DESIGN-COVERAGE.md)、[任务索引](README.md)、[实施台账](../../.superpowers/sdd/2026-10-26-database-b-implementation/progress.md)。

当前执行：共同候选5已因 SBUI 存储 guard 合同缺陷停止，仅完成封存及专属 Luna 独立静态审查。A/B/C/D、tsc、构建和新服务均未授权，不再继续源码修补；下方较早“实施中/待运行”段为历史进展，以本次停止裁定为准。

TV root合同裁定2已获专属Luna三项静态PASS：公开输入及摘要、仅TV计划的资格门、服务端完整操作证明。该结果只解除设计阻断，生产实现、R1–R5及UI门均未验证。新增历史读取依赖需由SBUI唯一helper owner机械接入实际Store，禁止用空数组或Map伪造成功。

DBB14候选3因错误pattern造成0执行/97skip的FAIL仍保留；候选4只修改运行器输入，Sol与root独立77执行/77PASS、76唯一、20排除，唯一tsc通过。专属Luna与root已限定接受，真实图表、视觉和完整首页性能均未验证。

共同候选5封存前检查：root静态指出TV材料复用的完整观察/链接校验疑点，owner确认原先无其他校验覆盖，正在同一次未封存实现内收口并映射S12/S13；不是运行PASS。SBUI源已封存，原专属Luna5.6Max正在先审三文件Spec/Design，运行证据仍NOT VERIFIED；Sol一次性A27/B8运行器已封存、尚未执行。


### 2026-10-27 共同候选5/5静态验收失败，达到上限停止

Luna 独立发现且 root 源码核对确认：真实 Storage 的 key/length 无条件放行，可枚举已写入的旧业务 poison 键名，违反“仅允许批准 UI 偏好键”的合同。属于测试防护缺陷；尚未证明生产页面读取旧数据。原候选5完整存储边界门 FAIL，达到5/5停止，不修第6轮、不换名、不缩窄合同。原候选4的有限 PASS 与旧失败保留，不升级为新版本通过。

SBUI A27/B8、TV C35/D15、本轮 tsc/build/全套均 NOT RUN，桌面/HTTP/文件重启/视觉仍 NOT VERIFIED。原TV Sol 已于 2026-10-26 21:47:53 UTC 停写，13生产＋6测试只封存现有进展；其专属 Luna 静态审查另记，不把依赖停止写成其运行失败。剩余33项迁移因最小真实旅程未通过而 BLOCKED。财务P1/F07、Bars暂停，完整首页一秒未验证，中央原244FAIL不变。

根裁定：`.superpowers/sdd/2026-10-26-database-b-implementation/task-8-sbui-root-candidate5-stop.md`；专属审查：`task-8-sbui-luna-candidate5-static-review.md`（含追加勘误）；运行目录已写 STOPPED-FAIL.json，未生成任何运行许可。

## 本次并行实施与独立验收对应关系

| 实施任务 | Sol 6.1 Ultra 负责人 | 独立 Luna 5.6 Max | 当前结果 |
| --- | --- | --- | --- |
| SBUI：同库读取及首页→导入→交易库→设置的接线 | dbb_workspace_strict_adapter_sol | dbb_workspace_adapter_luna | 三文件封存；Luna/root 确认 F1，完整合同 FAIL；5/5停止，A27/B8未运行 |
| TradingView：来源身份、材料完整性及导入确认 | dbb_tv_compat_sol | dbb_tv_compat_luna | 19文件已封存，root核对哈希和40＋10清单；Luna/root 确认 TV5-S-01 P1，静态实现 FAIL；运行未执行，5/5停止 |
| 图表既有测试输入合同 | 原 chart Sol | 原 chart Luna | 原候选4限定接受；当前新版本产品/桌面/视觉门未接受 |

以上保持实施者与验收者分离，root仅对有证据的范围作最终裁定。工作文件保留，不回退既有脏改动；没有提交、推送、合并或发布。


## 最终追加：专属 Luna 审查结束，root 确认两项静态缺陷

**共同候选5/5未接受，达到上限停止。** SBUI 与 TradingView 均由各自独立的 Luna 5.6 Max 审查；root 再核对关键源码。不得自行续修候选5、改名计数或进行隐性第6轮。未来修订须用户明确授权新的有界范围与计数，保留原五轮失败历史。

| 问题 | 专属验收及 root 结论 | 影响与证据边界 |
| --- | --- | --- |
| SBUI F1：Storage.key/length 无条件放行 | 静态完整合同 FAIL，P2 | 防护可枚举旧业务 poison 键名；属于测试保护缺陷，不等于已证实生产页面读旧数据或数据库泄漏 |
| TV5-S-01：首次写入前未完整校验来源证据 | 静态实现 FAIL，P1；设计可行 | 未检查完整字段及成交候选对应关系，畸形输入静态可达不完整材料或错误异常分类；没有运行证明实际数据库已受影响 |

TV 的13个生产文件＋6个测试文件、SBUI三文件保留封存；封存完整性不能替代功能验收。专属 TV 报告为 `task-8-tv-compat-luna-candidate5-static-stop-review.md`，root复核为 `task-8-tv-root-candidate5-final-disposition.md`，共同停止裁定为 `task-8-sbui-root-candidate5-stop.md`，均位于 `.superpowers/sdd/2026-10-26-database-b-implementation/`。

A27/B8/C35/D15 共85项计划检查均 **NOT RUN**；本候选类型检查、构建、全套回归未运行。桌面视觉、HTTP、真实持久化、返回/reload、重启和完整首页一秒均 **NOT VERIFIED**。其余33项迁移仍受最小真实旅程前置条件阻塞；财务P1/F07与Bars保持暂停。原限定通过及中央原244项失败完整保留，没有据局部通过推算新全套结果。没有提交、推送、合并或发布。

## 2026-10-27 追加：旧复盘冲突保护第五轮停止

**候选 5/5 独立验收 FAIL，停止该问题的修复迭代。** 独立 Luna 用真实 SQLite Store 验证：第一次迁移时，浏览器里同一回合的旧名称为 A、新名称为 B，即使数据库原来没有复盘，旧迁移链仍可能把两份分别写进数据库，之后新的冲突检查会把数据库记录视为权威，从而不提示冲突。预期是暂停自动恢复、提示冲突、保留两份原文。核心 50/50、真实 Storage 和写入闸门仅局部通过；首次迁移完整路径未通过。已发出的请求取消、实际旧页面入口、浏览器/HTTP 与视觉仍未验证。既有 Bars/SBUI 检查另有 53 PASS / 1 FAIL。不得开展第六轮或更名绕开上限。[独立报告](evidence/tdd-storage-2026-10-27/luna-review-candidate5.md)。

导入页面测试候选 2/5：新增月结同文件显式新版本及同请求幂等案例，实施者全文件 36 PASS / 5 FAIL，独立验收进行中；5 个失败原样保留。[结果](evidence/import-flow-repair-2026-10-27/candidate-2/RESULTS.md)。导入历史实际重复数量的单独修复正在审查，性能及畸形旧证据问题尚未验收。

## 2026-10-27 最终冻结测量与第一轮导入历史裁定

冻结版完整范围覆盖率为 **5232/6662 = 78.53%，低于95%目标**；28个测试文件共 598 PASS / 53 FAIL / 4 SKIP，退出码1；其中4项跳过需要未提供的本地TradingView样本。纳入14个完整修改文件并记录运行前后源码无漂移；不能与旧结果相减或冒称全仓全套。[覆盖率与全部失败](evidence/tdd-coverage-final-frozen-2026-10-27/FINAL-MEASUREMENT-REPORT.md)。

导入历史重复数量候选1/5独立验收 FAIL：9项正常专项虽通过，但异常回执可能将不同批次的材料混在一起，当前代码仍把汇总数量归给单一批次；1000批次合成历史同步读取约3.5–3.9秒，未达一秒目标。正在按候选2/5先诊断和补反例，财务/Bars和已停止的旧复盘问题不动。[审查](evidence/import-history-duplicates-2026-10-27/luna-review-candidate1.md)。

导入页面测试迁移候选2经独立Luna受限通过，独立全文件36 PASS / 5 FAIL；完整页面功能仍不通过。[报告](evidence/import-flow-repair-2026-10-27/candidate-2/INDEPENDENT-LUNA-REVIEW.md)。最终隔离桌面测试的文件选择失败，服务日志呈持续热更新，实际页面尚未通过；原探索旅程不可替代最终版本。针对该环境问题仅开展独立诊断。

## 2026-10-27 桌面验收环境诊断

桌面文件选择器失效的直接原因仍待确认；已查明此前持续刷新由验收代理日志与样式扫描形成循环：代理每次请求写入 `.scratch` 的 JSONL，而 Tailwind 将该日志作为样式依赖，触发下一次更新。原日志保留，不能把节点失效直接归因于此。已在 `/private/tmp/tradereview-desktop-hmr-isolated-20261027-thxlEn/` 准备新隔离库与临时验收脚本，数据库完整性、外键及身份预检通过；服务端口绑定被沙箱拒绝，端口空闲与真实浏览器环境稳定性尚未验证。待源码冻结后重跑；详细证据见该目录 `REPORT.md` 和 `DIAGNOSIS-EVIDENCE.json`。未写业务库。

## 2026-10-27 后续：候选 2 未通过及隔离桌面旅程

导入历史候选 2/5 独立验收 **FAIL**：A 批次的保存凭据若混入 B 来源的新增行或重复明细，系统仍可能向 A 报告确定的重复数量，而不是显示未知。独立反例两项均红；固定运行时专项 98/98、类型检查通过不抵消这项缺陷。合成千批首页 HTTP 首响应 316ms 仅在该限定条件下通过；选中批次冷请求 1243ms，相关全表扫描待解决。第 3/5 轮按原问题进行，原失败保留。[Luna 报告](evidence/import-history-duplicates-2026-10-27/candidate2/luna-review-candidate2.md)。

隔离桌面环境改用 `/private/tmp` 日志，20 秒闲置观察无 CSS 热更新。模拟 CSV 的真实页面审核显示 2 笔，确认前隔离 SQLite 有 0 笔，确认后有 2 笔成交、1 个来源材料版本及 2 个来源关联；返回交易库切换模拟盘后显示 1 标的、2 成交、1 回合，刷新后仍显示。证据位于 `/private/tmp/tradereview-desktop-hmr-isolated-20261027-thxlEn/final-empty-01/` 的 `readback-post-upload-check.json`、`readback-after-confirm.json` 及两张 1280×800 截图。页面使用的是隔离库，不是业务库；此为单条旅程的探索证据，源码尚未最终冻结，独立视觉、全部控件和异常旅程仍未验收。浏览器文件选择调用耗时约 3989 秒后才返回，后台请求、工具等待和热更新的因果关系未证实，性能结论不得从该时间推断。

**证据勘误：** 上段 20 秒观察脚本读取了启动失败的 `service.log`，没有读取正在运行的 `service-escalated.log`，该脚本结果不能作为活跃服务无热更新的证据。独立诊断另核对代理与实际服务日志：同一窗口无 CSS 请求及 HMR，随后存在零星 HMR；长等待期间未见持续 CSS 请求风暴。具体时间线及原因仍在核验。

旧 stale-client CSV 用例经合同诊断后，仅修订测试并新增 9 项保护，实施者定向 9/9 通过，相关四文件 131 PASS / 1 既有 FAIL；产品代码未改，独立验收进行中。[测试报告](evidence/sqlite-stale-csv-contract-diagnosis-2026-10-27/test-contract-update-1/REPORT.md)。上述新工作不会自动改变 78.53% 覆盖率旧测量，也不会解除财务、Bars、旧复盘及其他已达上限任务的暂停。

**测试合同修订局部验收：** 独立 Luna 和 root 各自复跑新合同块均 9/9 通过；hash、类型检查通过。真冲突、需选择来源材料和无错误写入的断言保留。四文件仍为 131 PASS / 1 既有 FAIL；完全不提供 TV evidence 的兼容路径仍为 normalized-only，不等于全字段来源证据通过。该结果仅接受测试合同修改，不接受整体导入功能。[独立审查](evidence/sqlite-stale-csv-contract-diagnosis-2026-10-27/test-contract-update-1/LUNA-REVIEW.md)。

桌面独立视觉复核为 **NOT VERIFIED**：现有 TradingView 截图与既有 Futu 参考的来源、数据和状态不同，不能作为精确同态通过证据；来源摘要、审核框滚动及长列表等状态仍待核验。截图实际编码为 JPEG（文件名是 `.png`），像素为 1280×800；CSS 视口曾设置为 1280×800，但 DPR/缩放与对应冻结版本没有完整登记。[独立视觉报告](/private/tmp/tradereview-desktop-hmr-isolated-20261027-thxlEn/final-empty-01/INDEPENDENT-VISUAL-REVIEW.md)。

文件选择长等待的独立诊断：约 3989 秒是一次组合浏览器工具调用的总耗时，具体卡在等待选择器、点击、设置文件还是获取页面状态无法分辨；代理请求记录中有约 3963 秒空档，之后审核请求约 269ms、确认请求约 44ms（至响应头），不足以将长等待归因后端。两处源码 hash 与准备 manifest 不一致，当前桌面结果仅作探索。[诊断报告](/private/tmp/tradereview-desktop-hmr-isolated-20261027-thxlEn/final-empty-01/REPORT.md)。

账户纠正旧测试的剩余失败已完成只读定位，原测试仍 FAIL：四种普通冲突在准备阶段拒绝；TradingView 跨账户及模拟交易批次变化先生成待审计划，兼容入口随后拒绝确认，因此错误代码和阶段不同。隔离库对照显示原成交、来源证据及 53 张非计划管理表未变；准备阶段新增一条计划，失败确认本身未再改动任何表。是否可以仅按已批准合同更新测试正在独立复核；本诊断未修改测试或生产代码，也未解除任何暂停。[诊断与原始证据](evidence/sqlite-account-correction-existing-case-diagnosis-2026-10-27/DIAGNOSIS.md)。

**后续裁定：账户纠正旧测试合同修订局部 PASS。** 专属 Luna 核对仅修订第五个 TradingView 子例，四个普通冲突的保护未削弱；保留待审、拒绝、业务数据不变、计划记录和关闭重开检查。Luna 独立复跑目标 1/1 与相关三文件 255/255；root 独立复跑目标 1/1（79 项筛选跳过）。只接受测试合同修订，不接受整体 TradingView 产品或恢复已暂停任务。[独立验收](evidence/sqlite-account-correction-existing-case-diagnosis-2026-10-27/test-contract-update-1/LUNA-REVIEW.md)。

**导入历史候选 3/5 已冻结，独立验收中。** 实施者报告 9 文件 124 项通过，普通模拟导入和跨批重复案例得到正确数量；特殊身份绑定与账户纠正各有一个案例只能显示未知，功能缺口保留。1000 批合成样本全匹配仍需约 3 秒，不得重新放入首页启动流程；单批测量及完整首屏性能有独立限制。[封存报告](evidence/import-history-duplicates-2026-10-27/candidate3/REPORT.md)。候选 1、2 的 FAIL 和本轮红灯均保留。

**后续裁定：导入历史候选 3/5 独立验收 FAIL。** 同批正常回执之外，如已消费的异常回执缺失或无法解析实际变更明细，读取会跳过该回执，错误恢复确定数量 1；预期为未知。旧版本或恢复形成的计划与回执反向关联不一致也有同类风险，当前数据库触发器可阻止正常新写入该结构。独立专项 124/124、合成接口性能低于一秒不能抵消正确性 FAIL；特殊 TV 及账户纠正样例仍未知，真实完整首屏一秒未验证。按原问题进入第 4/5 轮，先诊断，覆盖率冻结测量结束前不写源码。[独立报告与复现](evidence/import-history-duplicates-2026-10-27/candidate3/luna-review-candidate3.md)。

**候选 3 冻结覆盖率：** 18 个完整文件 5458/6949 = 78.54%，731 PASS / 17 FAIL / 4 SKIP；浏览器存储防护原完整测试文件经单独映射为 212/244 = 86.88%，15 PASS / 1 FAIL。距 95% 分别差 1144、20 个分支臂；均未达标。两轮前后及轮间 946 个源码/配置 hash 无漂移；测量已结束，可以开展第 4/5 轮。详见[测量报告](evidence/tdd-coverage-final-candidate3-2026-10-27/FINAL-MEASUREMENT-REPORT.md)。

## 2026-10-27 导入历史候选 4 冻结，独立验收中

第 4/5 轮冻结 69 项，root 独立核对 hash 全部一致。实施者的专项回归为 10 文件 157/157 通过，类型检查通过；独立 Luna 5.6 Max 正在验收，不能据此接受候选。最终性能测试 2 PASS / 1 FAIL：1000 条异常凭据样本的一次实际查询 135849ms，测试超过 120 秒预算；此前同类样本约 2.4–3.1 秒，系统负载及缓存影响未知。正常合成样本的结果不抵消失败，真实完整首页一秒仍未验收。[冻结及原始结果](evidence/import-history-duplicates-2026-10-27/candidate4/FREEZE.json)。

冻结版本原 P03/P04 测试仍 FAIL：它们期待原始预览字段为 1，实际为 0。只读审查发现当前页面分别使用原始预估值和正式提交值，不能仅凭这两个断言认定用户看到错误数量；真实页面与正式读取仍需独立验收，原测试及失败记录保留。先前失败分类将其直接定为产品数据不一致的判断需以此更正。

先前分类建议的 alias 恢复 C-A 已撤销：原案例属于 DBB12 的 W01/W02，已达 5/5，应继续暂停，不得以新编号重置。[勘误及原始分类](evidence/tdd-coverage-candidate3-read-only-triage-2026-10-27/REPORT.md)。截图导入 P13 的独立隔离诊断已运行，正在分析真实审核计划；原冻结失败保留。

## 2026-10-27 第四轮独立裁定和截图诊断

导入历史候选 4/5 **整体 FAIL**。独立 Luna 在冻结版本复核 69 项 hash 并运行 66/66 项定向案例，异常回执、归属和 Store→handler→client→Dialog 在所列范围内通过；但冻结性能测试中 1000 条异常凭据读取出现 135849ms 并超过测试限时，原 P03/P04 仍 FAIL，隐藏的未选计划、真实浏览器/视觉及 production build 未验证。独立较快复测约 2.97 秒不能抹除原超时。P03/P04 的预览与正式结果字段语义正在独立核对；不能把 jsdom 的局部展示直接当作完整桌面验收。[独立报告](evidence/import-history-duplicates-2026-10-27/candidate4/luna-review-candidate4.md)。第五轮是本原问题剩余的最后一轮，须先完成根因与方案分析，保留前四轮证据。

截图导入 P13 的一次隔离诊断 **1 PASS，142 未执行**：本次正式计划产生两项冲突，原用例后续断言通过；但旧覆盖率运行失败时没有保存计划，故原 FAIL 保留，原因未证实。观察代码和不同测试环境可能改变时序，不能据此称已修复或真实桌面通过。[诊断报告](evidence/p13-screenshot-formal-plan-read-only-2026-10-27/REPORT.md)。财务、Bars 和达到 5/5 的原问题继续暂停。

性能对照补充：根据冻结性能脚本的执行顺序，独立 Luna 复读的异常库是两次主测量之后又将一个计划内容设为 null 的最终状态；约 2.97 秒样本很可能对应该最终状态，而非 135849ms 主测量完全相同的输入。该判断来自脚本与产物链的静态分析，尚未再次打开数据库核实；不能用它解释耗时波动。慢路径已证实需要读取、摘要校验及解析大量计划内容，但 135849ms 极端增幅的环境原因仍未知。

P03/P04 合同追加纠正：独立只读对照旧代码和已确认规范发现，旧预览数包含库内重复，不只是解析阶段的重复；原页面也承诺确认前显示重复数。当前普通确认框可能将 0 写成“已跳过”，服务器正式回执为 1，属于尚待修复的可见语义与预览信息缺口；只把旧测试期望从 1 改 0，或者只改文案，都不足以证明符合已批准规范。已作为候选 5/5 受影响 UI 切片开展接口与案例诊断，不重置原问题轮次。[只读报告](evidence/import-history-duplicates-2026-10-27/candidate4/independent/p03-contract-analysis.md)；[任务](issues/16-import-confirm-duplicate-preview.md)。

## 2026-10-27 第五轮：归属证据和确认前核对

第五轮进行中，尚未通过验收。新增真实 Store 红灯：一条记录表面属于 B，但其保存的计划同时涉及 A；读取 A 时目前错误返回确定的重复数 1，预期为未知。3 个相邻的正常和无关批次对照通过。[原始结果](evidence/import-history-duplicates-2026-10-27/candidate5/02-public-contract-red-controls.log)。另一个真实 Workspace 上传测试在服务器审核结果到达前验证确认禁用、没有写入；审核完成后缺少“服务器核对重复候选 1 笔”而失败，来源明细断言尚未执行。[原始结果](evidence/import-confirm-duplicate-preview/02-workspace-red.log)。

独立 Luna 认为持久归属证明方向可实施，但当前设计 **BLOCKED / NOT ACCEPTED**：必须覆盖所有计划和回执、批次及材料修改、各写入入口和恢复世代，并证明旧库首次建立所需耗时；514MB 样本的首次构建和完整一秒门均未验收。[独立审查](evidence/import-history-duplicates-2026-10-27/candidate5/INDEPENDENT-DESIGN-REVIEW.md)。已指定一个后端 owner 串行处理共享协议与数据模型，另一 owner 负责确认弹窗及真实用户旅程测试。原始预估与服务器正式结果继续分开，未知不能显示为零；财务、Bars 以及已达五轮上限的问题继续暂停。

第五轮候选已冻结，独立验收中；不再开展第六轮。实施者的后端回归 461 PASS / 1 FAIL（旧测试把迁移版本固定为17，实际18）；页面及测试工具回归 59 PASS / 5 FAIL。root 对冻结工作区独立执行类型检查：**FAIL**，`app/components/trade-review-workspace.import-flow.test.tsx:1003` 的 `body` 类型为 `unknown`。不得声称完整构建或全部回归通过。[后端报告](evidence/import-history-duplicates-2026-10-27/candidate5/FINAL-LIMITED-REPORT.md)；[页面报告](evidence/import-confirm-duplicate-preview/IMPLEMENTATION-RESULT.md)。

专项 1000 批、514 MB 历史样本首次启动与建审计记录分别为 3739.595ms／3041.697ms，专项测试所设的一秒启动断言两项 FAIL，运行期间机器整体负载未知。用户已同意进程启动单独计时，故不能将其直接当成用户定义的完整页面首屏 FAIL；该页面性能门仍 NOT VERIFIED。另一次月结单原 5 秒单例 PASS，不能覆盖原整组运行的超时，原因仍未知。
### 2026-10-27：导入确认第五轮独立验收结论

导入确认与重复明细属于原问题的第五轮，独立审查总体 **FAIL，5/5 停止**：日期精度丢失可能把仅有日期的成交展示为精确时间；Futu 完整账户号可能出现在公共响应中；全项目类型检查另有 `TS18046`。局部状态保护和 P03/P04 隔离数据库案例通过，不能抵消以上阻断项。最终真实桌面浏览器与视觉对照仍未验证。详见 [独立审查](evidence/import-confirm-duplicate-preview/INDEPENDENT-CANDIDATE-REVIEW.md) 和 [问题记录](issues/16-import-confirm-duplicate-preview.md)。历史数量底层第五轮独立审查 **STOP / NOT ACCEPTED**：派生数量被外部连接直接修改后可能仍返回错误确定值，为静态反例、尚未运行复现；见 [审查报告](evidence/import-history-duplicates-2026-10-27/candidate5/INDEPENDENT-FINAL-REVIEW.md)。

