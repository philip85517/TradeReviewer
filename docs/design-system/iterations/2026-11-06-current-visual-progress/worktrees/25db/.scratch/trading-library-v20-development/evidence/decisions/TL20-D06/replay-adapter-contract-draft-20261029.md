# D06 审查稿：模拟练习配对接入既有 Recall 和真实图表

状态：**草案 / 待协调者与独立审查，非 Resolution，不解除 I12 首道门槛**。仅设计，不写产品、不读取或修改业务数据库。本稿中的数据表、类型与行为是供实施和独立反例审核的拟议合同，除标为现状者外均不是已有功能，也不把尚待确认的策略视为用户批准。实盘主动回合同样属于 I12，但本稿的身份适配切片只描述模拟盘，不能替代实盘适配。

## 原始依据和范围

- V2 正文 [`visual-design.candidate.md:142–169`](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)：模拟列表→练习详情→选定内部配对→既有容器回放→逐层返回；完整来源数、配对数和主动回合数分开；最近开仓优先，不跨练习。
- 直接参考 [`hcr06-final-replay-a1.svg`](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-replay-a1.svg) 与 [`hcr06-final-replay-a2.svg`](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-replay-a2.svg)，原图 1440×1000，A1/A2 分别突出不同配对，标签显示原始 100/50/80 成交数与所选分配数量；另看 [`journeys-rounds-a-return.svg`](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-rounds-a-return.svg)、[`journeys-simulation-return.svg`](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-simulation-return.svg)；不能把图中的事后全量视图当成盲态可以揭示结果的授权。练习完整名称＋“内部配对 N”已由用户确认。
- [图表规格 §3](../../../../../docs/specs/2026-09-25-chart-first-review-ui.md)（约 112–119 行）规定独立行情/成交截止、真实完成 K、同 K 多决策、明确揭示历史和来源、Text 归属；[REPLAY-STATE-CONTRACT](../../../REPLAY-STATE-CONTRACT.md) 和 [I12](../../../issues/12-first-chart-journey.md) 保持生效。
- 用户已确认一练习一账户、一标的、一周期；日级成交对应日 BAR、小时级对应小时 BAR，不混用。当前实际来源是日期精度，并不证明同日内先后或时点；本稿只处理有可证交易日语义的 1D 练习。没有来源/绑定/配对准入凭据的样本不得变成可回放配对。小时文件、夜盘归属另需真实来源和交易日规则支持。
- 用户本轮不考虑文件变更，遇到按独立异常处理；等价重复重用原练习。以下 revision 约束是防止旧成果被覆盖的安全边界，不授权实现未确定的变更交互。

## 现状证据：为什么不能直接复用旧编号

| 内容 | 当前真实类型/调用 | 差距 |
|---|---|---|
| 身份 | `app/lib/recall/types.ts` 的 `RecallDocument.episodeId`；`app/api/storage/recall/route.ts:29–36` GET 只接 `episodeId`；`server-repository.ts:102–112,124–145,180–187` 用 `recall_documents.episode_id` 读写、CAS | 旧 key 无 practice/revision/pair 域；仅前缀拼字符串不能证明隔离；旧文档可能已有相同文本或一个旧 episode 涵盖多个分配。 |
| 服务端权威对象 | `server-repository.ts:117–120,148–165` 自执行全集 `buildTradeEpisodes` 查旧 episode；完成、计划、评价和留存验证会重新查该对象，投影按旧文档重建 | 客户端模拟 `TradeEpisode`、只换 GET key 或仅增加前端入口，可能草稿可存但在正式完成、计算、留存或投影时失败/串数据。必须由服务端为新身份解析配对权威快照，并分别审计投影；不可绕过现有验证。 |
| 可知与草稿 | `types.ts` 的 `RecallWorkingState`、`RecallWorkingContext`、`RecallSnapshot` 含 `cursor`、`executionCursor`、部分上下文 `revealedCandleCursor`、phase、drawings、decisionDrafts；`document.ts:256–314` 校验 | 根 `working` 和 snapshot 是否精确保留完整行情截止须核实；日期级/来源及一致性尚未建模。`hasSeenFuture` 仅布尔值，不包含来源、时间、范围，不能满足来源集合同。 |
| 隐含顺序 | `app/lib/replay/recall-replay.ts:56–75` 同时间按传入数组顺序作为 tie-break；`:78–146` 用有序前缀及时间判定事实可见 | 对只有日期而无同日顺序的来源，这一排序不是可信交易先后，不能直接喂给现有算法当同 K 决策顺序。 |
| 保存异步 | `recall-workspace.tsx:1540–1660` 调 `repository.load(episodeToLoad.id)`，队列保存 `repository.save(candidate, { expectedRevision })`，根据 episode id 和 generation 避免部分迟到回写；服务器写锁内核对 revision | 新身份、来源版本、payload 原子性和冲突恢复没有证据自动适用。切 pair/revision 的 generation 不能仅比较旧 episodeId。 |
| 图表 | `app/components/chart/replay-chart.tsx:895–913,1120–1185,1400–1465` 对 Lightweight Charts 待绘制 logical range 和 ResizeObserver 有 pending 逻辑，marker/data 分 effect；`package.json` 锁定 `lightweight-charts` 5.2.0 | 有延迟绘制和同帧 resize 风险；现有注释不是实际跨适配器验收。目标必须在真实图表可见，不能只断言状态或同步 mock。 |
| 日线匹配 | `app/lib/replay/execution-markers.ts:44–109` 对有 `tradingDates` 的 candle 匹配来源日期；`app/lib/market/types.ts` 的 `Timeframe` 为 `15m/1h/4h/1D/1W` | 此函数本身没有强制 1D、交易日唯一性与无假时刻校验；不可当成完整适配。 |

## 拟议身份与持久化边界

1. 引入可区分的判别身份，最小外部请求形状建议为 `{kind:"practice-pair", practiceId, revisionId, pairId}`；保留现有 `{kind:"legacy-episode", episodeId}` 独立命名空间。禁止把 pairId 填入旧 `episodeId` 后走旧 SQL 或伪造能被旧 episode 重建代码识别的字符串。
2. 服务端原子地读取 practice 当前版本、不可变 revision、已认证的完整来源/成交集合、通过 LIFO 准入的所有分配及其证据，再确认请求 pair **唯一属于该 practice + revision**、标的账户相符及数量合法。`pairId` 由服务端持久的不可猜测/不可歧义的配对实体或经验证的等价稳定键提供；不得拿列表索引、显示编号、文件行顺序或日期作身份。相同练习的等价重导保持相同当前 revision、pair 身份与草稿；一个成交可参与多个部分配对，各配对的数量必须分别验证。
3. 推荐为新身份增加独立命名空间的复盘存储（独立表或带复合约束的 subject 映射），并重用同一个 Recall 文档模型、图表与领域验证；需数据库唯一约束 `practiceId + revisionId + pairId`、可验证引用和服务端权限/作用域。必须检查现有 `episodeId` 类型、JSON 校验、summary、全部 projections、completion、retention、导出、状态查询和各读写调用；不得仅新建表后跳过它们。具体表与兼容方案须经仓库实现约束和独立审查，非本稿指定的已批准 schema。
4. 新复盘写入事务在**同一个数据库快照/写锁**验证身份及当前绑定证据（包含 practiceVersion、revision、全量来源摘要/配对版本或等价不可变版本），再对该 subject 的 `expectedDocumentRevision` CAS；绑定变化或版本不再一致 → 返回可识别的版本冲突，保留本地草稿、旧文档及已完成版本，禁止静默重绑或覆盖。显式重新加载需先给用户保留/处理未保存输入；reload 后服务端字段、派生指标、保存状态一致且能再次编辑保存。客户端不得自证 admission proof 或提交任意 pair 覆盖服务器权威值。
5. 旧 `recall_documents` 与手工成果保持原入口；旧 episode 到新配对只有在已接受的迁移映射能证明唯一对应、完整引用与版本时才提出绑定，未知、一个对多个或多个对一个均待人工核查并保留原稿。分配部分、显示标题或临近时间均不足以证明唯一对应。旧成果不因新练习到来被替换、移动或清空；不得假设尚未证实的共同旧库是可信祖先。历史版本成果只读可取回与新版本对接策略须另行接受。
6. 加载/写入结果都携带完整 subject 与 `generation`；换练习、pair 或 revision 后迟到的响应不能更新当前图/当前保存提示。切换前处理未保存及进行中的写入：失败时保留现场，等待成功或明确恢复操作；返回目标记录练习、筛选、排序、页码、滚动和焦点，返回 pair 层再恢复同一对象。失败、重复点击和并发两个窗口均不能丢稿。

以下仅用于冻结双方讨论的接口边界，不是可直接落码的确切签名：

```ts
type ReplaySubject =
  | { kind: 'legacy-episode'; episodeId: string }
  | { kind: 'practice-pair'; practiceId: string; revisionId: string; pairId: string };
type PairReplayBinding = { subject: Extract<ReplaySubject, {kind:'practice-pair'}>;
  practiceVersion: number; evidenceDigest: string; pairingVersion: string;
  accountId: string; instrumentId: string; timeframe: '1D'; /* 权威来源和分配快照 */ };
// load(subject) -> {binding, document, documentRevision} | unavailable/conflict
// save(subject, expectedBinding, expectedDocumentRevision, document) -> persisted | conflict
```

绑定摘要的规范化算法和变化边界必须冻结、版本化并独立验证；未经服务端凭据的 digest、客户端拼出的 binding 或 pair 计算结果不构成认证。仅改标题或练习日期不能替换练习与历史成果身份；实际 pair 是否受影响由权威不可变事实决定，不能单凭名字推断。

## 日级可知性：提案与明确未决

- 日级交易事实表示 `tradingDate` 与精度 `date-only`，**不是** 00:00、07:00、收盘时刻或任意可还原秒级时点；真实市场/标的与交易所日历证明后才能匹配一根唯一 `1D` K。缺 K、同日重复 K、交易日不匹配、无可证日历、源字段互相矛盾均标不可定位并保留原始来源，不跳邻日、不合成 OHLC、不降级到小时 K。
- 阶段初始点只显示入场日期之前已完成且可证的 K，成交边界 before-first；入场日内成交先后与成交相对收盘的精确顺序**未知**。严格不向盲态暴露该日整根 OHLC：建议以独立的“日期级事实已揭示、该日 K 未确认为已完成”的逻辑状态显示事实/精度，而不是用伪造时间满足当前 timestamp API；既有图上日期锚点能否在没有该日完整 K 的真实图表中准确显示，需先用 SDK 和可访问 UI 验证，不得画假的收盘线。何时把这个日 K 作为可知完成 K、同日事件如何逐项导航，必须在不声称真实日内顺序的前提下与原有下一根语义对齐；这是 D06 **尚未解决的设计差距**，本稿不宣布决策通过。
- 同日多事件仅当可信证据能证明严格顺序时逐项进入同 K 决策；无法证明时不得沿数组顺序、导出行号或编号编造先后，也不能直接跳过所有相关开平仓生成某个 LIFO 配对。输入存在多种合法顺序而结果可能不同，继续标待确认并保存来源，已获批准确认流程缺失时不凭空设计新的确认交互。
- 非日期级精确时刻、小时周期及交易时区不属于此最小切片；切周期不可产生混合来源，也不能因重聚合暴露额外事实。

## 双截止、状态与动作逐行映射

状态提案：`marketKnowledge` 是可证完成 K 的边界（与原始成交时间无关）；`executionKnowledge` 是在已认证偏序内可揭示的事实/事实组边界；`phase`、`decision/TextOwner`、来源事件集合、每阶段草稿及已保存 `viewport` 分离。**选择决策时** subject + identity generation + phase + 两截止 + Text owner 原子变更；所有写入同时携带版本、来源事件、对应阶段与草稿。未知同日顺序必须阻止需要唯一顺序的动作，不允许转换成“相同时间的有序数组”。当前 `cursor`、`executionCursor`、`revealedCandleCursor` 是否可无损表达上述日期级状态须独立测试；不能只给旧字段设置合成 ISO。

| 合同 ID | 用户动作 | 必须呈现的目标 / 持久化，来源 `REPLAY-STATE-CONTRACT.md` |
|---|---|---|
| BEFORE | 首次打开 | 阶段 pre-entry，入场前可证 K 与 before-first；不呈现未来成交、退出、最终盈亏或未来轴；恢复对应稿与窗口。 |
| NEXT-BAR / PLAY | 下一根 / 每秒播放 / 暂停 | 仅推进一个可证完成 K；对应事实只能按已证边界揭示，未知日内先后不得擅自排序；新 bar/可见事实进入真实视口；末尾反馈并禁用无效动作；源事件追加，不改 Text 归属。日级同 bar 的具体先后仍待解决。 |
| NEXT-DECISION | 下一决策 | 仅从可信可序目标集选择下个决策；切阶段/双截止/owner 原子，保留其他草稿；可定位的目标真实可见。不确定先后不得伪造下一笔。 |
| PREVIOUS | 回看上一根 | 还原上一个可证完成 K 和独立事实边界，隐藏未来和未来定轴，保留所有后来稿及曾见来源；目标真实可见，不因退 K 自动移动 Text 所属。具体 phase 恢复必须对照原合同独立确定。 |
| STAGE | 切入场前/持仓/事后 | 恢复所选阶段各自边界、草稿与窗口，早期不含结果；不等于选某事实、确认或完成；后续来源不删除。 |
| SELECT-FACT / LOCATE-OPEN / LOCATE-CLOSE | 选择事实/定位开平仓 | 区分定位与恢复进度；只揭示明确获准的事实并追加来源，保留原成交数量与该 pair 分配数量；定位平仓在盲态不能偷看结果，其具体确认/可用条件尚未由设计决定，待冻结。 |
| FULL / RESTART | 明确查看完整历史 / 重新开始 | FULL 显式揭示，不自动完成；RESTART 仅重置可见边界并重遮未来，不删除文稿或已见来源。每条来源包含动作、范围、时间和 subject；后补记有真实来源提示。 |
| PERIOD / RESIZE | 切周期、刷新、打开侧栏或布局变化 | 不推进任一边界；刷新保留未存草稿；resize/侧栏保留窗口，period 只可用具证据周期；不能加载完整 K/未来坐标。用户本轮触屏与窄屏排除。 |
| TEXT | 编辑图上文字/数字/IME | 播放先暂停、输入期间快捷键不推进；Text 明确归属目标决策及阶段，保留旧快照原文，展示后来补记来源。 |
| INCOMPLETE | 事件早于 K 收盘 | 已证事实可见，未完成 K 隐藏并解释；日期级缺事实时刻时不能凭合成时钟宣称完成或未完成，按上节保守处理，待冻结。 |
| GAP-END | 缺行情/结束 | 不生成假数据或空跳；提供原因、可执行下一步，末尾停止并保留当前状态。 |
| SAVE / SAVE-ERROR | 保存→返回/reload；失败/冲突→恢复→再存 | 原子保存 subject、双截止、phase、owner、来源集、草稿、snapshot 和 viewport；真实服务重启后读取一致。失败保留本地输入；显式重载恢复服务器完整字段与派生状态，且不覆盖其他窗口新稿。 |

## 可派发的有界开发切片（前提是协调者接受与分配）

1. **S1 身份与仓储合同测试，先红后绿。** 目标文件归一个 owner；先在自行创建的临时 SQLite/合成数据测试 legacy 与 practice-pair 不串写，两个 practice 同显示编号、同 practice 不同 revision/pair 均隔离；非当前 revision/伪造 pair/过期 binding/两个窗口 CAS 均拒绝且原内容不变。迁移未证明唯一的旧稿不自动转移。服务端 authoritative resolver、所有读取、finalize 和 projections 必须接线，不得只做伪 repository。先列具体文件清单并按用户 5 轮上限记录每次修复和独立复验。
2. **S2 日期级边界与真实市场映射，先红后绿。** 唯一 `1D` K、缺/重复/错证券/错误周期、日期相互矛盾、同日事件无证据/重排、收盘是否可知、不能出现未来 OHLC/轴/摘要/标记/可访问文本；用日期语义而非伪 timestamp。因上节关键策略未解决，此切片只能先做数据准备和反例，不得接入用户回放。
3. **S3 最小真实旅程 + 独立桌面审查。** 前置：S1/S2、可信配对 admission/全量绑定和 D06 接受；各入口及调用方明确 owner。练习详情准确 pair → 真图遮未来→下一根/播放/下一决策→Text→早期→保存→返回→重开/reload；跨初始视野真实目标可见，故障和冲突后实际持久内容可恢复。须真实浏览器、独立测试库、服务和页面，非实现者以 1440×1000 与 1280×800 同视口同状态看原图，分别给功能、持久化、视觉 PASS/FAIL/NOT VERIFIED。按 frontend-control-audit 登记受影响控件、指针和键盘；触屏/窄屏依据用户决定排除而非 PASS。全部首道门槛未完成前不能扩展依赖同一状态契约的侧栏、统计和导出。

图表调度建议：同一有效 subject/generation 内，用户主动导航/明确恢复产生最新带单调序号的目标；该目标高于同时到达的 resize/旧数据 fit，resize 保持最新目标但不改变双截止；新的一次明确用户动作可覆盖更旧一次动作。切换 subject 后丢弃旧 generation 的加载/保存/图表回调。使用具延迟提交的 SDK 替身写反例，并在真实图表操作“推进→同帧侧栏开合/resize→跨窗口继续推进”，记录实际可见与截图；销毁后的已排队回调不能触碰旧实例。本段属于建议，需独立审查和真实 SDK 验证，不声称当前已具备完整竞态保护。

## 验收状态

本稿为静态审查与设计准备，未运行产品测试、未进行真实浏览器或隔离库操作。所有 I12 产品门为 **NOT VERIFIED**；D06 的旧身份绑定、日期级揭示策略、完整字段与每个调用方、真实 SDK 动作优先级和独立审查仍未完成。`hasSeenFuture` 的历史布尔值如何迁移为可审计来源集也需兼容策略：不得把未知来源补造成具体动作/时间；只能标记历史来源不详并保留原标记，待独立接受。
