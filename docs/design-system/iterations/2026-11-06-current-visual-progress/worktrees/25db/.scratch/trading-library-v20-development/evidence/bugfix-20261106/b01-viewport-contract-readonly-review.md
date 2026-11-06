# B01 视口 V 契约只读审查（2026-11-06）

**结论：历史观察证据应保持不变，当前视口可以平移、缩放；二者不能混为同一个可覆盖字段。新配对旅程目前没有 V 的公开持久化入口，也没有批准“实际绘制后的 V 何时附属已提交 observation”的具体协议。可以继续接受明确标注 V unknown 的功能、安全和绘制局部结果，完整首条旅程、SAVE/STAGE 的视野恢复仍为 NOT VERIFIED。** 这不是变更验收标准；round4 第50行明确同时要求 unknown 如实呈现，以及完成切片前补齐真实可恢复 V。

审查人：非实现者 `remaining_triage`。仅阅读合同、源码及本地原图；未运行测试、浏览器、HTTP、服务或数据库命令，未修改产品、测试或配置。没有启动其他 Agent。后端仍在独立验收，本报告不作其验收结论。

## 1. 权威与视觉证据

- [回放状态合同][C] 第5、9、13–27、31、37–39行是动作与恢复约束；不是实现结果。
- [round4][R4] 第26–30、48–52行定义 M/F/P/O、V或unknown、历史观察、副本、已揭示选择和恢复；[round5][R5] 第3行只替换中断恢复，不撤销 round4 的其余要求。round5 第13、20–22行要求接管不改变观察点，重绘当前已保存状态后才能继续。
- [主图规格][S] 第108、114–120、231–232行及[元素规范][E] 第88行要求保留平移缩放、已知数据边界、侧栏不改变窗口/价格范围、阶段恢复和历史原文。V2正文第375–378行要求同态真实图与独立证据。
- 本次重新直接观看原始 [02 入场前图][P02]、[04 持仓图][P04] 以及已保存的 [V2 a1 SVG渲染图][A1PNG]，并对原 SVG、a2 和上述文档登记 SHA。02 有独立侧栏、04 展示后续已揭示标记，a1 是更晚的配对结果示意；这些图能约束布局、阶段信息和事实锚点，不能推出 V 的保存时点、原子协议或同帧总优先级，也不能当成当前 A/B/C 的同态像素验收。
- [当前 DESIGN-COVERAGE][D] 第7–13行已保留 V unknown/完整 SAVE 未通过；[UI接线计划][U] 第21、62、73行也未把可恢复 V 从完整交付删除。该计划是实施边界，不替代批准合同。

## 2. 逐项回答

| 问题 | 已有合同与源码事实 | 结论/尚缺部分 |
|---|---|---|
| 历史 observation 的 V 必须不可变吗？ | R4:28–29保留确切观察点、只读入场前副本；R4:50要求恢复对应确切历史点，R4:52禁止由后态反推旧视野。当前 schema:614–617 对 observation 与 before snapshot 禁 UPDATE/DELETE；RESTORE在 journey:505–507 建新观察点并记录来源，不改原点。 | **历史证据不可被后来视野覆盖**是既有合同及当前数据库保护。已记录 unknown 不能事后填上当前 V 冒充历史。这里不等于用户当前 V 永远不变；C:9将其作为独立状态，S:116/118保留平移与手动范围。是否以另一个可证明新观察记录补充 V，属于待冻结接线，不可称现有功能。 |
| 平移/缩放是否已有持久化入口？ | ChartViewport/ChartHandle已提供范围、比例、轴和 get/restore（chart:58–84、1736–1788）；旧 Recall 的 snapshot/context 可带 V（types:30–44、73–83），旧 workspace 在阶段离开/截图时读取与保存。新 pair UI:115没有 onReady handle；journey route:61–65精确白名单没有 V；journey:168响应也没有 V。 | **旧 Recall 与图表工具有能力，新 pair journey 没有端到端入口。** `practicePairViewportKey`只是图实例身份，数据库 nullable `viewport_json` 只是槽位，不是已接保存链。不能将旧 workspace 或 key 冒称新 pair 已支持。 |
| V 何时附属于 observation？ | R4:26–29规定观察点含 V或unknown；没有规定 pan/zoom事件自动提交、保存按钮提交、推进前捕获或绘制后回执提交等精确时点。当前所有新观察点写 `viewport:null`；RESTORE只接受 null（journey:486），state恢复也置 null（506）。 | **当前实际时点仅是“创建观察点时明确未知”**。不得把缺少定义解释为任意回填许可。尤其 BEGIN/STEP 服务端先提交 B/C/D，浏览器随后才画图；请求前采得的 A/前一态 V 不能当作新 B/C/D 的真实 V。 |
| 恢复、resize、reveal优先级已批准多少？ | C:13/17/26要求恢复保存窗口；C:14/15要求推进目标真实可见；C:22要求 resize保留视野且同帧优先级由D06冻结；C:27禁止迟到SDK/请求覆盖主动导航。S:108、232规定侧栏开合不重置窗口。 | **批准的是必须满足的结果与隔离条件，不是所有写者的总排序**。当前代码局部 pending/reveal/fit顺序可复用，但不等于 D06 的 restore/reveal/resize组合已完成。详见第3节。 |
| V未知时能否先做最小首旅程？ | R4:26/28/50明确允许 unknown 且必须如实显示；同一R4:50又要求切片完成前补上真实可恢复 V。R5:20要求实际重绘保存状态；U:62/73承认V未闭合。 | **可做且可独立判定局部功能、安全、绘制、Text内容持久化结果；不能宣布首切片完整完成。** 重开可以证明 M/F/P/O/文字一致，不能写成“全部状态/同视野恢复”。RESTORE功能只按安全投影限定接受，完整V恢复保持 NOT VERIFIED。 |

## 3. 优先级：合同约束、现有局部机制与未决项

| 情况 | 已批准结果 | 代码事实与还不能签的部分 |
|---|---|---|
| 单独平移/缩放、侧栏/resize | 不推进 M/F/P/O、不增加未来信息；保留窗口和轴（C:9/21–22；S:108/116/118/232）。 | chart:1249–1284读取 pending range优先于尚未应用的SDK getter，宽度改变重发稳定范围。源码存在不证明真实各状态及 price轴均恢复。 |
| NEXT/reveal同时数据更新/resize | 目标 bar/trade 和轴真实可见，仍只按已知数据定轴（C:14、24）。 | chart:1405–1455先保留并映射旧窗口；1503–1518基于pending范围扩展到目标，1536–1545仅以已知价扩轴并标已fit；1584阻止普通initial-fit覆盖。这是局部机制，不是任意RESTORE抢占规则。 |
| 恢复保存窗口与初始fit/SDK迟到 | 保存窗口需真实恢复；迟到SDK不得覆盖当前主动导航（C:26–27）。 | 旧workspace:1146–1168用新reveal取消queued restore、onReady后一帧再核对句柄/引用恢复；这是旧episode消费者机制，新pair未接入，不能直接照搬其业务排序。 |
| 历史RESTORE、阶段恢复、主动reveal、resize同帧 | C:22明确需D06冻结；恢复早期不能带后态范围，主动动作不能被迟到恢复覆盖（C:13/17/27）。 | [既有D06静态核对][M] 第58、64行已明确全组合未冻结。不能自行规定“总是restore赢”或“总是reveal赢”。需要明确请求所指观察点/身份、主动动作是否已替代先前恢复，再验证实际图。 |
| 价格轴自动/手动恢复 | 手动范围可保存，自动轴仅已知数据（S:118）。 | chart:1771–1786先恢复spacing/offset/逻辑范围，再price options/range，最后恢复autoScale，以免setVisibleRange强关自动轴。这只定义SDK局部应用顺序，不保证旧后态轴安全用于早态。 |

`ChartViewport.logicalRange` 是当前 `timelineData` 上的逻辑索引，包含已披露日期 whitespace 的变化可能改变序列；chart:1405–1455有当前实例内基于旧/new数据的映射，但持久对象本身没有该数据身份映射。不能脱离 source/pair/observation、安全时间线直接套旧索引。`width/height` 是 getViewport 读取的捕获元信息（1738–1751）；restoreViewport没有用它们强设当前DOM宽高（1771–1788）。已有“保留窗口”不等于把不同桌面恢复成同样物理像素尺寸。跨尺寸的正确范围/轴及无未来泄露需要实际验收，不能靠保存了宽高认定通过。

## 4. 可由既有合同推出的最小接线

**当前可推进的局部接线，不新增 V 政策：**

1. 严格客户端消费真实新版 journey 当前安全投影、版本、observation与过程；UI只呈现已提交的 M/F/P/O/文字，并明确“视野未保存/未恢复”的事实。可在响应增加明确 unknown 表达，但不能由前端默认 fit 推导“已恢复”。不放宽旧协议或用旧progress writer旁路。
2. 真实图仍用已披露数据和一次性reveal，确保B/C目标事实与D真实K实际可见、无未来轴。`onReady`可连接现有ChartHandle作为后续真实捕获/恢复所需原语；仅连句柄不算已持久化。
3. 历史RESTORE按既有精确observation及safe projection接线；保存文字、真实离开/返回/reload可以独立证明文字和状态持久化。V为unknown时显示其限制，不应用别的阶段/配对当前窗口冒充历史V。
4. 控制主动动作、异步SDK和resize时，遵守已有目标可见及迟到不得覆盖原则；未冻结的动作组合保持未验证，不借此擅自决定PREVIOUS、阶段或SELECT政策。普通ChartHandle.flush只同步处理SDK失效队列（chart:1762–1768），不是浏览器已前台绘制或观察间隔的证明。

**要关闭V后续必须补齐的工程闭包（现阶段不是授权实现方案或新用户需求）：**

- 保留现有历史不可变保护、唯一Recall权威与旅程CAS；明确定义新状态在真实绘制后采得 V 如何与身份/数据摘要/observation及修订绑定。必须正面处理“服务端已提交观察点，前端尚未画图”的时间差。不要修改旧点伪造历史、不把捕获上一态的V附到下一态；不能仅在STEP请求新增一个viewport字段就宣称解决。
- 对V做浏览器安全类型、服务器严格校验与版本化读写；未知与已证实值区分；RESTORE当前 `point.viewport !== null` 的拒绝分支需在真正支持后相应受控扩展。哪个已有命令承载、是否以新观察记录表达、pan/zoom何时算已保存，现合同未冻结，本报告不定名、不擅设自动保存政策。
- 前端在正确当前安全数据/图身份就绪后调用restoreViewport；已被后续主动动作替代的恢复需失效，不能让迟到旧handle/request覆盖。按实际SDK和数据索引核对restore/reveal/resize组合；结果优先级沿合同约束冻结后再实现。
- 用隔离库真实平移/缩放/手动轴→保存→返回→reload→精确历史点→另一桌面resize，独立证明安全投影、同窗口/比例/轴、来源和草稿不混；不得以mock回调或DOM取代真实图。此处仅列既有SAVE/RESIZE验收依赖，本轮未执行。

因此最小文件闭包分为两层：本轮UI局部链为 `practice-http-client.ts` + 浏览器安全journey契约/控制器 + `library-practice-browser.tsx`/`library-practice-replay-before.tsx` + `ReplayChart`回执/句柄消费者；**完整V闭包还必须涉及** journey route、`practice-pair-journey.ts`的状态/观察读取写入/恢复验证、相应strict类型，以及实际ChartViewport捕获/恢复。是否需schema变更取决于冻结的协议；当前已有nullable槽和immutable触发器，不能先断言必需新迁移或去掉保护。

## 5. 验收措辞与未决清单

- 允许的限定结论：`A→B→C→D功能/安全/真实绘制通过（仅已取证项），V unknown；文字内容保存返回重读通过（若有实际证据）`。本报告没有执行这些动作，不提前判PASS。
- 必须保留：完整 `TL20-R-SAVE`、`TL20-R-STAGE/BEFORE`同视野恢复、历史V、同帧总优先级、完整B01/首条旅程/V2 **NOT VERIFIED**。仅取M/F/P/O恢复不能称“完整恢复”。
- 未决不是新增业务投票：V真实采集附属时点/事务协议；unknown是否另立可证明新记录而不改历史；对应安全时间线索引映射；主动动作替代恢复的准确身份/代次；组合时序及跨尺寸范围证据。合同已有禁止未来、保留草稿/来源、历史证据不可冒造和真实恢复门槛，无需重新确认这些已定规则。
- 本轮排除触屏、窄屏、小时；不涉及项目文档管理、用户旧库对账或业务数据迁移。未触碰STOPPED Recall测试，未借本次只读审查重启其第六轮。

## 6. 版本边界

源码、合同与原始图片共23文件的SHA、字节数、采集时间见 [版本指纹](b01-viewport-contract-readonly-fingerprint.json)。该清单针对静态核对，不能替代正在运行服务/后端验收的版本绑定。最终写盘后复核结果由该JSON的 `finalCheckAt`/`changedDuringReport` 给出；若后端或UI后续变化，本报告保留为此快照的事实，不自动成为新版本接受结果。

[C]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/REPLAY-STATE-CONTRACT.md:5
[R4]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/I12/real-chart-next/first-journey-design-round4-20261029.md:26
[R5]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/I12/real-chart-next/first-journey-design-round5-recovery-20261029.md:13
[S]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:108
[E]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/docs/specs/2026-09-25-chart-first-review-ui-elements.md:88
[P02]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png
[P04]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/docs/designs/2026-09-25-chart-first-review/04-holding-stage.png
[A1PNG]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/bugfix-20261106/b01-ui-before/reference-hcr06-final-replay-a1.svg.png
[D]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/DESIGN-COVERAGE.md:7
[U]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/bugfix-20261106/b01-first-journey-ui-implementation-plan.md:21
[M]: /Users/zhoulin/.codex/worktrees/25db/TradeReview/.scratch/trading-library-v20-development/evidence/I12/real-chart-next/d06-field-sdk-independent-map-20261029.md:58
