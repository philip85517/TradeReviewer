# Task3v root release — RELEASED after A02 scoped acceptance

2026-11-06。root现正式放行以下8文件。A02几何首修有1440真实保存/重开及1280原生入口；独立宽度首修已获113项定向+native8和1280原样真实输入/取消/重开限定接受。root及capital_diagnosis均核实际证据；见task3a-width-repair1-independent-review.md与root-acceptance增量。八份raw-before再次逐字及SHA一致。此放行只启动视觉修复，不代表完整Task3a、整页视觉、V或95%接受；原FAIL保留。

## Contract

root 已完整审阅 `task3v-bounded-visual-brief-draft.md`（SHA256 `b229a2617ccfe97697fecdd3e432d2460249cae8af72ed05bcc7709a0691f4ae`），其原规范、准确图、控件库存、功能/持久化/视觉三层验收要求全部保留，以当前项目 workflow 和用户明确排除优先。正式范围为 E01、E03 现有 Text 部分、E04 容器、E19/E20 以及旧入口接线；完整工具、阶段回看、holding Text、计划、导出、完整 PLAY 不在本片，不能记交付。

参考必须直接阅读/看图：`docs/specs/2026-09-25-chart-first-review-ui.md`、`docs/specs/2026-09-25-chart-first-review-ui-elements.md`，`docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png`、`04-holding-stage.png`；V2 baseline `docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md` BT06 和同baseline的 `images/hcr06-final-replay-a1.svg`、`images/hcr06-final-replay-a2.svg` 提供应用壳/层级，不能把完整历史结果复制进 A/B。映射在功能 `DESIGN-COVERAGE.md` 3V01–05。

1440×900、1280×800，DPR1/100%，记录应用导航状态。标题单行省略且键盘可见完整名；48px 起头部、48px 左侧工具列及底栏、桌面按钮至少36px，空间不足自然换行，不缩字/裁错误/藏入口。保留已可用的真实来源、标的、日线、阶段及权威保存状态；不编造未知字段。B 暂停不得提示能编辑 A。

## Exact ownership and files

唯一实现、整页视觉及完整数据/持久化 owner：journey_ui（实际 gpt-6.1-terra / ultra）；root 独立真实浏览器与隔离库验收；capital_diagnosis 非作者代码和直接同态实图复核。不得自行再派。

仅以下8文件可写；raw before 与 SHA 在 `task3v-before/manifest.json`，开工前逐个复核，不匹配即停报：

- `app/components/library/library-practice-replay-before.tsx`
- `app/components/library/library-practice-replay-before.test.tsx`
- `app/components/recall/recall.css`（仅 `.library-practice-pair-replay` 的作用域）
- `app/components/library/library-practice-entry.tsx`
- `app/components/library/library-practice-entry.css`
- `app/components/library/library-practice-entry.test.tsx`
- `app/components/library/library-practice-browser.tsx`
- `app/components/library/library-practice-browser.test.tsx`

Entry 构造唯一旧入口 ReactNode，继续拥有真实 callback、navigationBlocked、disabled、help/aria-describedby。Browser 按与实际回放相同的 ready + data + practice/version/revision 条件，选择在原位置显示，或传到 replay header；一个渲染分支中只能出现一次。loading/error/缺data/身份失配不丢入口；直接 Browser 消费者无 slot 仍正常。不建立新的镜像可见性状态。保留 replayTrigger/replayRestore 和原返回焦点；移位重挂载需要实际验焦点。不要把 list 已接受的底部入口排版改坏。

page 只调整结构、工具位置和已有权威状态的展示，不改 controller、命令/body、CAS、owner、节流/paint 屏障或图表 props 的语义。Canvas、chart、backend、client、共享全局壳和其他 Recall 消费者冻结。不用新 React key/re-mount 绕过草稿保护。

## Execution and acceptance

先用公开入口最小红测表达现有布局/准确状态/slot guard 根因，再实现。保留红绿原文，定向 page/entry/browser 及必要相邻测试；默认 timeout，不运行 STOPPED Recall 或全套。typecheck、改动文件 ESLint；冻结时提供 raw after、精确 SHA、相对本次 raw before 完整 diff 和报告 `task3v-implementation-report.md`。不以作者绿替代接受。

owner 不打开应用 HTTP/浏览器或任何数据库；root 另行批准实际验收程序。root 执行真实图表鼠标/T、现有 Text 编辑/取消/保存→返回/reload→重开→NEXT 冻结，dirty SAVE→BEGIN、失败/未知重试、长中文多稿复制、pending 可继续编辑。布局影响 chart resize，须用场景绑定实际 painter 和双帧证明 B/C 各至少400ms后 STEP、D 实画屏障，并验证暂停/resize/前后台不隐式推进；V持久化仍 unknown。

非作者直接比较参考与两桌面 A/B 同态实图，保存标题/工具/主图/底栏/错误/复制/pending 测量和控件覆盖表。实际库写链、功能和视觉分别判定，任何本片 FAIL/NV 阻止接受。触屏/窄屏/小时按用户排除，物理 IME 未测如实 NV。不得打开业务库、改变服务配置、推送/合并/发布。相同根因连续五轮无进展记录 STOPPED 并移下一项。
