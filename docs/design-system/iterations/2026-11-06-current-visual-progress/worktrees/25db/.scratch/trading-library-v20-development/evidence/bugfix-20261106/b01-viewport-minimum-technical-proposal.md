# B01 视口 V 最小技术方案草案（2026-11-06）

**供协调者审查，尚未冻结、实施或验收。推荐给现有不可变 observation 追加不可变的视野证据，当前状态只保存确切证据引用；不回填历史 `viewport:null`。** 服务端先提交 B/C/D，真实图随后才能获得该态的 V，因此必须有一个绘后写入环节。推进前先确认当前态最新 V 已持久化，再推进；新态先 unknown，真实绘制后另存新证据。

本稿仅文档：没有实现、测试、浏览器/HTTP/服务/数据库操作，没有派生 Agent。工程采集时点与实现接口是本稿建议，由协调者依既有合同审定；**不标成用户新决定，不要求用户再投票**。仅覆盖日线首旅程 A→B→C→D、现有 SAVE/正常离开重开和精确 observation 的 RESTORE；不扩展任意阶段、PREVIOUS、正式快照、小时、触屏或窄屏，也不涉及项目资料管理、旧库对账或业务库升级操作。

## 1. 不变的合同与当前缺口

- [状态合同][C]:9、13–15、17、21–27要求 V 独立于 M/F/P/O，推进目标实际可见，保存/恢复对应视野，resize 不推进，迟到恢复不得覆盖主动导航。[round4][R4]:26–29、50–52要求 V 或诚实 unknown、观察/入场前证据不被改写、最后补齐真实可恢复 V；[round5][R5]:13、15、20要求接管不推进、丢响应不重放旧状态、重绘后才继续。
- 当前 [journey][J]:206–207、263–280、336–337均先写 observation 且 `viewport:null`；:168不返回 V，:486只允许 RESTORE null。`freezeBefore`(:212–224)只冻结 Recall 内容，尚没有视野引用。把 BEGIN/STEP **请求前**的 V 填入其**响应新态**会把 A/上一态视野冒充 B/C/D。
- [schema][DB]:583已有 nullable `viewport_json`，:596–620保护 observation/before snapshot/receipt 不可更新；[route][HTTP]:33–38、61–65严格限制 v1 字段。已有槽位与 ChartHandle 不能替代端到端协议。
- [chart][CH]:58–84、1736–1788已有 get/restore/flush。logicalRange 是当前 `timelineData` 的索引（:1330–1341），不是可脱离数据身份存取的日期窗口；flush 同步处理 SDK invalidation(:1762–1768)，不单独证明人已看到图。
- 02/04 及主图规格要求保留视野与信息层级，不定义新的保存时点。上一份[只读合同审查][PRE]的未通过/NOT VERIFIED结论仍有效；本稿不是补签接受。

## 2. 两个实际可行方案

| 方案 | 保存结构与步骤 | 优点 | 真实代价与边界 |
|---|---|---|---|
| A：每次捕获追加一个同态 observation | 复用现有 observation JSON：新 ID、相同 M/F/P/O/文字/数据摘要，增加已捕获 V 与 `sourceObservationId`，当前指针换到新点，jRev+1。原点不改。 | 复用 SAVE_TEXT/RESTORE 已有追加模式；仅就数据结构看可不新增表。 | 捕获会更换 observation 身份，需要修改绘制身份、Text所属、历史目录、B/C停留计时，避免“捕获→新点→重绘→再捕获”循环。**无迁移只在全部进程已升级且独占写者的额外部署前提下安全**：旧 v22 二进制仍可写同库并抹去新 V 语义；HTTP v2 单独挡不住。若加 schema 能力屏障，仍需新迁移。 |
| **B：追加 immutable viewport evidence（推荐）** | 一张证据表绑定确切现有 observation；capture jRev+1但不更换 observation，不改 M/F/P/O/E/Recall。state 用既有 `viewport_json` 保存证据引用；真正创建新 observation 的 SAVE_TEXT/RESTORE只在创建时保存相应证据引用或 unknown。 | 绘后证据与先提交的观察点职责清楚；B/C画面身份和停留计时不因捕获变化；历史原 JSON 保持原样。表在现有 journey schema guard 的对象范围内，可阻断旧二进制。 | **需要新增一次 schema 迁移、strict v2读写与证据解析**；不能只改前端符号。capture多一次持久化回程，控制器须串行推进与处理丢响应。 |

选 B 是在现有异步画图、不可变历史、CAS与旧 writer 保护下的最小完整闭包；不是表数量最少的局部改动。localStorage、只存 React 状态、回填旧 observation、只在 STEP 携带上一态 V，都不能满足此闭包。

## 3. 推荐的数据与接口闭包

### 3.1 新迁移：一张表，旧记录不改

预计使用 **v23**（实施时先核对最新版本，不能覆写已发布22）。仅新增 `practice_pair_journey_viewport_evidence` 及不可 UPDATE/DELETE 的触发器；**不 ALTER 旧表，不更新旧 JSON，不改变旧迁移 checksum**。建议字段：

| 字段 | 用途/约束 |
|---|---|
| `evidence_id` 主键、`pair_ref`、`observation_id` | 证据的确切所属。外键关联 observation；事务内核对 observation 真属该 pair，不能只信客户端 pairRef。 |
| `journey_revision`、`command_id` | 此次证据提交修订；`unique(pair_ref, journey_revision)`、`unique(command_id)`，关联/核对现有 command receipt，不能一条命令生成多份证据。 |
| `kind`（captured / preserved）、`source_evidence_id` | captured 是当前 scene 实测；preserved 仅是 SAVE_TEXT/RESTORE 创建新观察记录时，对确切旧证据的不可变承接。preserved 必须带可验证来源，不能伪称新态已绘。 |
| `snapshot_json`、`created_at` | 严格版本化的场景身份、时间线身份、ChartViewport及来源。服务端时间只表示接收/提交时间，不冒称实际绘制或用户看见的时间。 |

state 原 `viewport_json` 从 null 扩展成严格引用 `{kind:'viewport-evidence-ref',version:1,evidenceId}`；它是可更新的**当前索引**，不是另一份可编辑 V 权威。证据本体只在新表。新 observation 的 `snapshot.viewport` 可在**创建当时**写相同严格引用；旧点继续原 `null`。before snapshot 在首次冻结时可保存确切 evidenceId+内容摘要作为只读证据的一部分；不回填已存在副本。**已有before snapshot若视野unknown，升级、ADOPT、capture或后来BEGIN均不得改写它；后来重新观测只可生成带新ID的新证据/新观察记录，其来源与“原入场前视野未知”须同时保留。**

历史目录必须区分：①原 observation 创建时 V 为 unknown；②其后某次绘后产生的、带独立 evidenceId 的已保存视野。RESTORE目标是确切 observation+证据组合/创建时引用，**不能查询“该点最新 V”再装成原点历史 V**。不要求新增一排 UI 控件；现有恢复目标的数据需带完整身份，显示何时缺少视野。

**兼容不能省略。** 当前 [guard][G]:7–22会精确比对所有 `practice_pair_journey_*` 表/索引/触发器。新增该表后，现有旧二进制会拒绝 journey；新 guard 必须验证22+新迁移的记录与完整相关结构，保留 checksum/name/未知对象/弱化触发器拒绝，不能简单放宽 glob 比对。当前旧 progress/Recall公开读写也调用该 guard（[actions][ACT]:123、131；[recall][RC]:92、100），故这条路径可保留旧 writer 失败关闭。这里不声称防止任意直接改库的外部程序。

采用现有[显式副本升级工具][UP]:9–25、43–84的完整 schema/历史、旧记录保留、事务与重读机制，作为新版本验证入口；v22→新版本只增加空证据表，旧 observation/Recall/交易值不变。工具当前按迁移数组长度校验，需审定新增版本支持并更新写死的版本提示/验收；**不在普通 GET/open、UI点击时升级，不把本稿当作业务库迁移授权**。无需为此改旧 v14/v18 诊断工具或重启对账需求。

### 3.2 HTTP：strict v2，v1合同不悄悄扩义

沿用真实 journey 路径，GET 增加**显式且单值**的 `contractVersion=practice-pair-journey-v2`，POST用同名 v2；**v1精确合同仅在已验证v22保持，v2仅支持显式升级后的副本**。v2访问v22返回明确 upgrade-required；v1访问新schema的读写均清晰拒绝，不能假报 `viewport:null` 继续冒充可完整表示新态。旧二进制同时由 schema 屏障拒绝。成功和错误 envelope 都必须对应请求协议，保留 exact-key 校验，不能给 v1 偷添 optional V。服务切换前必须让正确客户端与正确schema版本成对，不由客户端偷偷升级。

新增命令的最小意图（字段名是草案，不是现有接口）：

```ts
CAPTURE_VIEWPORT {
  contractVersion: 'practice-pair-journey-v2';
  revisionId; expectedPracticeVersion; expectedJourneyRevision;
  observationId; commandId;
  scene: { version: 'pair-daily-scene-v1'; viewSha256; timelineSha256 };
  viewport: ChartViewport; // 严格 JSON/有限值/范围与当前SDK支持值校验
  // 当前存在 running/paused G 时必须完整提供 processId/generation/ownerToken
}
```

v2 GET/响应返回 `viewport: unknown | {evidenceId, observationId, kind, scene, viewport, sourceEvidenceId?}`、可恢复目标的精确证据引用；currentSafeView仍是唯一允许传给图表的数据。客户端的 sceneToken/captureSeq 只协调本地迟到事件，不是服务端授权，也不是用户确实看见画面的证明。服务端按当前安全投影重建 hash/时间线，不能信任客户端发来的未来数据或一个自报 hash。

### 3.3 事务、owner与丢响应

CAPTURE在现有 BEGIN IMMEDIATE 事务模型内：验证 schema、pair/source/practice版本→核对同 commandId 的规范化摘要与当前 ownership→核对当前 jRev+observation+safeView→**running/paused B/C复用当前 `verifyActiveTarget`/原target proof校验**→重算安全时间线并验证 V→插入不可变证据/receipt→更新 state 的证据引用及 jRev→读取当前有效状态。所有验证必须先于任何 evidence/receipt/state 写入，所有内容一起 commit/rollback。**不新增 disclosure，不推进/改写 M/F/P/O/E，不写 Recall revision、源文件或原始成交**。

**V-P1补正：safeView摘要不是完整active target证明。** [journey][J]:286–309的`verifyActiveTarget`会重建待揭示的nextBar/当日精确成交顺序与数量，校验process存储target摘要、entry/exit identity和step对应的已披露ids。CAPTURE在running/paused且step为1/2的B/C必须在同一事务调用该逻辑，不能只比`readInTransaction`:147–150的safeView hash；[actions][ACT]:62–72的safeView只含当前cutoff以前行情，D2待披露OHLC改动可能不改变B/C当前safeView。目标行情缺失/变化、顺序/绑定变化、坏target proof均拒绝capture，**本次命令的证据、receipt、state、Recall、披露等全表零写**，不等后续STEP才发现。幂等回执分支也不能略过当前running/paused target有效性再宣告捕获可继续推进；若重试前已有合法历史receipt，本次失败不新增/改写它。private target及待披露OHLC仅在服务端核对，不能为了V校验把它们泄漏给当前B/C客户端。完成D没有active剩余过程时仍按其已知safeView/身份校验，不给step=3误调只支持1/2的验证器。

- running/paused过程的捕获必须匹配当前 G、generation、owner；它只是图面持久化，不视为 STEP、暂停或重新开始计时。已完成/无active过程时仍检查完整身份与 jRev/observation CAS。RECOVER后旧owner、旧G或旧observation捕获一律拒绝。
- 相同 commandId+相同规范化 payload 只提交一次；改 payload 复用 commandId冲突。丢响应后以**同一原始命令**重试/读 receipt，返回当前有效状态与该命令确已提交的证据身份，不把旧响应体强塞回当前 UI。若已由别人推进/接管，保留本地未保存内容并要求重读，不自动重放旧 STEP。
- 两条事务分支要明确：**已存在receipt**先校验相同payload、当前ownership及当前active target有效性，再只读返回当前态+历史ack，不要求原`expectedJourneyRevision`仍等于已因首次成功而增加的修订；**没有receipt**才要求本次expected jRev/observation严格命中，并在target/scene校验全部通过后插入证据/receipt、增加修订。前者不能重写旧回执，后者任何证明失败均零写。
- 一页 capture 在途时又平移：成功回执仅确认当时采得的 captureSeq=N；N+1仍dirty，不能显示“当前视野已保存”。同一页面 NEXT/SAVE/**确有user-view-dirty的正常返回**用写入队列和最后捕获屏障；不并发发 capture和STEP赌顺序。另一页仍由CAS拒绝。
- PAUSE/RECOVER不能被一个排队中的捕获偷偷恢复播放。CAS冲突重读后只重试原用户意图，有限重试；不得使用无界循环或通过提高超时掩盖冲突。若PAUSE先提交，旧capture冲突；若capture先提交，PAUSE用当前修订执行，两者均不新增STEP。

## 4. 绘后采集、推进前冻结与 SAVE

### 4.1 工程时点（建议由协调者冻结）

1. **只读打开与普通读后返回不写。** GET、mount、首次fit、程序恢复/绘制、resize引起的unknown/未恢复，均不等于用户修改，不触发ADOPT/捕获。未adopted的A首次显示为`unknown + pristine`，不能初始化成user-view-dirty；打开→只看/fit/resize→返回仍不ADOPT/capture（正常pair binding若存在单独计，不归为V写入）。只有用户主动pan/zoom/手动调价格轴产生的、能绑定当前真实scene的改变，才是user-view-dirty。首次明确NEXT/SAVE可进入其已有写入链；**user-view-dirty加既有正常返回意图也可进入有界持久化链**，未adopted A先ADOPT再capture。ADOPT不换图、不把未知变已知，读取新修订后须再次核对同一实际scene。
2. 图表为当前安全数据提供 scene-bound 资格回执：实例身份+observation+safeView hash+实际 timeline hash+本地导航generation。仅在相同场景的数据、已知标记、范围应用就绪，前台绘制机会发生并读得有效viewport后才允许捕获。现有 `flush()`可参与，但不能单独充当已看见/停留证据；真实Chrome截图和实际bar/trade可见性仍须独立验收。
3. 用户主动视野改变只设置本地user-view-dirty与captureSeq，不立即写历史；NEXT/STEP、SAVE、**已有user-view-dirty时的正常返回**是明确的intent-scoped writer入口，非“只有NEXT/SAVE能写”的隐含限制。B、C绘出后的捕获属于此前明确NEXT/PLAY的过程；D绘出也保存其当时V，另记`action-scoped capture-required`，不能伪造为用户拖动。**不引入静默定时autosave、每个resize写库或依赖卸载beacon成功的承诺。**
4. NEXT前先等待当前scene最新captureSeq已确认，BEGIN/STEP v2携带 `expectedViewportEvidenceId`，服务端验证它确为当前点/当前安全时间线的引用；无有效V则不冒称完整保存而继续，保留画面、dirty与可重试错误。BEGIN在同一事务把A已确认证据纳入入场前冻结；B/C/D新态均先清空当前引用为unknown，再分别绘后采集，**不能继承上一态 V 作新态已观测证据**。非事实日普通下一根同样清空，不遗留旧 state.viewport_json。
5. capture不改 observation，因此B/C的400ms既有前台停留计时不因jRev增加被重新启动或跳过。STEP条件同时包括原合同的真实绘制/停留与当前V捕获成功；网络慢可以延后STEP，不能提前到未绘制/未保存。不得因receipt重读或resize补跑一根。

上述状态至少分别记录：`unknown/pristine`（初始未保存但无用户改动）、`confirmed/clean`（确切证据已确认）、`user-view-dirty(captureSeq, sceneToken)`（真实用户改变尚未确认）、`action-scoped capture-required`（明确NEXT/PLAY过程所需绘后证据）。unknown不是dirty；程序fit/resize/restore/reveal回调不能冒称用户事件。已有user-view-dirty后resize也不能把dirty清掉，只能在同一有效scene准备好时重新捕获最终实际V。若控制器无法证明dirty来源于当前scene、或handle/绘制回执已失效，保留未保存状态，使用既有离开保护提供留页重试/取消该次返回；不编造saved V、不偷偷丢弃dirty、不新增逐笔强制确认问题。

### 4.2 SAVE与普通离开

SAVE在已暂停/可保存的现有状态执行：取得最新合法capture→等待确切证据确认→SAVE_TEXT v2携带该证据ID及原有 Recall/journey 双CAS。SAVE_TEXT在**同一文字事务**创建新observation时承接该证据：新建kind=preserved的证据行，绑定新点，保留源evidenceId、原捕获scene/尺寸元信息，验证新旧图面 M/F/P/O/时间线完全等价；它不声称新点已被再次实测。文字唯一权威仍是现有Recall；V证据不复制一套可编辑文字。

**跨observation的确切provenance规则：** 设当前/恢复目标为 O1、其明确证据为 E1。先验证 `E1.observation_id=O1.id`、pair/来源版本/phase/安全投影/时间向量一致；新建 O2 与 E2 时，E2绑定O2、`kind=preserved`、`source_evidence_id=E1.id`，其场景与V值必须逐项等于E1；O2创建时的`viewport`和current state均指E2，O2的`sourceObservationId=O1.id`。E2不直接借用“某个同pair证据”，也不让state指向另一个observation的E1。E1若已是preserved，校验其不可变来源链直到captured根（同pair/来源/场景一致、无环/缺项，否则拒绝）；原捕获observation/尺寸/接收时间作为来源保留，E2新时间只表示承接提交时间。实现可由单个helper建立这条链与引用，不能多处各自猜测。capture本身给O1追加E1，不更新O1原`viewport:null`；只有explicit evidence target或当前state能选择E1，历史原点unknown不被抹去。

如果V保存成功而文字保存失败，已存在的视野证据保持合法；UI仍显示“文字未保存/保存失败”，保留草稿，不能因部分成功解除全部离开保护。反之没有V成功就不能显示“全部保存”。只改视野而无文字修改也需可执行相同保存屏障，不能伪造一条空文字来借用SAVE_TEXT。

正常返回列表/详情按意图区分：**plain read-open→return，包含只有初始fit/resize的unknown，直接沿只读返回，不ADOPT/capture**；确有user-view-dirty才把这次既有返回作为持久化入口，未adopted A执行ADOPT→当前scene重新核验→capture；等待最新证据确认后完成原返回（有文字草稿则继续遵循其保存/离开保护）。失败或无法证明当前dirty有效scene时，保留dirty与本地内容，用已有保护留页重试/取消本次返回，不能伪造成功、静默丢失，不能为每笔交易新增确认提示。关闭窗口、进程崩溃、强刷发生在尚未确认时，最多承诺**上一次已确认V**；本地新dirty不能被重开页假称已保存。GET重开仍只读，先加载同一已提交 M/F/P/O/文本及其证据，再实际应用；只有应用/绘制得到验证才可显示“视野已恢复”，收到saved V不等于已恢复。

## 5. RESTORE与安全索引映射

### 5.1 最小且可证明的映射，不猜日期位置

先抽一个共享、浏览器安全的“当前配对日线scene时间线”纯函数：输入仅允许当前safeView的已知日线与已披露date-only事实，输出有序、去重的实际chart time keys及版本/hash。chart当前受 `showExecutions` 影响其whitespace(:1330–1341)；推荐让**新pair的日线时间向量以已披露事实为基准，标记开关只控制标记绘制**，避免隐藏标记偷偷重编号。此为已知数据的索引稳定工程接线，不改变F、事实显隐或主动动作政策；不得把未来date keys加进来。由图表真实采用该同一向量，而非另算一个从未渲染的hash。

证据保存该算法版本/hash及其绑定的safeView/期别/来源版本；实际ChartViewport包含逻辑range、spacing/offset、手动priceRange/scale options和捕获尺寸。服务端重建完全相同向量才接受。**最小RESTORE仅支持已验证相同向量上的原索引直映射**，包括有限的小数边界；不按后来更长的时间线套索引，不近似查最近日期，也不从D反推A/B的轴。无需为了首旅程实现任意跨数据版本重采样。

如果向量或来源摘要不匹配，已知V目标在提交前失败关闭，保留当前状态/草稿并显示不能验证视野；不把错误范围静默clamp成“已恢复”。目标原本unknown则可按现有合同恢复M/F/P/O的安全状态，并明确V未恢复，完整V门槛仍未通过。**读取失败不触发库升级、行情抓取或历史重写**。范围外的SDK空白spacing不是新日期数据，校验不能为了修range而填未来bars。

### 5.2 精确RESTORE步骤

RESTORE v2以确切observationId+可选明确evidenceId为目标，保留现有当前jRev/owner/remaining-G验证。服务器验证证据真实附属该点（或其创建时不可变承接）、safeView与完整时间线一致；创建**新**恢复observation及必要kind=preserved证据，原目标不变。unknown保持unknown；不得把同pair另一天的当前V借来。现有:486的null-only验证由严格union和证据解析替代，不是删除校验。

前端等待对应安全scene和当前ChartHandle就绪后恢复：time range/spacing/offset→price options/range→原autoScale状态（已有chart:1771–1786顺序可复用），禁止普通initial-fit盖掉已恢复范围。**width/height只保留捕获元信息，不强设旧DOM尺寸**；不同桌面仍须满足既有保留时间窗/轴与不裁切要求。SDK的spacing、逻辑range和可用物理宽度相互约束，不能把三个输入参数均已调用冒称实际同时保持；须分别记录最终getViewport和真实图几何。同尺寸SAVE应核对窗口、缩放、轴；跨尺寸仍按既有resize合同验收，不删掉缩放要求或另立“resize时优先丢失缩放”的业务规则。若现有SDK应用顺序不足以满足批准结果，记录FAIL并由协调者处理该有界工程冲突，不伪报通过。当前尺寸下的最终真实V在后续明确动作捕获，不回填来源。

### 5.3 只定义本切片异步失效，不发明D06总政策

每个主动NEXT/RESTORE/已允许的事实选择、切pair/revision/图实例产生本地`navigationGeneration`；排队restore、RAF、SDK回调、resize任务均带其来源generation+sceneKey+handle身份。新主动意图**作废旧意图的迟到工作**，不是规定所有动作“reveal永远赢/restore永远赢”。同一次明确RESTORE的已知V负责其目标窗口；同一次明确NEXT的reveal负责令其目标bar/trade实际可见；普通resize只重新应用**当前仍有效意图**的稳定范围，不推进或重新请求命令。手动pan/zoom也淘汰尚未应用的旧restore，防止用户刚拖动又跳回。

新数据写入、restore、reveal、ResizeObserver合流处只保留一个当前有效范围请求。D06其余阶段/定位/上一根的组合仍排除，不从本稿推出全系统总优先级；本切片若无法满足这两个明确动作的合同结果，就记录FAIL，不用新业务例外绕过。

## 6. 最小改动文件闭包与可独立交付顺序

| 层 | 现有文件/拟新增边界 | 必须连上的消费者/不变约束 |
|---|---|---|
| 数据库与兼容 | `db/sqlite-schema.ts`新迁移；`practice-pair-journey-guard.ts`准确双版本schema验证；现有`practice-database-upgrade.ts`显式副本升级支持 | 旧22checksum不变，旧点原字节不变；普通open仍不升级；旧v1/旧二进制不能清新V。不是先做独立泛迁移系统。 |
| journey事务 | `app/lib/storage/practice-pair-journey.ts`及有界viewport-evidence helper（若拆出） | 新capture+读引用、owner/CAS/receipt、BEGIN冻结A、所有换scene清V、SAVE_TEXT/RESTORE创建时承接；不触及其他Recall权威。 |
| 浏览器安全契约与时间线 | 新纯strict viewport/scene contract helper；`app/components/chart/replay-chart.tsx`使用同一known-only时间向量 | storage与renderer共同计算；schema/HTTP错误failclosed。ChartHandle不以无身份全局ref恢复。 |
| 真实HTTP/客户端 | `app/api/storage/practices/[practiceId]/pair-reviews/[pairRef]/journey/route.ts`、`app/lib/storage/practice-http-client.ts` | strict v1/v2协商、错误envelope、capture/RESTORE/SAVE真实网络；拒绝旧合同伪造unknown。 |
| UI完整链 | 当前B01接线计划拥有的journey controller/浏览器契约；`library-practice-browser.tsx`、`library-practice-replay-before.tsx` | chart ready/scene receipt、dirty captureSeq、串行写、停留/owner、保存/返回/reload、明确unknown/恢复失败。复用已有离开保护，不能退回旧progress writer。 |
| 验收（后续才执行） | 有界storage/route/client单测与组件集成；隔离库真实Chrome首旅程/保存/恢复/resize/视觉对照 | schema安全、功能/持久化、真实绘制、02/04同态视觉四项分别判定；不跑STOPPED Recall第六轮，不以mock当成图像证据。 |

建议先冻结此数据/接口草案→后端strict契约与幂等保护→**最小真实图一条完整链**（A捕获/冻结→B/C/D绘后证据→手动V+SAVE→离开重开/精确RESTORE）→独立状态安全和视觉验收，再扩展其依赖；不是先铺一排新控件。实现者需先补有界失败用例再实现；本稿没有测试执行结果或95%覆盖声明。

## 7. 公开入口的最小反例/预期（待实现后验收）

| 入口/反例 | 输入与操作 | 必须观察到的结果/主要保护 |
|---|---|---|
| 只读打开再返回 | 打开未adopted A或已保存D，不主动调视野→正常返回列表/详情 | journey只GET，无ADOPT/capture/升级写入；pair binding单独登记。unknown不是dirty，不因返回伪造已保存。 |
| 初始/resize unknown | 首次fit或窗口resize后尚无证据，不pan/zoom→等候/返回 | 程序事件不设置user-view-dirty、不自动ADOPT/capture，已保存/unknown的事实不被改写。 |
| 未adopted用户调整后返回 | A尚未adopted，真实pan/zoom/手动轴后点既有正常返回 | 此返回进入明确intent-scoped链，ADOPT+核验同scene+capture成功后完成；重开确切V可读/可恢复，不把首次fit当用户调整。 |
| dirty场景无法证明 | 用户拖动后handle失效/换scene，点返回或capture失败 | 保留未保存V和内容，用既有保护留页重试/取消返回；无伪saved、静默丢弃或逐笔新增问题。 |
| A→B错配 | A窄窗口/手动轴，点NEXT；B目标日不在A窗口 | 入场前副本引用确切A证据；B真实目标可见后存B证据；A/B不互借，旧A JSON不变。 |
| B→C→D停留 | NEXT过程中capture导致jRev增加/网络慢 | B/C各真实绘制及既定停留；捕获不改observation/重置计时/跳STEP，D真K可见；每态证据可分别验证。 |
| B/C待披露目标变化 | B或C已绘、process running/paused；捕获前待披露D2 OHLC/目标成交顺序或proof变化，当前safeView仍相同 | CAPTURE同事务复用verifyActiveTarget即拒绝，本次evidence/receipt/state等全表零写；不等STEP才挡，也不泄漏待披露target。 |
| 捕获期间再拖动 | capture N在途，继续平移到N+1后点SAVE/NEXT | N回执不解除N+1 dirty；最新屏障成功后才完成目标动作，不能把N+1冒称已保存。 |
| capture丢响应 | 后端commit成功但响应丢失，重试同command | 仅一份证据/一次jRev增加；可确认receipt；若当前已变化，不把旧状态覆盖回来。 |
| 双页接管 | 页A旧G捕获在途，页B RECOVER成功，再提交A | A旧generation/owner被拒；草稿保留，无M/F/E/Recall/源数据旁路改动。 |
| PAUSE竞态 | capture与PAUSE近同时提交 | CAS串行，最终paused；不会因capture补一次STEP/重新播放。 |
| 真SAVE/重开 | 手动pan/zoom/价格轴，写Text→SAVE→列表→详情→replay→reload | 实际持久内容与确切V引用重读；图恢复同已知窗口/手动轴；仅收到HTTP成功不计通过。 |
| 部分保存失败 | V已提交，SAVE_TEXT失败 | V证据可存在；文字仍dirty、失败可重试；不得提示“全部保存”或放弃草稿。 |
| 关闭时未确认 | dirty V/在途capture时强刷或终止 | 只显示上次确认V或unknown；无伪造最后视野、无卸载成功假设；重开不自动STEP。 |
| 精确旧B恢复 | D后恢复B+其确切evidenceId | 只绘B的安全M/F/P/O/时间线与B视野，不借D轴/索引，不改旧B；remaining-G按已有合同另建paused。 |
| 原始unknown恢复 | 恢复从未捕获的旧observation | M/F/P/O可安全恢复，V明确未恢复；不选择该点后来任意最新证据。 |
| 时间线不匹配/坏V | 换source version、错hash、非有限range、别pair证据 | 写入/已知V恢复失败关闭；当前状态/草稿/源字节不变，无最近日期猜测或未来bar补齐。 |
| resize与迟到restore | 旧restore排队后NEXT或手动pan，再resize；1440↔1280桌面 | 旧generation/handle任务失效；当前窗口不跳回，无额外进度/披露；尺寸元信息不强设DOM。 |
| 旧writer | v1调用/旧二进制打开含新schema副本并尝试写 | 清晰拒绝；新证据与V引用不被抹掉，原迁移与immutable保护不弱化。 |
| 无关数据不变 | capture/SAVE/RESTORE前后读同隔离样本 | capture不增加disclosure/Recall revision；合法Text save仅改变对应Recall；原始交易与source bytes保持，旧unknown从未回填。 |

## 8. 待协调者审定与仍未完成

需审定的是**此工程协议**：选B；新表+state引用；strict v2；绘后capture和推进屏障；active target proof同事务校验；known-only同向量索引直映射；SAVE/RESTORE创建时承接；异步generation淘汰。用户未修改视野的普通读后返回仍只读；真实user-view-dirty加已有正常返回可进入持久化链，这是本轮协调者工程裁定，不是用户新业务决定。具体字段名、错误码、数据类型和新迁移编号可由工程冻结，无需变成新的用户业务问卷。

本稿不宣布当前后端/前端已具备上述能力。完整SAVE/V恢复、真实跨尺寸窗口、B/C/D图像与首旅程、D06剩余组合、B01/V2整体依然未通过；先前FAIL/STOPPED证据保持。若共享后端/UI在本稿期间变化，以下源文件指纹只约束静态草案的参考版本，不是新实现接受。

独立只读review提出V-P1（CAPTURE遗漏active target验证）、V-P2（initial unknown误当dirty及返回写入口歧义）两项must-fix，**原草案不能按通过保留**。本次已在§3.3、§4、§7明确修订；修订前全文保留于`b01-viewport-minimum-technical-proposal.before-vp1-vp2.md`，SHA `afcd4311dc095e4654fc0a4ea8598795db87518e2a1b847e033c1c087b8e2848`。独立review报告见`b01-viewport-minimum-technical-proposal-independent-review.md`（由非作者写），本稿仍待其复核及协调者审定，非实现接受。

### 静态引用与指纹

确切路径/行号见各链接；完整SHA、字节数、采集/最终核对时间及期间变化见同目录 `b01-viewport-minimum-technical-proposal-fingerprint.json`。本次只散列源码与文档，没有读取数据库。

[C]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/REPLAY-STATE-CONTRACT.md:9
[R4]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/I12/real-chart-next/first-journey-design-round4-20261029.md:26
[R5]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/I12/real-chart-next/first-journey-design-round5-recovery-20261029.md:13
[PRE]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/bugfix-20261106/b01-viewport-contract-readonly-review.md:1
[J]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/practice-pair-journey.ts:130
[DB]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/db/sqlite-schema.ts:576
[HTTP]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/app/api/storage/practices/[practiceId]/pair-reviews/[pairRef]/journey/route.ts:29
[CH]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/app/components/chart/replay-chart.tsx:58
[G]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/practice-pair-journey-guard.ts:5
[ACT]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/practice-pair-replay-actions.ts:123
[RC]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/app/lib/storage/practice-pair-recall.ts:92
[UP]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/scripts/practice-database-upgrade.ts:43
