# B01 最小视野方案：非作者独立技术审查

审查者：`/root/capital_diagnosis`，非此方案/后端/待冻结 UI 作者；不冒称 Luna 验收。日期：2026-11-06，Asia/Shanghai。

## 限定结论

**B（不可变 viewport evidence + 当前 state 精确引用）在现有后端上可行。首版发现的两项工程遗漏已由作者修订，并由本审查者重新只读核对；修订版在本次限定静态范围可进入工程规划，不代表实施或产品通过。** 下文保留首版的具体遗漏、根因与原始状态，最后追加修订核对结果；不能抹去原记录。

本次仅审文档和真实源码，不运行测试、浏览器、HTTP、服务、数据库或迁移，不创建子代理，不改产品/正式测试/配置。只新增本报告。Task1 的既有验收矩阵仍是 **0/20，prepare only**，没有把本次静态审查记为已执行功能项。此报告不重开 STOPPED Recall 项，不扩大旧库对账、恶意 SQL/目录竞争、任意阶段、小时、PREVIOUS、正式快照或触屏/窄屏范围。

规格符合性：结构方向符合既有 M/F/P/O/V/E 分离、历史不可变和精确恢复要求；首版 **REQUIRES AMENDMENT**，修订版两项已静态闭合，见末尾。代码质量/可实现性：现有事务、guard、不可变观察点与显式副本升级均有可复用边界；v23/v2 尚未实现，执行正确性、真实可见性、持久化和视觉全部 **NOT VERIFIED**。

## 版本绑定与实际读取

审查对象：同目录 `b01-viewport-minimum-technical-proposal.md`，27319 bytes，SHA256 `afcd4311dc095e4654fc0a4ea8598795db87518e2a1b847e033c1c087b8e2848`。以下草案行号绑定此版本；后续修订不得用本报告的静态结论冒充已复核修订全文。

已逐个只读核对 `b01-s11-freeze-SHA256SUMS` 的 **24/24 文件全部匹配**，manifest SHA256 `2731851674b2e6b51c8158d7726df9530136807197be13567c54603195678356`。本轮相关源码摘要：

| 文件 | SHA256 |
| --- | --- |
| `app/lib/storage/practice-pair-journey.ts` | `4e8cbf06e287885b7d3066646036de89b7a091ebfe3dcf3640288a1626684317` |
| `app/lib/storage/practice-pair-journey-guard.ts` | `bec6a5667a5771ec38aee21f12dacce65cea07df0dc6dbbcd07b2da5a2d99481` |
| `app/lib/storage/practice-pair-replay-actions.ts` | `771cbfc1c0c52c6eddd09c6eb46e8eb769165fe54425166f2b9e6878a663aa21` |
| `app/components/chart/replay-chart.tsx` | `e73926103ecbbe695cf8e58f0852fffcdb16f38523c64a813071af3cc30e33e9` |
| `db/sqlite-schema.ts` | `3ed3d43894a1a0607401ad65148eebf4fceb9b92df6b1b009adec0454dbef563` |
| `db/sqlite.ts` | `376c7145e9517026b0759048a7f829855b1121ddbf67d97c3cfad4fac5331f47` |
| `scripts/practice-database-upgrade.ts` | `80a9c7ad0f6cd584b92a8b2dc0582c86da6cd241c23d89a1c980becef36521d3` |
| `.scratch/trading-library-v20-development/REPLAY-STATE-CONTRACT.md` | `8b13440ab7e515db6a454b988ab959a99765254d30c982527e702414f0368cd0` |

读取依据包括当前开发流程、frontend-control-audit、task-decomposition；原 `REPLAY-STATE-CONTRACT.md:9,13–27,49–59`，`first-journey-design-round4-20261029.md:26–34,40–52`，`first-journey-design-round5-recovery-20261029.md:11–22`；主图规格 `docs/specs/2026-09-25-chart-first-review-ui.md:108,118,232` 与元素规格 `:88,114`。当前是文档审查，浏览器/视觉执行 N/A；方案未来影响的保存、返回、推进、恢复及 resize 仍必须执行其正式验收门槛。

## 必须补清的两项

| ID | 具体缺口与静态反例 | 必要修订；不新增用户业务规则 | 结论 |
| --- | --- | --- | --- |
| V-P1 | 草案 :66–68 只明确 identity/source/version、当前 safeView、jRev/observation、owner。真实 `readInTransaction` 在 journey :147–150 校验的是**当前已披露** view；`journeyReplaySafeView` 在 actions :63–65 只读取 cutoff 以前行情。B/C 的目标日 D2 OHLC 尚不在此 view 内：目标行情独立更新后，当前 view/hash 可以仍匹配。若 CAPTURE 只走这些检查，就会在失效的 G 上新增证据、收据与 jRev。已有 STEP、control、paused SAVE 分别在 journey :327、350–351、401 重证私有目标。 | 明确 running/paused CAPTURE 在同一个 `BEGIN IMMEDIATE`、任何 evidence/receipt/state 写入前复用 `verifyActiveTarget`（journey :286–309），同时保留完整 process/generation/owner 校验。目标行情/来源/唯一先后证明缺失或变化即失败，新增写入为零；目标 OHLC/私有 proof 不进响应。捕获不是借此推进，也不偷偷把过程改 paused。已存在收据走当前安全结果，不借旧收据授权新写。 | **REQUIRES AMENDMENT**；属于现有“来源/行情变化停止且失败零写”合同的同域延伸。 |
| V-P2 | 草案 :77 将首次未采用 A 称 `dirty/unknown`，同时 :91 规定正常返回 dirty 必须 capture；但首次 ADOPT 只列 NEXT/SAVE。若以统一 dirty 位实现，单纯打开→fit→返回会暗 ADOPT/capture；若完全跳过未采用 A，又会漏掉用户真实 pan/zoom 后明确返回的保存链。 | 按协调者本轮裁定：initial/mount/fit/resize 的 unknown 不是 userdirty，plain open→return 不发 ADOPT/CAPTURE；真实 pan/zoom 才产生 userdirty。真实 userdirty + 既有明确 SAVE/NEXT/normal return 组成持久化动作链，未 adopted A 可在该明确意图下 ADOPT→核对同 scene→capture。scene 无法证明或写失败则保持未保存输入/视野、可重试/取消既有离开保护；不得暗离开、伪报已保存或增加逐笔确认。 | **REQUIRES AMENDMENT**；协调者已明确此工程落款，待作者落文后核对。 |

两项不是要求用户重新决定交易规则，也不是针对外部恶意直接篡改新表。V-P1 使用正常行情来源更新即可构成；V-P2 是正常打开和正常返回的区别。

## 逐项正确性与实施约束

### 1. 旧 unknown、精确历史目标和 before freeze

草案 :37–39、87、105 的规则正确：旧 observation 的 `viewport:null` 保持原字节；后来为同 observation 追加 E1 不会把历史原点变成“当时已保存 V”。当前 state 可精确选择 E1；历史恢复若明确带 E1，可恢复这个**后来真实采集**的证据。省略 evidence 时，只能使用该观察点创建时的引用或 unknown，不能查询 `ORDER BY ... DESC LIMIT 1` 把后来最新 V 充当原点 V。

新旧历史目录应提供确切 observation/evidence 的必要元数据，不将所有历史 viewport、轴范围、scene/proof 正文放进早期当前响应。原已发生 observation 的元数据不能因为恢复 A 而消失；它们可标已看，但后续 M/F/价格/文字不自动进入 A 的投影。当前 `readInTransaction:153–168` 已使用元数据目录 + 当前安全文字；v2 需维持此边界。

现有 `freezeBefore:212–224` 只冻结完整 Recall 草稿与修订，其不可变记录可能已存在且没有 V。新版本不能在“发现新 capture”后 UPDATE 旧 freeze 或重算旧 hash。新 A2/新 freeze 可以引用确切新证据，但必须保留 `sourceObservationId` 与旧 A1 的 unknown 事实；不能把 A2 解释为原 A1。当 receipt 重试命中既有提交时，读取当前安全结果，不再次冻结或用新 V 偷换旧冻结。草案已经写明此要求，**不应为旧 unknown 人为造证据**。

### 2. 捕获 revision、观察身份和 dwell

B 方案 capture 增加 jRev、保持 observation/phase/O/G/step 不变，与当前 control 已只更新 jRev 的模式兼容；表的 evidence jRev 与 observation 的创建 jRev 不是必须相等。证据解析不能因二者不同判为坏数据。SAVE/RESTORE 才创建新观察点。

前端 capture 成功必须更新后续写入的 CAS token，但不能仅因 jRev 变化重置 chart scene、Text owner、captureSeq 或 B/C 400ms 观察起点；也不能将网络回程时间直接当作有效前台观察。scene identity 应包含 exact observation + safeView/timeline/handle/nav generation，而非简单 `jRev` key。重开/接管仍从真实重绘重新计时，后台或失焦不计；这些来自 round5 :20–22，非新增节拍策略。实际绘制/观察证据仍需真实图表，`flush` 不能证明人已看到。

### 3. 时间线必须就是 renderer 的真实索引向量

草案 :95–101 的共享 known-only 向量方向必要且正确。当前 chart :1330–1341 将 date-only whitespace 及 execution 时间轴受 `showExecutions` 影响；若服务器只对 candles 建索引，B/C 的日期空白点会导致同一 logicalRange 指向别处。新 pair 的 renderer 和服务器必须共同消费/重建**完全相同排序、去重、规范化时间键向量**，包括当前 F 所需的日期锚点，不能各自“按日期大致换算”。

对新 pair 固定 known-F timeline、让 showExecutions 只影响图形显示而不重排索引，是有界工程调整；不能据此强制显示用户关闭的标记，也不能改变其他旧 episode 的时间线。原规格 :232 要求显示设置保留。SDK 右侧 spacing/逻辑留白不是未来日期或未来 OHLC，不能靠填未来 candles 修索引。

safeView hash 保证允许数据身份；timeline hash 保证实际索引身份，两者职责不同，必须同时验证。客户端 hash 是候选值，不能替代服务器重建。该共享模块的浏览器/服务端实现、空白点、隐藏标记与同日多个事实的最终等价性尚未运行验证。

### 4. SAVE_TEXT / RESTORE 的 preserved 来源与私有 proof

草案 :85–87 的 E1→E2 规则可实现：E1 必须属于 O1；SAVE/known RESTORE 新建 O2 与 `kind=preserved` E2，E2 绑定 O2，记录 exact E1 和根 captured provenance，当前 state 与新 O2 均引用 E2。原 capture 的尺寸/时间/scene 不能替换成 O2 新创建时间，preserved 不能伪称 O2 重新绘制。

真实 SAVE :412–416 通过 `{...oldPoint, textProjection, sourceObservationId}` 保留 targetProof 和原可知状态；RESTORE :486–507 同样保留旧 point 并重证 remaining G。新 helper 不能只拼 M/F/P/O/V 而丢失 `targetProof`、文字安全投影、来源或原 owner 的有界验证，也不能直接沿用 `oldPoint.viewport`：post-draw capture 后旧 point 仍可能为 null，必须解析**本次命令指定且当前 state 确认**的证据。

V-only 保存不应伪造 Text，Text 保存仍保留双 CAS、同 id 不同 phase/owner 的合法独立归属及隐藏修订冲突保护。V 提交成功而 Text 失败是部分成功，必须保留 Text 草稿，不能显示全部保存。

### 5. 丢响应与当前安全收据

草案 :69–71 正确保留原 commandId/规范化同值 payload 的单次提交，改值复用冲突。回执可确认该命令确已产生哪个 evidence，但返回的 view/Recall/process 必须是**当前**安全投影；不能把旧 capture 的 scene/轴/后续数据重新作为当前内容返回。旧 owner 的历史 receipt 不授予新的控制权，owner/G 已变时走安全冲突或仅确认无授权的已提交身份，不能重新写。

capture N 回执只能清除同 scene、同捕获序列 N 的 dirty；用户已 pan 到 N+1、切 pair、RESTORE 或 handle 重建后不得清掉当前 dirty。NEXT/SAVE/return 的写入屏障必须使用最后已确认证据与最新 CAS。PAUSE/RECOVER 先后按同一事务线性化，回执不得恢复播放或额外 STEP。最终实现需有同命令丢响应、推进后重试、接管后重试、N+1 保脏的有区分度反例；本轮未执行。

### 6. v22→23 能力屏障与 v1 合同

现有 `verifyJourneySchema:7–22` 精确比较 journey 前缀全部对象；新增 evidence 表/不可变触发器可使旧 v22 journey guard 拒绝新能力。这条屏障的准确含义是**旧 journey/progress/受控 pair Recall 入口失败关闭**，并非所有旧程序连数据库都打不开。普通 `db/sqlite.ts:73–89` 只遍历已知 migrations；不能靠“多一条 migration 记录”本身证明旧二进制全局拒开。

新 guard 需要分版本构造精确 reference：v22 仍是原 migration，v23 验证原22+23记录、名称/checksum和完整相关表/索引/不可变 triggers；不能将 glob 改成忽略新表、仅校验几列、忽略未知对象或弱化旧 trigger。原 migration 内容和 checksum 保持。现有 copy-only 工具 :9–25、46–84 可复用完整历史/结构/旧行投影、事务和重开验证，添加 v23 支持及旧错误消息更新即可；禁止普通 GET/mount 自动升级业务库。

草案 :47 已明确版本组合，不能再让 v1 给新 schema 假报 unknown：

| 数据库/请求 | 必要结果 | 本轮状态 |
| --- | --- | --- |
| 完整 v22 / v1 | 保持已冻结精确 v1 成功及错误合同，旧写入/guard 保护不降级 | 静态合同要求；未重测 |
| 完整 v22 / v2 | 明确 upgrade-required；不写、不自动迁移 | NOT VERIFIED |
| 完整 v23 / v1 GET 或 POST | 明确拒绝，不能继续返回可完整表示新状态的假象；错误 envelope 对应 v1 | NOT VERIFIED |
| 完整 v23 / v2 | strict v2 当前安全结果；错误 envelope 对应 v2 | NOT VERIFIED |
| 旧二进制 / v23 journey相关写入 | 精确 guard 失败关闭，现有 V/证据/旧行无写入 | NOT VERIFIED |

Task1 当前仅 v1 读取切片；不能因为本文提出 v2 就在 Task1 未冻结版本偷偷切协议/升级数据库，v2 应单独冻结 consumer 闭包。新增错误码/union/查询单值解析必须双方同步，不能通过宽松 decoder 接纳未知错误或错版本。

### 7. 读取、明确返回与绑定收据的准确边界

纯 journey GET、mount/fit/resize 不进行 ADOPT、capture、PAUSE、迁移或隐式行情抓取。这与显式 userdirty normal-return flush 不冲突，前提是落实 V-P2 的不同状态与意图。

协调者另已澄清当前 Task1 的真实绑定边界：`bindPracticePairReview` 对每个新 commandId 即使 prebound 也会追加合法绑定 receipt，页面每次 open 使用新 UUID，当前没有 read-binding API。因此不能把“整个 prebound 页面打开所有表零写”当作既有后端已交付合同，也不能拦截 bind 来伪造零写；需分别登记合法 bind POST/receipt，与纯 journey GET 及其他表零写。本文的只读 GET 不自动采用标准保留。本轮没打开页面，也没检查任何表。

### 8. 不以 SDK 调用掩盖 resize / V 合同

原规格 :108、232、元素规范 :114 要求侧栏开关/resize 保留窗口、价格范围与用户设置，不推进。草案 :107 没有静默删掉缩放、没有把旧 width/height 强设到 DOM，也未引入 reveal/restore 永远优先的全局策略，范围合适。

`getViewport:1736–1759` 读取 logicalRange、barSpacing/rightOffset、stage 尺寸、priceRange 与 priceScaleOptions。`restoreViewport:1771–1786` 先 spacing/offset、再 logicalRange/price，最后恢复 autoscale。可用物理宽度、轴宽、logicalRange 和 spacing 在 SDK 内相互制约；按顺序调用不证明最终同时满足。此处仍有真实 SDK 可行性风险，不能凭本次静态审查宣布所有跨尺寸几何要求满足，更不能为尽快通过擅自新增“resize 可丢缩放”例外。实施需按既有合同记录最终 getViewport + 同状态截图/几何，发现矛盾由协调者有界处理，保留 FAIL。

导航 generation + exact scene + handle 身份淘汰旧 RAF/restore/resize 工作是合理的异步策略；手动 pan 也作废旧待应用 restore。它不替代“明确 NEXT 目标实际可见、明确 RESTORE 对应保存窗口”两项各自结果，也不扩展未冻结 PREVIOUS/任意阶段 D06 总政策。

## 后续最小反例与当前验收状态

以下是设计审查形成的有区分度边界，非本轮执行结果，也不要求作者采用同一函数/测试组织。

| 边界 | 必要观察 | 状态 |
| --- | --- | --- |
| B/C 目标行情变更后 CAPTURE | 已披露 view 仍合法但私有 target 失效；capture 拒绝且 evidence/receipt/jRev/其他表零新增，无目标泄漏 | NOT VERIFIED |
| initial A 打开/fit/resize/正常返回 | 合法 bind receipt 单列；无 journey采用/capture；unknown不伪称已保存 | NOT VERIFIED |
| 未 adopted A 用户 pan→明确正常返回 | 按协调者裁定显式动作链采用+scene核对+capture；失败保留未保存状态与离开保护 | NOT VERIFIED |
| 旧 unknown 后加 E1，再按原点/明确 E1 分别恢复 | 原点仍 unknown；精确 E1 才恢复其证据；旧 JSON/freeze不变 | NOT VERIFIED |
| SAVE/RESTORE 多次 preserved 链 | 每次新 obs/new evidence，exact source，Text targetProof仍可验证，无借用 latest；当前引用属于当前 obs | NOT VERIFIED |
| capture 仅增加 jRev | observation/owner/G/step/Text/M/F/E不变，不重置或跳过前台 dwell | NOT VERIFIED |
| 同日空白点、隐藏标记和实际 renderer | client/server 向量完全一致，设置关闭不强开标记、不混入未来日期/OHLC | NOT VERIFIED |
| capture lost response + 后续 pan/接管/恢复 | 单次写；只返回当前安全结果；不丢 N+1 dirty、不授旧 owner控制权 | NOT VERIFIED |
| 22→23 副本与旧 binary/v1 | 旧行/JSON/迁移字节保持；能力拒绝与明确协议版本；GET零升级 | NOT VERIFIED |
| 同尺寸/双桌面 resize+迟到 restore/NEXT | 实际窗口、缩放、轴与目标可见分别证明；无额外进度/披露/隐式保存 | NOT VERIFIED |

以上运行分子 **0**；不重用已通过的 null-V 后端结果作为新 V 通过。本报告完成的是限定静态审查，不是新测试完成、方案全部放行或 B01/V2.0 完成。


## 修订复核：V-P1 / V-P2 已静态闭合

文档作者修改后，本审查者再次读取 §3.3、§4、§5、§7、§8 的相关段落；没有运行或编辑任何产品、测试、服务、数据库。修订版 `b01-viewport-minimum-technical-proposal.md` 为 32293 bytes，SHA256 **`85a8ea15f3f499f0361864ba37d21ec720ba609c15991bfba361c9923cdf2915`**。原文保存在 `b01-viewport-minimum-technical-proposal.before-vp1-vp2.md`；其 SHA256 仍是首版 `afcd4311dc095e4654fc0a4ea8598795db87518e2a1b847e033c1c087b8e2848`。本文主审查与行号仍绑定原版；本节对修订明确追加。

- **V-P1 静态闭合**：修订 :66–68 明确在同一个事务、任何 evidence/receipt/state 写入前复用 `verifyActiveTarget`，running/paused step1/2 与 completed D 区别，receipt 分支也不能用旧证据宣告仍可推进，失败本次全表零写且不泄漏私有 target。新增 :142 反例覆盖当前 safeView 不变但目标 D2 改动。
- **V-P2 静态闭合**：修订 :79–85、95 明确 unknown/pristine、confirmed/clean、user-view-dirty、action-scoped capture-required；程序 fit/resize/reveal 不冒称用户拖动；plain open→return 不 ADOPT/capture，绑定单列；真实 pan/zoom/手动轴加明确返回允许 ADOPT→同 scene 核验→capture。失败保脏、留页重试/取消，无新逐笔确认。新增 :136–139 分别覆盖四种状态，不把初始 unknown 当 userdirty。
- 修订未引入“resize 可丢缩放”、latest-evidence alias、旧 unknown 回填、GET 自动采用/升级等例外。§5 原精确恢复、preserved 来源和既有跨尺寸合同仍保留。

**最终限定静态结论：两项文档遗漏已经修正，可由协调者按此工程闭包继续规划；无剩余已定位的静态合同阻断。** 这不是对未来实现正确性的保证。v23/v2 的规范/错误结构、schema barrier、独立真实 HTTP/关闭重开、真实图表绘制及跨尺寸最终范围都尚未执行。修订方案 §7 的 20 项反例仍为 **0/20 executed，全部 NOT VERIFIED**；与 Task1 的独立 20 项读取/client 矩阵是不同分母，后者也仍为 prepare only。


### 最终事务分支补充复核

作者随后将既有 receipt 与首次提交进一步拆明。本审查者读取最终稿 :66–74：最终 SHA256 **`dc8ca66101074e8acfeb7a51bb9db5a9620b2a216ce4c147da1565b841dbcb0b`**，32757 bytes；这是本次最终限定结论绑定的 proposal 版本，前一修订 SHA/行号保留其历史用途。

最终 :72 明确：已有 receipt 的同值重试不再要求旧 expected jRev 等于首次成功后的新修订；仍校验同摘要、当前 ownership 与当前 active target，只返回 current + historical ack、零写。未有 receipt 才严格核对 expected jRev/observation 并全部验证后提交。该区分避免把已成功但丢响应的原命令永久拒绝，符合当前安全收据合同；也没有以跳过 CAS 的 receipt 路径授权新写。此补充静态成立，未进行任何运行验证。最终结论保持“可进入工程规划，产品/执行 NOT VERIFIED”。
