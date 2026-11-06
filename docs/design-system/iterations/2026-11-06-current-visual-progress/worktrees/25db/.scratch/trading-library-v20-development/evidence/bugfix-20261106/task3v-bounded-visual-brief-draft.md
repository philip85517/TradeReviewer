# Task3v 有界视觉修复 brief（草案，未放行）

状态：仅供 root 审阅；当前 Task3a 五文件冻结，A02 existing Text 原失败仍在独立查证，Task3b 未放行。不得据本文开始产品或测试修改。开工前须由 root 明确放行并确认已接受的精确基线；若 A02 修复改变基线，基于新接受版本重新保存原文与 SHA，不覆盖既有证据。原整页视觉 FAIL 和 V unknown 保留。唯一 UI、整页一致性及持久化 owner 为 journey_ui；root 协调，非作者独立验收。此片不代表 E03 全工具、历史、holding 或 B01 全部交付。

## 依据、参考与范围

- `docs/specs/2026-09-25-chart-first-review-ui-elements.md:44–65,85–88,92,103–104,108–115,118–133,135–143`：E01 48px 起紧凑头、长名省略且可看全名，E03 48px 工具区与 36px 桌面按钮，E04 可知行情和既有平移缩放，E08 锚点和编辑，E19 底栏、E20 来自真实请求的状态，以及保存中允许继续本地编辑、失败保留草稿。`docs/specs/2026-09-25-chart-first-review-ui.md:45–56,73–74,100–110,164–181`：主要旅程、紧凑布局和持久化边界。不能因排版新增保存/留存门槛或显示未来数据。
- 直接查看原参考 `docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png`、`04-holding-stage.png`；比较工作区同阶段、可知范围与相同导航状态，示例内容与外部说明框不当成真实用户数据/产品栏。V2 `docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md:54–61,144,164–166,248–275,361–377` 与同目录 `images/hcr06-final-replay-a1.svg`、`hcr06-final-replay-a2.svg` 确认既有应用壳、交易库导航、练习/配对身份和逐层返回；a1/a2 是完整历史样例，不可将未来成交和结果复制到 A/B。
- 目标桌面 CSS viewport 1440×900、1280×800，记录 DPR、缩放、实际应用侧栏及工作区状态。02/04 的参考分辨率不是对真实容器尺寸的测量；以实际截图与布局检查验证层级。Task3a 已批准片段排除窄屏、物理触屏和小时周期；均不标 PASS，扩大交付须重新纳入对应标准。
- 现有依据：`E/task3a-whole-page-visual-root-cause-and-minimal-plan.md`、根真实 A/B 图、独立 FAIL 和 `E/task3a-freeze/manifest.json`（历史 Task3a 五文件清单 SHA256 `82e86bbf079131f5b790dc62dbc1bee0b4f3bce0470201da69e38e722463fc49`，不自动作为将来的开工基线）。E 为 `.scratch/trading-library-v20-development/evidence/bugfix-20261106`。

## 可实施范围和用户旅程

1. **E01 工作区头**：保留应用壳和交易库模式/列表导航；工作区内以 48px 起的紧凑头组织真实练习身份、可用的标的/代码、日线、真实来源、当前阶段、真实保存状态与返回详情。标题长中文单行省略，同时完整值可通过可访问名称与可见/键盘可达的方式查看；不得把用户身份或标的静默藏掉。36px 以上桌面按钮，必要时自然换行而不盖主动作。真实不可得的字段不编造。阶段沿用现有禁用及说明，不伪造历史跳转。
2. **E03 本片仅现有 Text**：将当前已接线 `文字标注` 从图上方的普通行移到主图左侧约 48px 工具列，保留明确名称、title、`aria-pressed`、禁用原因、焦点、T/t、图上实际定位与现有编辑状态。其他画图工具暂不展示成可操作或假装接线；完整 E03 保持未交付。不可通过更改 Canvas 或 chart 偷渡额外绘图能力。
3. **E19/E20 状态与可达性**：底栏维持可达、可阅读、必要时换行；从现有权威生命周期表达保存中、已保存、失败、冲突、待确认等实际存在的状态，不用静态“已保存”掩盖 pending。错误保持 alert、实际重试/重读和全部未确认草稿复制入口；保存中仍可本地继续编辑。修复 B 暂停时误显示“入场前可添加文字”：按权威当前状态给准确可用提示，不能暗示 B 可以编辑。未知结果不得丢原命令或自动发新写；不同阶段禁止泄露未来信息。
4. **旧入口独占行**：允许把真实“查看已有交易与复盘”入口整合到现有可见区域；保留说明、真实 callback、原 `navigationBlocked`、disabled、可访问帮助和工作区返回焦点。禁止仅隐藏按钮、删应用壳/导航或解除 guard；list/detail/replay 三态入口完整且不出现两份同名可操作入口。若可通过局部布局实现而无需接线，优先最少文件；若跨组件须使用现有所有权传递，不引入新的数据权威。
5. 固定功能边界：不实现 holding Text、历史 SELECT/RESTORE/NEXT_DECISION、完整 PLAY、完整工具、计划侧栏或导出。其他 disabled 的控件保留真实原因，不以图标/样式表演已交付；E02 当前阶段指示可准确显示但不能据此宣称阶段可回看。

## 条件性最小文件白名单（需 root 最终批准）

- `app/components/library/library-practice-replay-before.tsx` 与 `library-practice-replay-before.test.tsx`：真实工具位置、头部与 E20/B 状态文案，以及对应公开入口测试；只调整表现和必需状态选择，不改 journey 命令/owner/写入时序。
- `app/components/recall/recall.css`：只用 `.library-practice-pair-replay` 等回放专属选择器整理尺寸、flex 和状态溢出；其他 Recall 消费者不得被波及。当前桌面 `calc(100dvh - 170px)` 与额外旧入口行耦合，若外壳实际占高改变需修正布局依据；不得裁掉错误、长文本或复制区域。
- `app/components/library/library-practice-entry.tsx`、`library-practice-entry.css`、`library-practice-entry.test.tsx`：仅旧入口位置/保留真实 guard 与说明的必要改动和测试，未涉及则不改。
- `app/components/library/library-practice-browser.tsx`、`library-practice-browser.test.tsx`：仅在旧入口跨组件传递确有必要时允许精准接线及回归；保留 hidden detail、`replayTrigger`/`replayRestore` 焦点，以及练习、版本和配对身份。无需则不改。若需要新增文件或修改其他路径，先报告 root 扩权。
- 不修改 controller、client、backend、DrawingCanvas、chart、全局 trade-library 壳、配置或 Recall workspace 测试；不运行 STOPPED Recall 或全套。不可触及业务库。明确禁止利用隐藏、重新挂载或更改命令时序绕过现有状态。

## 控件库存和每项验收证据

| 元素/旅程（owner：journey_ui） | 实际状态和必须保留的验证 | 独立验收证据 |
| --- | --- | --- |
| 应用侧栏、交易库模式/列表导航、旧交易复盘入口、返回详情 | 可见及键盘顺序、真实目标、保存/重读未完成时 guard 和帮助、重开后的原触发焦点 | A 已保存与 dirty/失败两种状态实际鼠标/键盘；练习身份与列表/详情返回一致 |
| 头部标的/练习名、来源、日线、阶段 | 长中文截断且可取得全名；准确阶段与未来边界；阶段按钮真实 disabled | 1440/1280 同态截图与焦点/可访问名称；A、B 各状态 |
| Text、T/t、主图锚定、编辑完成/取消 | 真实左栏、按键、点击图、中文和换行；编辑中 NEXT 不推进，完成后 dirty NEXT 串行 SAVE→BEGIN | 实际 Chrome 主图输入和重开、既有文本重新编辑；合成 IME 与物理 IME 分开记录，物理未测记 NV |
| NEXT、暂停/播放、上一根、下一决策、留存 | 对每个实际可用/disabled 分别核对行为和原因；不扩大功能、无快捷键误推进 | 真正公开动作和时间戳、当前画面及命令；未实现记 NOT DELIVERED |
| 保存、状态、重试、重读、复制、放弃 | pending/成功/失败/冲突真实关联；保存时可继续编辑；多份未确认文字可复制，未知命令保同 body | 隔离库真实写入、错误/竞争与原命令记录；长中文错误、复制 textarea 在两尺寸均可达、不截断 |
| 图表、成交可知范围与原 A 文字 | 实际 K 线/标记与状态一致，平移缩放保留；不显示未来，resize 不自行推进或 fitContent | A→B→C→D 实际画布图和数据时间；保存→返回/reload→重开→BEGIN 冻结历史文字 |

## 顺序、证据与验收门槛

1. root 放行后确认 A02 状态及新的精确基线；为所有实际将改文件保存 raw before/SHA。先添加最小公开入口红测，覆盖现有可证实的布局/状态或 guard 缺陷；按单一根因修复，保留首红、绿日志和原失败。状态、复制或保护变化补有区分度的必要测试，不复制既有同义测试。
2. 在隔离测试环境运行受影响 page/entry/browser 的定向测试及必要相邻测试、typecheck、实际改动文件 lint，默认 timeout；不跑全套或 STOPPED。保存准确命令、退出状态、raw after、before/after SHA、完整本片 diff 和 manifest；不以测试取代浏览器。
3. 图表容器宽高变化会触发真实画布重绘和 scene 资格变化：实际 Chrome 测 A→B→C→D，记录与场景绑定的真实 painter receipt、浏览器双帧后 B/C 各完整至少 400ms 到实际 STEP，D 真图双帧后才允许下一动作；覆盖 resize、前后台及暂停不误推进。V 仍 unknown；此项不声称视野恢复合同已解决。
4. 用**隔离库**验证实际 T/现有文字编辑、保存、返回详情、reload、重新打开、NEXT 冻结 A，及 dirty SAVE→BEGIN、保存失败/重试和长中文多草稿复制；逐项标鼠标、键盘、模拟 IME/物理 IME，不能把回调/HTTP 代替持久化。防止其他 owner 文本污染、未来 K/成交泄露，保留 Task2 暂停和未知命令安全。
5. 非作者直接比较 02/04 与实际 A/B，结合 V2 a1/a2 的共同应用壳；1440×900 和 1280×800 均记录完整截图、导航状态和版本。额外包括长中文标题、失败 alert、多草稿复制、正在保存及 B 暂停，检查工具、状态、主图及底栏可达，无遮挡或裁切。列控件清单、覆盖表、差异与缺项；功能、状态/持久化、整页视觉分别 PASS/FAIL/NOT VERIFIED。原视觉 FAIL 只有版本绑定的独立实际视觉证据才可关闭；不能把尚未交付的功能/画面记 PASS。

此草案无新批准的产品政策；具体布局方案和精确文件由 root 审阅并放行后执行。当前无本片测试、产品变更或验收证据。
