# P3 首条搜索 / 详情 / 来源返回只读控件预审

- 审查者：`/root/state_g61`，实际 `gpt-6.1-sol / ultra`；未实现被审 Surface。本文是派发前和 root 实浏览器验收准备，**不签 accepted；P3 仍 0/3**。
- 触发：root 明确要求搜索及详情控件检查，适用 `docs/agents/frontend-control-audit.md` 与 `ui-task-templates.md`。本代理仅读源码、既有测试输出、原图和 root 已保存证据；没有运行测试、HTTP、浏览器、服务或数据库，没有修改产品/原测试。
- 工作树：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`，dirty 内容以 manifest 为准。
- 开始：2026-10-23 04:07:02+08，结束指纹：04:11:25+08。完整指纹见 `SOURCE-MANIFEST.start.json`、`SOURCE-MANIFEST.end.json`；当时 20 项中 19 项一致，只有 host 正在由 integration 修改。10 个首页源/测试的原审查副本保存在 `frozen-source/`。
- Surface `914f13c9cb429c40b76acf45a562168fbc4e309a6fdbaeb5248a52a2529f95b5`；CSS `d34b54ab5eb9b5232847607d3b5c94e9b93833da3703b2292793066e6dff43d1`；search test `c2369ebcb6daf32097f54653a9732e45e6bc0318bf2ea3e4e3831143c6c8c788`。
- **host 版本边界**：起始审阅 `74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2`，结束已有 `85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`；本文没有审读或接受后者。旧 host 的风险不可直接当作新 host 结论。
- 本次范围：全局搜索入口、查询及结果全部交互种类、搜索详情、共享持仓详情的受影响控制、普通库入口与来源返回。过滤弹窗尚未授权接入本切片；它是后续 P3 未完成项，不能记全 P3 N/A。P2/P4 图表、整页其他控件不是本局部分母。
- 原稿/契约：`P3/PRE-DISPATCH-STATE-CONTRACT.md` SHA `016580e865e3e0be2bcab814dbdf62292836c7a16071ddbba98a7b40de618057`；原正文 SHA `daa1434e4437c340cbd23e38e15a7a34c31a892685ad7dfd1269ffe418605c22`；manual SHA `1f532219fc78f52b8c9c7366aa4bf1b02d349fb43c3d0093311f7784bde246f0`。正文优先的既有裁定保留；没有新增需求或授权偏差。

## 已证实的两项缺陷

### CR01 — 搜索关闭/重开丢失已保存的非零结果滚动

**状态：FAIL，root 真实浏览器复现；P2 严重度，实现接线故障。** 受影响的是关闭搜索再开，不是“详情关闭回搜索”那条仍保留 DOM 的路径。

最小反例：普通 ready 全部市场 → 打开全局搜索 → 输入 `6` 并等 300ms → 实际滚动结果两页 → 关闭搜索 → 再开。root 在 tab7 / `http://127.0.0.1:3334` 记录关闭前 `scrollTop=816 / clientHeight=406 / scrollHeight=9753`；重开 query 仍为 `6`，`scrollTop=0`。原先可见碧桂园服务/自由黄金等区域，重开回到中国铝业首项。证据为 `root/scroll-before.png` 与 `root/scroll-reopen.png`、对应 AX；before AX 是增量“无变化”，**不能单独证明像素滚动**，数值来自 root 现场只读几何记录。代理已直接看过两张 PNG，保留原件不覆盖。

根因链（均指冻结 `home-surface.tsx`）：

1. `:193–196` 的 `closeSearch` 正确把 `resultsRef.scrollTop` 存入 S 的 `snapshot.search.resultsScrollTop`，并设 `open=false`。
2. `:293` 条件渲染卸载结果 DOM；`:248` 重开仅设 `open=true`。
3. 唯一把快照滚动写回 DOM 的 `:143–150` 恢复 effect 被 `lastRestore.current === restoreKey` 提前返回。普通关/开不会递增 host 的 `restoreKey`，所以新 DOM 默认 0；存了 UI 值，消费没有发生。

原稿锚点：HP03 `HOME-HP03-B019` 正文 `:130–160` 规定关闭不是清空、详情回原结果位置；已批准 `PRE-DISPATCH-STATE-CONTRACT.md:82–83` 进一步明确“关闭保词与位置”及开启恢复上下文。manual 搜索章 `:370–455`；原图 `search.svg`、`search-detail.svg`、`search-motion.svg`。核心关联 `HV25-07/09`（查询保留也涉及08）。适用门：功能正确性、来源状态链；不是用视觉总分能抵消的偏差。

现有测试缺口：`search-surface.test.tsx:46–67` 重开只断言 query；`:81–108` 把 scrollTop 人工设为 96 后走详情 source action，搜索 DOM 没卸载。两者不覆盖本反例。最小新增 RED 应在**同一次挂载**完成 ready → search → 非零 DOM scroll → close → reopen，保持 restoreKey 不变，断言 query、选中身份、scrollTop 和焦点；另保留详情返回及 ordinary 返回的正例。这里仅建议，未写/运行测试。

### CR02 — 目录读取错误时 Enter 打开未展示的旧候选

**状态：FAIL，root 真实浏览器复现；P1 严重度，错误态动作与可见结果不一致。pending/loading 分支尚未真实操作，单独保留 NOT VERIFIED。**

最小反例：全部市场 ready，搜索 `6` settled 后关闭 → root 受控令 FX 读取返回 503 → 点击 A 股读取失败，旧 all 范围/77 持仓保留 → 打开搜索，结果区只显示“证券目录读取失败，原查询仍保留。”和“重试” → 输入框为 `6`，实际按 Enter → 出现“中国铝业 / HKEX:2600:stock”详情。URL 仍 `market=all`，没有一笔成功的 A 股读取。根证据 `root/enter-error-before.ax.txt/.png`、`root/enter-error-after.ax.txt/.png`；前 AX 明确没有结果按钮，后 AX 明确有中国铝业详情。代理已直接看过截图。root 的中间 PW 按钮操作曾 CDP 超时，不能作为点击成功证明；随后 AX 证实已处于 read error，核心 Enter 前后操作有明确观察。受控代理已由 root 恢复透传；本代理未操作它。

`catalogResults` 的实际来源必须区分清楚：

```
上一笔成功/保留的 homepage.data
  → Workspace:2215 buildHomepageCatalog(homepage.data.entries, homepage.data.storedInstruments)
  → HomeSurface props.catalog
  → surface:100 searchHomepageCatalog(catalog, snapshot.search.query)
  → catalog-model:79–81 对已知目录做 trim/lowercase/includes
```

读取失败保留旧 committed/data 是正确保护行为；没有新的失败响应证券集合。错误区域 `surface:311` 隐藏了结果 DOM，但 `:100` 仍算出旧目录数组，`:309` Enter 只检查 composition、raw query 与 committed query 相等、`catalogResults[0]` 存在，**没有检查 ready/pending/error，也没有以当前实际可选择结果为动作边界**。于是绕过 `:311` 的错误/加载可见状态，直接调用 `openSearchDetail`。不是 decoder 新建了 HKEX 对象，也不是 FX503 响应返回了中国铝业。

原稿锚点：HP03 `:137–160` 搜索阶段、同一面板反馈与按键；manual `:431–435` 读取中禁重复提交、`:446–454` 错误说明/可退出；HP09 `:467–502` latest request、失败旧范围保留与明确错误态。参考 `search--empty.svg` / `search-error-frame.svg` 是**请求错误**，不能按文件名误当无结果；`search--detail.svg` 实为无结果。核心关联 `HV25-08/09/47/48/49`。适用门：功能、跨组件状态安全。

现有测试缺口：搜索 Harness 始终 ready、accountStatus ready，既有 4 个搜索测试没有 rerender 至 loading/error、没有隐藏候选时 Enter。最小 RED 应先有真实旧目录和 settled query，再分别进入 `!ready`、global pending、global error、accountStatus error；确认 region 显示对应状态、没有可见结果按钮，Enter 不开详情/不变 selected/source；ready 成功恢复后 Enter 正常打开。error 分支已有 root 实证；其余是反例计划，不能继承真实 PASS/FAIL。

建议最小修复（仅供 root 授权审阅，本任务未实施）：CR01 在搜索结果 DOM 重新挂载且可恢复时消费**同一 S 已保存的 resultsScrollTop**，只恢复结果滚动，不为普通关/开虚增 host restoreKey 或重放全页来源焦点；输入框打开焦点、详情返回原结果、ordinary 恢复三条路径应各自保留。CR02 将“当前结果可选”的条件用于可见渲染与键盘动作的同一边界，至少覆盖当前 `!ready / pending / global error / accountStatus error` 分支；保留旧 committed/catalog 作为失败保护数据，不以清空目录或改全局范围掩盖问题。不新增状态模型、不重写 catalog/host/S。有限测试矩阵就是两条原始 RED + CR01 的详情/ordinary正例 + CR02 四种隐藏分支及成功恢复、IME/clear 相邻反例；真实 root 原步骤仍需新 SHA 复验。

## 其他有限风险与待核项

| ID | 精确当前路径 / 最小可检验序列 | 已知、推测与真实验证边界 | 规格 / 责任 |
| --- | --- | --- | --- |
| CR03 | `surface:300–306` 搜索 ArrowUp/Down 没有 composition 判断；IME 候选选择时若旧结果仍在，父层可能 `preventDefault` 并移焦。input 无候选不触发。 | 确定条件分支；真实输入法行为 NV。现有 IME 测试只涵盖 debounce，不涵盖候选方向键。先真实 IME，再决定是否需 RED；不把合成 composition 当物理键盘证据。 | HP03:144–160 / manual:431–435；Surface owner。 |
| CR04 | `surface:305` 输入框 ArrowUp 的 current=-1，N≥2 时得到 N-2，而非末项；ArrowDown 得首项。 | 算式确定；规范未明确 ArrowUp 起点，用户预期/真实操作 NV，不签正式缺陷。Home/End 输入框保留编辑含义。 | manual 搜索键盘；root 决定具体可比预期。 |
| CR05 | `surface.css:129` 只对结果区 mount 做 160ms 动画；stage/detail 无对应轨迹，搜索关闭条件卸载。 | 静态动效接线缺口；须正常速度 before/during/after 看图，不能凭 CSS 或 reduced-motion 宣称正常轨迹 FAIL/PASS。 | HP09:503–515，`search-motion-{before,during,after}-frame.svg` / reduced-motion；视觉门。 |
| CR06 | `surface:203–209` 搜索 await onSymbolTrades 的 guard 结果后才关详情；持仓分支先 `setDetailId(null)` 再调用 void onTrades。 | 若真实 leave guard 拒绝，持仓详情可能已关，搜索路径保留。现有测试只验证 callback 与搜索拒绝；持仓实际取消 NV。不是当前两缺陷的根因。 | HP04:312–322 / HP06；共享详情受影响回归，root/P1 owner。 |
| CR07 | 搜索 region `:311` 读取 ui.errors.global/accountStatus；首页 `:254` 还读取 props.error（Workspace 的 route/notice/storage 输入）。 | 不同错误来源的提示分层确实不同；不能仅“搜索缺 notice”推整页 FAIL。storage/route 错误下能否可达搜索、是否需阻止选取，真实 NV。 | HP09 错误状态；集成边界。 |
| CR08 | `:158–164` catalog 对象消失后关详情并焦点回搜索标题；exact holding 缺失回持仓标题。 | 持仓删除有合成回归，搜索目录删除无当前测试/真实证据。不能用最近一条结果替代失效对象。 | HP03/HP04，附录2来源恢复；Surface+fresh catalog。 |

manual `:407` 的 Shift+Tab 回触发器与搜索/详情背景 inert、焦点锁定存在文字张力；本次沿用已批准 P3 契约和 root 已测的 modal 内闭环，不另建键盘政策。manual `:443` “Enter 在输入框触发 X”与其他搜索 Enter 查看定义不一致；清除用显式 X，若要实现无结果 Enter 清除须 root 明确比较依据，不能悄悄加行为。详情主按钮按正文 `:314` 的居中 120×36，保留 root 03:51 的正文优先裁定，不重开原 SVG 左置偏差。

## source-return 与 pending/timeout 的版本边界

搜索、详情 source action、ordinary 返回是三个不同操作：关闭搜索卸载结果；关闭详情只移除上层 dialog；ordinary 返回重读数据后恢复 UI-only snapshot。既有测试不能互相替代。

旧 host `74d765fe` 的 `onUi:193–197` 在导航读取未结束也 persist；`reload:220–223` 的无错误 API 调用是刷新旧 committed。此前独立 6 探针已保留于 `evidence/resume-2026-10-23/P1-state-peer/navigation-reload-race/`，其中：

- 稳定 A 范围出发，ordinary 返回 pending 时硬 reload，NR01/02 保住 A/ROKU；是有效正例。
- **只有 cold /trades 初读失败、committed 仍 default all、来源快照 A、返回 owned read pending**，再发生 onUi，NR04 才证明来源存储被旧 all 覆盖；真实 UI 该组合可达性尚未证明。NR06 是调用 host.reload 的 API 反例，不能冒称浏览器 reload。
- root 原 Recall 返回立即 reload 落 all 的原因仍 OPEN，不能把 NR04/06 或 request-body observer 窗口超时当其根因。
- 本轮 host 已改为 `85731c88…`，所以这些仅是**历史输入及新 host 必须证实的反例**。新逻辑需由 integration 冻结、root 对新 manifest 重验，不从旧 6 探针推新代码 PASS/FAIL。

对 P3 的真实旅程影响：ordinary 返回应在 pending 时保来源 query/scroll/selected/focus 意图，只有新数据成功接受后原子提交；失败/15s timeout 保旧 committed 和来源恢复意图，重试可完成；取消和晚响应不可覆盖新页面/范围。输入、滚动产生的 onUi 也不能把 pending 来源偷偷换成旧 scope。清单为新 host 冻结后的 root 有界检查，本文未测试新代码。

## 既有证据能证明的局部

- `P3/detail-visual-limited/03-surface-interactions-green.log` 与 `ROOT-surface-tests.log`：15 个合成组件测试通过；覆盖 query debounce/IME、metadata-only unknown、detail 外点不关、Esc、精准焦点、原值解释、四 KPI、source action、持仓空态等。它们不是实浏览器覆盖。
- `P3/04-search-surface.log` 是更早 13 测试切片；不以旧数字覆盖后续控件。catalog/session/host 的测试只作相应纯契约/Hook 证据。
- `P3/ROOT-SEARCH-SLICE-CHECKPOINT.md`：root 真实 A 股搜索 ROKU→详情→普通库诚实空→稳定返回→稳定 reload，范围仍 A、query ROKU、完整身份；这是稳定路径，不能证明 pending 中断。
- `P3/detail-visual-limited/ROOT-CHECKPOINT.md`、`ROOT-FREEZE-VERIFICATION.json`：相同 Surface/CSS 下 root 看过 1280×720 CSS / DPR2 的四卡、1020 宽详情、24/32 标题、居中主按钮、两个 Esc、外点不关、Tab/ShiftTab、source action。**该来源滚动是 0**，不能抵消 CR01 的非零滚动 FAIL。
- 新 `root/` 8 份 PNG/AX 仅证明 root 本次两项操作。PNG 是 1280×720 像素；本次 CSS viewport/zoom/DPR 尚未另存元信息，不能拿这个像素尺寸推断断点或继承上轮 DPR。root 消息提供实际操作与滚动数值；本报告如实注明来源。
- 原参考已逐项读图：`reference-readback/sheet-1.png`（search/详情/无结果/错误），`sheet-2.png`（overlay/错误/detail），`sheet-10.png`（正常动效三帧/reduced），均来自精确 SVG；它们不是产品截图。1440×1000、1280×800、390 窄屏、断点两侧、长名称、长数值、正常动效和物理触控仍真实 NV。

## 交接与门槛

最小实浏览器清单、稳定控件登记、输入方式与状态分母见 `ROOT-BROWSER-CHECKLIST.md`。正式最终控件覆盖需要 root 在**同一最终 manifest**填操作结果；本文不把历史片段混为一个覆盖率。此代理执行浏览器数为 0；借用证据中的两项 FAIL 明确保留。全控件/状态总体覆盖、通过率均未计算为产品结论。

| 门槛 | 本次结论 | 依据 / 责任 |
| --- | --- | --- |
| 功能正确性 | FAIL（已测局部）+其余 NOT VERIFIED | root 的 CR01、CR02；owner 等待显式有限修复授权，本文未修。 |
| 端到端状态链 | NOT VERIFIED（已有稳定局部证据） | source return pending/timeout/cancel/新 host、非零滚动普通库来回仍需 root 实测。 |
| 独立视觉 | NOT VERIFIED（已有单视口局部证据） | 没有本轮全部状态/断点同态对照；动效及极值未覆盖。 |
| 业务写入持久化 | NOT APPLICABLE 于此只读文档与无写搜索切片 | 如 root 另测“更新数据”实际持久化，该条件动作须用显式隔离库验证，不能由本 N/A 跳过。 |

没有产品或测试修复，没有启动/停止服务，没有更改原有 FAIL 或其他证据。本文完成的是只读审查，不是 UI 交付或 P3 接受。

## 2026-10-23 04:20 CST 追加更正 — NR04 旧 host 的真实可达性

保留上文初稿及冻结清单作为历史证据。上文“真实 UI 该组合可达性尚未证明”是当时的证据边界，现已被 root 新增的真实浏览器反例补全：`evidence/P1/round3/ROOT-NAVIGATION-RECOVERY-DIAGNOSIS.md`（记录 04:08 CST）证明在旧 host `74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2`，cold ordinary 初读受控 FX503 失败、committed 仍 default all、A 股来源保留后，实际“返回首页选择范围”进入 pending；此时实际打开搜索触发 `onUi`，再实际硬刷新，来源查询丢失，随后重试成功仍是 all/77 且 ROKU 未恢复。因此 **NR04 的这组条件在旧 host 已真实可达且 RED**，不再仅为 Hook/API 构造。

root 原件包括 `navigation-cold-read-failed.*`、`navigation-return-pending.ax.txt`、pending 搜索/硬刷新及后续恢复记录；该诊断文档明确隔离库、3334 故障代理、FX503/20000ms 延迟的受控边界。本代理只读引用，未操作浏览器/代理/数据库。它仍不能证明原 Recall 现象的相同根因，NR06 的 `host.reload` API 反例也仍不等于真实浏览器 reload。新 host `85731c88…` 必须由 root 对其实际冻结版本独立复验，不能继承旧版结论。

本次追加另有显式授权的因果 RED 测试阶段，见 `evidence/P3/search-recovery-fix/RED-REPORT.md`；不回写初稿的只读阶段声明，也不覆盖 `REVIEW-FREEZE.json` 或任何 root 原件。P3 正式仍 0/3。
