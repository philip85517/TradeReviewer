# P3 附加筛选接线独立只读审查

审查者：`/root/attachment_review`，实际模型 `gpt-6.1-sol / ultra`。冻结时间：2026-10-22T23:01:17.633128+00:00。范围由 root 的独立审查派发限定，产品和既有测试只读；仅新增本目录报告及 manifest。**本报告没有接受 UI 功能或批准合并。P3 正式 0/3、P1 正式 2/3 FAIL 保持。**

## 结论与问题分级

本轮直接读七个产品文件全内容及相关真实调用链后，**未建立可报告的新 Critical / Important / Minor 缺陷**。没有最小独立失败反例，因此未创建或执行测试；没有重跑 worker 的 122+10+4 或全套。静态未发现缺陷不等于功能 PASS，也不取消既有 FAIL / NOT VERIFIED。当前不可据此声明 ready to merge / delivered；root 尚须分别接受功能旅程、真实输入、持久化和同态视觉。

| 等级 | 本轮新确认问题 | 证据边界 |
| --- | --- | --- |
| Critical | 0 | 无可复现的数据损坏/安全/核心失效反例 |
| Important | 0 | 未找到与本次批准接线契约矛盾的确定调用链 |
| Minor | 0 | 不把未执行检查、已披露 helper 限制或既有 warning 伪装成新产品缺陷 |

实现中可从源码明确看到的有效边界是：S 仍拥有 C/D 和请求；fresh summary 属于同一 owned bundle；全复合组先资格筛选再重建 canonical entry；新请求、取消、超时、review baseline 与 drawing sequence 保护仍在实际调用链中。

## 必须保留的 pendingFact 限制

[`attachment-groups.ts:148`](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/homepage-v25/attachment-groups.ts:148) 的 `pendingFact` **先**在第153行执行 `reviewState(item) === "pending"` 并返回 true，**后**于154–160检查 coverage。既有 `reviewState` 在没有 Recall/legacy review 记录时默认 pending。因此 raw helper 收到 `summariesComplete=false` + 可用 episode + 无 review/Recall 记录时，可以返回 **true，而不是 unknown**；coverage 中的 `review-summary-read-incomplete` 不能推翻这次提前返回。不能写成“所有 incomplete 输入均 unknown”，也不能把 true 都称为已抓取的显式 pending 记录。

这与已批准的 [INTERFACE-PROPOSAL.md:21](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/P3/attachment-integration/INTERFACE-PROPOSAL.md:21)、第23行和 [HANDOFF.md:34](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/P3/attachment-integration/HANDOFF.md:34) 的公开限制一致。本轮查到当前真实 restrictive 路径有下列前置链，而未找到绕过：

1. Host 将 exact S token 和通过 source 兼容判断得到的 `readTarget` 传入 reload（`use-homepage-host.ts:83–99`）。
2. [`trade-review-workspace.tsx:2190`](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx:2190) 仅当 `pendingReview.length === 1` 时，在同一 `Promise.all` 强制 fresh strict Recall summary 与 bootstrap；无/双值不请求它。
3. [`summary-client.ts:31`](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/recall/summary-client.ts:31) 使用 no-store，HTTP失败、结构错误或任一无效 summary 抛错。不存在失败后空数组 fallback。
4. Workspace 仅用本次 bootstrap reviews 和本次 summaries 构建 entry（2206–2212），并显式返回 `reviewSummariesComplete: recallSummaries !== undefined`。ambient summary effect 不提供该 complete 标志。
5. Required read 失败不会产生可接受 bundle；Host 的 catch 保留旧数据/C。成功 authoritative list 中无该 episode 记录时，当前业务语义视为未复盘。无/双值则 complete=false，但 `pending.size === 1` 之外不施加 pending 资格条件（`attachment-groups.ts:201–214`）。

这是**当前调用链的静态安全结论**，不是更强的 helper API 证据保证。未来期间/历史/贡献消费者若直接调用 helper，必须维持这条前置链，不能只传 incomplete coverage 就期望缺记录成为 unknown。真实错误/取消/return/reload 执行仍由 root 验证。

## 逐项审查证据

| 原批准要求 / 元素 / 准确引用 | 实际源码 / 独立判断 | 执行与验收边界 |
| --- | --- | --- |
| HV25-11/12，HOME-HP03-B044；原正文161–177：五维、同维OR跨维AND、D应用、未平仓含零浮盈亏 | `attachment-groups.ts:48–68,126–145,199–214` 使用 account/instrument/nature/run JSON tuple，当前量由匹配 asOf 的 canonical quantity 建立；不是以 P&L 判断未平仓。类别可信元数据未知不假定 stock；`holdings-model.ts:102–113` 从完整 owned entries 构建 current 和 coverage | 静态未建立反例；真实条件切换、零盈亏数据、待复盘错误/恢复仍 NV |
| 同上；dispatch17，proposal21/23；strict fresh summary 与 no/both 区别 | Workspace2182–2212、strict client31–44，详见上文。coverage72–109 检查 applicable lineage、缺口/初始仓位/方向/分配/混身份等，未硬编码 complete | 静态链可追踪；raw-helper caveat 保留；独立测试未运行 |
| HV25-10/23–30/44–49；dispatch11/17，proposal25–27：准确集合、全历史费用、禁止账户×标的扩张 | `projectEntries:113–123` 收集合格全组原始 fills，按 fill id 一次去重，经 `buildInstrumentTradeSummaries` 和 `buildTradeLibraryEntries` 合并重建；保留原 instrument 与 episode review/Recall。Workspace2278–2287 将这份 projection 送 ordinary。没有先按首页期间截断组历史 | 实际 library `buildTradeLibraryBrowseRows` 只以 episode 的任一执行命中日期决定 membership；display aggregate 的 date-range 执行展示不反向改资格/episode费用。本次未测试下载或真实金额 |
| proposal5/19/27：schema/scope compatible source、可缩至symbol、普通global不继承 | `session-model.ts:21–27` 严格恢复 source，market/accounts/range/date完全兼容（仅 symbol 不参与比较）才借 attachments；Host95,153–168 区分带 query 的 homepage-origin 与裸 global；S303–306,378–380 identity/nav 新 draft 清空 attachments；Workspace2268–2274 global分支不使用 ordinary附件projection | 未找到旧 source 意外施加到 bare `/trades` 的链；实际history/reload NV |
| proposal5/26–27：完整 owned sources 直至fresh catalog，final account fallback 再筛 | Host103–138 从 result.data 的 catalog 验证；source账户缺失时显式剩余/全部 fallback并提示，完整 result.data 保留，最终 collectionTarget 的 accounts 更新后再由Workspace2282筛；symbol identity 不可解析则失败 | 未找到“先旧账号筛空、再UI显示全部”的实现路径；真实删除账号/来源恢复 NV |
| HV25-11/12/13，原正文165–177；请求失败保C+D、取消/迟到不可盖新状态 | S321–349 验 generation/scopeKey/target；Host99先验pending owner、142–150旧错误不可清新owner；261–266取消仅apply；207–225绝对15秒；`session-model.ts:12–17` 仅 accepted 改 data。Surface显示committed badge/token，popover编辑D；clear/reset为D动作、identity另走S | 未重跑有限用例；真实Esc/外点/键盘/取消/timeout/late frames NV |
| 原正文456与495–501；fresh return，完整UI恢复、无自动首回合 | Host恢复source仅在接受成功；`homepageCollectionState:34–48` selectedInstrument/Episode均null；Workspace显式episode入口找到准确summary/episode，Recall guard透传；初始化/来源恢复不把 fixture remount 等同真实reload | 真实detail→ordinary→explicit episode→guarded return→reload仍NV |
| dispatch17，proposal5/21：本地review/drawing草稿与CAS保护 | Workspace2187捕获baseline；2224–2240拒绝覆盖新review对象、更新updatedAt、本地drawingDraft和seq变化；3268–3329保持每episode保存队列/seq；5593–5629先flush且repository false拒绝；1330附近真实leave guard经 `setActiveView` 执行 | 静态未见本次接线移除保护；实际SQLite write/return/reload及CAS冲突仍root的P1门 |
| HV25-13；原正文163/177/507，manual456–510；320/36/reset第二行/底16/badge/token/窄屏 | 实际Surface/CSS接入既有附件popover，新增anchor/token，<=600采用fixed窄屏布局；没有替代已批准层级。直接查看原参考衍生图只证明读过参考，不证明当前渲染相符 | 视觉一致性、<=600两侧、长文本、motion/rect、焦点可达全部NV |

## 触发、范围与版本覆盖

触发：本次是影响前端控件及数据/状态接线后的独立代码审查，适用 `frontend-control-audit.md`。已读 AGENTS、development-workflow、frontend-control-audit、task-decomposition、ui-task-templates、issue-tracker；已读 requesting-code-review 技能及 reviewer 模板。已读 dispatch/proposal/handoff/control inventory、FINAL-MANIFEST 和根 DESIGN-COVERAGE 的本范围映射；原始正文130–190/255–346/454–502、manual456–510直接读取。原图映射沿 dispatch，不能用手工交接替代原规格。

独立直接查看的四张参考衍生图位于 `reference-readback/{filter,multi-applied--reopen,clear-attachments--after-clear,reset--reset}.png`。本轮没有当前页面渲染截图，故未进行“当前 vs 原图”同态视觉对比；其余引用 SVG 为已映射原图，未冒充全组像素比对。

直接读取产品全内容包括七个产品文件（含未跟踪目录），不局限于 git diff。真实相关调用方还包括 `homepage-v25-state.ts`、Recall strict summary client/types/queue分类、library browse membership/display aggregate、Workspace的ambient summary、owned reader、accepted merge、route collection、显式episode/Recallguard、review/drawing保存段。没有以 worker自述代替这些源码检查。版本SHA见 MANIFEST，HEAD前后相同；七个产品指纹均与worker冻结相同。

| 门 | 本次独立证据 | 状态 |
| --- | --- | --- |
| 静态契约/实际调用链 | 上表和pending限制；无新确认缺陷 | REVIEWED，不能换算成功能PASS |
| 独立功能执行 | 未运行测试；root正独立执行有限/其他检查；worker122+10+4仅作为已披露背景 | NOT VERIFIED by this reviewer |
| 17个局部附件控件真实输入 | 沿版本绑定CONTROL-INVENTORY，未操作浏览器 | 0 PASS / 0 FAIL / 17 NOT VERIFIED；真实点击尝试与结果0/17 |
| 相邻journey、动态实例、8态 | 沿现有库存；没有虚构真实row/option分母，longtext也未执行 | NOT VERIFIED |
| 鼠标 / 键盘 / emulated touch / physical touch | 每种均0次实际执行，互不替代 | 各自NOT VERIFIED |
| 真实浏览器返回与reload、source/session持久化 | 无浏览器或服务调用 | NOT VERIFIED |
| 实际Recall写入→返回→reload，isolated DB | 无DB读写；不得以parser/fixture回调证明 | NOT VERIFIED；P1 2/3 FAIL保留 |
| 原图同态视觉、布局密度/窄屏/运动 | 只有原参考读取，无当前截图和rect | NOT VERIFIED |
| 四区共同资格、期间/历史/贡献和财务页 | 当前切片不完成其全部消费者，既有缺口不免验 | 原FAIL / NOT VERIFIED保留 |
| formal接受 | 未修改issue/README/最终验收记录 | P3 0/3；P1 2/3 FAIL |

## 本轮不裁决的事项（须由root保留）

- 整页视觉、当前渲染与原图比较、真实输入/长文本/窄屏：本派发禁止服务/浏览器，留给root；不是排除需求或N/A。
- Recall真实持久化、数据库安全、save→return→reload：本派发禁止DB，root完整数据流owner；保留P1失败。
- P2/P4期间、历史、贡献四区及财务正确性：dispatch明确当前不展开，原FAIL/NV继续；不据此验证不存在的消费者。
- A性能讨论/重性能：dispatch明示待用户答复；本轮无性能运行或结论。
- 旧独立币种、近三月、盈亏日历：已批准V2.5迁移范围外；并不取消旧Workspace #10/#11的类别、D/apply/error/return/reload业务失败语义。
- future raw-helper更强“缺记录+incomplete一律unknown”契约：当前批准方案明确不承诺；当前真实单值入口前置链已静态检查，未来消费者仍需单独证据。

## 冻结记录

审查前后git HEAD：`5a94ee3ff76e32993fe2c4791a83b40e877a7344`（detached dirty shared worktree；无本审查commit）。`MANIFEST.json` 逐文件保存baseline、worker冻结/审查前、审查后 SHA256、大小与行数。七个产品均无本审查写入。

本轮文件操作仅新增此 `REVIEW.md` 和 `MANIFEST.json`。无产品/测试/配置/依赖/服务/浏览器/网络/DB/其他tracker改动，无子代理，无测试执行。初次只读`shasum`因locale/perl报错，改用`LC_ALL=C`成功；这不是产品失败。

本报告与MANIFEST写入后即为独立审查冻结点。后续root若修改产品或发现回归，本版本证据应保留并重开受影响检查；不把本轮静态无新发现记录扩成整页接受。
