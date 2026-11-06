# B01 首道真实回放网页接线实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. 按下面复现→最小修复→定向复验顺序执行。用户已授权多 Agent 实施及独立验收，不再次请求执行许可。

**Goal:** 用真实页面消费新版持久回放过程，使一次“下一根”依次画出同日入场 B、退出 C 和完整 K 线 D，接通暂停、文字保存与安全重开。

**Architecture:** 一名 UI owner 负责严格 HTTP 消费、浏览器生命周期和真实图表控制器。后端是独立前置；本计划不修改其存储或绕过旧关联保护。首图旅程按公开入口逐片接通，协调者和非作者验收后才扩展依赖它的功能。

**Tech Stack:** React 19、TypeScript、Lightweight Charts 5.2、现有 RecallFrame/ReplayChart、Vitest、真实 Chrome 与独占测试 SQLite。

**Spec:** [批准 V2 正文](../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) 254–298；主图规格 `docs/specs/2026-09-25-chart-first-review-ui.md` 112–120、164–186；元素规范；本功能 `REPLAY-STATE-CONTRACT.md`；`evidence/I12/real-chart-next/first-journey-design-round4-20261029.md` 及替换其中恢复段的 round5。派发准备为 `b01-first-journey-ui-dispatch-preparation.md`，不代替原文。

2026-11-06 06:51 +08 阶段增量：root已独立接受Task1最终七文件的读取切片，现放行Task2，精确权限以 `.superpowers/sdd/b01-first-journey-ui-implementation-plan/task-2-brief.md` 为准。以下Task1-only状态是派发历史；完整视觉/首旅程/Task3未通过，禁止据本增量扩展依赖实现。

## 约束、归属与接线门槛

- 状态：后端已获非作者限定接受（b01-backend-independent-acceptance.md，最终24文件冻结）；2026-11-06 root仅放行Task1，逐片审查后再解锁Task2。本计划不是UI实现或验收结果。
- 沿用现有 worktree 和全部未提交工作；用户数据不动。不得升级现有3437/3426测试库，另建显式隔离22库及独占端口。
- 唯一UI实现/整页视觉/数据链 owner：新上下文 `journey_ui`（实际gpt-6.1-terra / ultra）；root整合、非作者另验。后端作者global_currency_capital转交只读准备，没有同时写UI；CSS已有局部修复，Task2正式交给同一UI owner时才允许调整。
- 日线桌面；1440×1000、1280×800，另1440×900便于参考对比；100%浏览器缩放、DPR1，记录实际值。触屏、窄屏、小时线本轮排除。
- 精确图片：`docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png`、`04-holding-stage.png`；V2 `source/images/hcr06-final-replay-a1.svg`、`a2.svg`。实现者先直接观看。标题/阶段 E01、绘图 E03、主图/轴 E04/E05、Text E08、底栏 E19；不得把画板的解释性批注搬入产品。
- 桌面按钮至少36px、字段14px；不缩字或隐藏功能以通过几何。保留已修时间轴和底栏首屏。单 Text 行不是完整绘图工具栏；现有 header 63/103px 与原参考48px差异不能抹去。
- 旧关联 ADOPT 仍 FAIL；V当前未知，完整恢复仍 NOT VERIFIED；上一根、任意阶段/事后、正式快照与未冻结 D06 政策不在本片自行补定。原位置说明能力，不假成功。
- 禁止运行五轮 STOPPED 的 `recall-workspace.test.tsx` 全文件/相应用例；不跑全套，不增加超时，不降低95%目标。测试只在已获用户同意的“读取/返回、保存/失败保护”公开入口，图表能力属其实际消费链。

## 文件及公开接口

允许修改：`app/lib/storage/practice-http-client.ts`；新建浏览器安全 `practice-pair-journey-contracts.ts`；`app/components/library/library-practice-browser.tsx`、`library-practice-replay-before.tsx`；新建同目录 `practice-pair-journey-controller.ts`/hook；`app/components/chart/replay-chart.tsx`；必要时仅 `.library-practice-pair-replay` 范围的 `recall.css`。对应定向测试由同一 owner 负责。不得改数据库、journey服务/route、通用 Recall 工作区、运行配置或业务原始数据。遇生产者缺能力先报告 root，不能在前端伪造。

- 消费实际 `GET/POST /api/storage/practices/{practiceId}/pair-reviews/{pairRef}/journey`，协议 `practice-pair-journey-v1`；成功及错误严格校验版本，成功检查 practice/revision/version/pair 身份及安全 view；错误体实际只有版本与error，不要求其不存在的身份字段，另以请求epoch隔离迟到响应。新增 `readPairJourney(practiceId,revisionId,practiceVersion,pairRef)`、`commandPairJourney(practiceId,pairRef,command)`，不放宽旧协议解析；旧client固定协议的通用request不可直接复用。
- 响应按 `adopted:false | true` 判别；实际字段 `currentJourneyRevision`、`currentSafeView`，已采用才包含 observation、Recall、process及历史目录；未采用无这些对象。token不能由GET取得/写入日志。
- 只读journey GET不 ADOPT；现有打开入口的绑定POST须单独如实记录，预绑定样本才能验证整个重开零写。首次已授权写入/推进入口才采用。未采用的旧 Recall 读取仅作安全当前展示；跨请求被其他页采用时重新读取journey，不能把错误当空文本，采用后不得再用旧 progress/text writer。首次A保存先ADOPT，再按新版CAS保存，失败保草稿。缺22清楚提示需升级副本，不静默升级或双写。browser旧方法存在性guard也须一并更新。
- ReplayChart 新增显式 `onRevealedFactSelect(factId)`、带 scene/observation 身份的绘制回执，消费者必须真实使用。保持 executionId 和 factId 两套身份；现有其他调用者保持兼容。

## Review Focus

1. 切练习/配对/离开后旧响应或旧帧晚到：不污染当前身份，保留正确草稿。
2. B/C 尚未真正画出、后台或失焦：不派下一步、不把隐藏时间算停留。
3. STEP与编辑/暂停在途相撞：显示真实已提交状态，确认暂停后编辑，草稿不丢。
4. 丢响应与另一页接管：同ID同body重试，旧owner不能借receipt继续，重开不自动推进。
5. 同id不同phase/O文字及早期恢复：独立可见/可写，隐藏后续不泄漏、不被覆盖。

## Task 1：严格客户端和页面读取

- [ ] 在公开客户端请求入口写红测：新版成功/业务错误、错版/错身份、迟到响应；旧请求依然严格。
- [ ] 运行精确文件/用例，保留原FAIL；实现判别联合及上述两个方法。
- [ ] browser打开读取新版，component用currentSafeView；预绑定隔离样本journey GET零写，首次绑定另记写入；采用后重开仍读新状态，未采用Recall迟到/采用竞态不覆盖当前态。
- [ ] 跑对应client/component定向测试，记完整命令与case列表、SHA、stdout。不要扩展整套。

## Task 2：一次下一根 A→B→C→D 的真实图

- [ ] 公共页面红测：一次手势先BEGIN B，只有当前身份绘制回执及至少400ms有效前台停留后STEP C，再同条件STEP D；不得偷偷BEGIN D3。
- [ ] 串行controller使用服务端G/generation/双CAS；scene变化废弃旧回执，隐藏/失焦只暂停有效计时并保留可恢复意图，同scene/owner且无用户暂停/输入时可安全重臂。普通K的completed/step3不派STEP；缺行情/末尾有原因。Task2最低屏障须在暂停/输入意图时立即停派并结算在途响应，完整编辑留Task3验收。
- [ ] 图表把入场/退出事实各自画出，目标日期锚及价格在可见区域。flush/rAF/DOM单独不算真实绘制；增加当前scene primitive实际draw的factId及pane内有限坐标回执；D必须证明实际candle数据与几何，不能将同日whitespace冒充完整K。之后前台帧计时；浏览器截图和时间证据另验。
- [ ] 新隔离服务真实导入→绑定→A→单击→B/C/D，逐态截图+网络：B/C无D2OHLC/结果，D有D2、无D3；另一次手势才D3。
- [ ] 冻结本片，非作者及root先实际看首张图；未验前不扩大依赖功能。

## Task 3：暂停、文字、播放与重开

- [ ] 逐个公开红例：A草稿保存→BEGIN冻结；B/C点击Text先暂停；同id before/null 和holding/null不混；保存失败/409保留输入。
- [ ] 渲染key用 `(phase,ownerFactId,text.id)` 可逆身份，提交原文字id；before继承只读，holding只编辑当前O。输入/IME/数字控件及焦点期间禁止推进快捷键。
- [ ] 播放首次立即开始；下一根同时满足完成和启动后1000ms有效前台时间，不并发、不追赶、不在完成后额外等1秒。暂停保留剩余，重开按round5接管后先真实重画、重新计完整观察间隔，用户暂停取消继续意图。
- [ ] 已披露事实真实鼠标/键盘选择；历史目录RESTORE A/B/C仅安全projection；RESTORE/NEXT_DECISION后的B/C无ownerToken，先显式RECOVER取得新token/generation再继续。上一根和未定义阶段规则不自行代替RESTORE。
- [ ] 实际保存→离开→返回→reload、错误重试、双页/迟到响应，核对隔离库原始交易未变。V明确未知不能声称同视野恢复；其后端闭包单独依现有合同处理。

## Task 4：冻结和独立接受

- [ ] 正式文件完整清单、before/after原文+SHA+diff、精确测试命令/用例与原始日志；产品冻结后才派非作者，发现FAIL按rootcause记录，五轮无进展停止换项。
- [ ] 受影响完整控件登记：列表打开/返回、阶段入口、Text开关/输入/保存/取消/冲突、图上事实/历史点、下一根/下一决策、播放/暂停/重开恢复、状态/重试及禁用项，固定分母；不把disabled计成功。
- [ ] 非作者真实Chrome两桌面匹配A、B、C、D、文字/暂停/错误状态，对照原图；功能、持久化、真实绘制、视觉分开判定。
- [ ] root实际检查live预览与关键保存/重开、源码指纹、限定typecheck/ESLint。同步README、DESIGN-COVERAGE、FINAL、CURRENT；所有FAIL/NOT VERIFIED保留，不能宣称完整B01/V2/95%。

## 计划自审

本片覆盖读取、NEXT_BAR/PLAY、Text、SELECT、RESTORE及NEXT_DECISION的已批准最小旅程；未覆盖上一根/任意阶段/正式快照/事后、旧关联采用、可恢复V、完整绘图工具栏和所有V2，保留在总交付清单。客户端方法与consumer一致，后端命令使用实际route字段；不提出额外产品政策。本片无git提交/远端授权，不执行提交合并。
