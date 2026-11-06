# Task3a 整页视觉差异：只读根因与最小方案

状态：设计分析，产品与测试仍冻结；未执行浏览器、HTTP、数据库或测试。既有整页视觉 **FAIL** 保留；本报告不是实现授权、Task3a 接受或 Task3b 放行。唯一 UI、整页一致性和完整持久化 owner 为 journey_ui；root 协调，非作者负责独立同态视觉验收。Task3a 的触屏、窄屏及小时周期按已批准片段排除，不能称 PASS；如后续扩大整页交付，重新按适用工作流登记响应式和触屏范围。V 仍 unknown。

## 依据与比较边界

- 工作流：`docs/agents/development-workflow.md`、`docs/agents/frontend-control-audit.md`、`docs/agents/task-decomposition.md`；验收须版本绑定，实际功能、持久化和非作者同态视觉分别判断。
- 原规范：`docs/specs/2026-09-25-chart-first-review-ui.md` 与 `docs/specs/2026-09-25-chart-first-review-ui-elements.md`，特别是 E01–E22、尺寸/响应式/状态章节。图 `docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png` 与 `04-holding-stage.png` 是 1440×900 的示意参考：图中文字与价格属于示例数据；图上方的说明区不属于实际工作区。示意工作区顶栏 48px，主图左工具区 48px、桌面按钮 36px、底栏至少 48px；02 有 A 侧栏，04 展示持仓图且侧栏收起。不能把示意图的整体外框直接当作应用实测像素坐标。
- V2：`docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md` BT06，以及精确 `source/images/hcr06-final-replay-a1.svg` 和 `hcr06-final-replay-a2.svg`。它们展示应用侧栏、交易库顶栏、浏览导航与图表卡片并存；其样例是完整历史成交状态，含最终交易/结果信息，不是 A/B 的许可数据或同态逐像素目标。图 02/04 提供工作区内部细节，V2 提供应用壳和视觉语言，两者须按当前可知状态共同解释。
- 已有 A 截图 `task3a-save-wins-chart-readback/A-reopened-real-candles-and-two-texts.png`，SHA256 `f09b307f6f52e0811d93868123b28e03367a53ba034c43a6a0321422a59b798f`；已有 B 截图 `b01-ui-task3a-root-cas-begin-wins-resume-safety-corrected/B-return-reload-no-stale-save.png`，SHA256 `583f99d4b6051656e98a66d0fb9738931bc3d930cd644580b0415a479c59c83f`；均在本 evidence 目录，图像 1440×900。它们证明已拍到各自实际页面，不证明 DPR、浏览器缩放或与参考的数据、导航展开状态一致；以下尺寸为读图近似，不是 DOM 实测或最终像素验收。

## 根因及最小边界

| 现象与元素 | 代码根因 | 有界建议及风险 |
| --- | --- | --- |
| 画面顶部依次为应用栏、交易库导航、旧入口行和工作区头；图约从 y291 开始至 y840。与原图的紧凑工作区有明显差异。 | `app/components/library/trade-library.tsx:1266` 附近在练习列表/详情/回放外层持续渲染交易库 header 与 navigation；`trade-library.css:110` 附近分别约 64px、58px。`library-practice-entry.tsx:32` 在外层另渲染“已有交易与复盘”与实际入口，`library-practice-entry.css:1` 的 12px margin 与 36px 按钮形成单独一行。`library-practice-browser.tsx:303` 的列表/详情使用 hidden，非这些分支重复可见。 | V2 本来有应用和交易库导航，保留其操作、信息及 guards；不得笼统删除两层。可提请 root 单独授权把真实旧入口、提示和其 `navigationBlocked`/`aria-describedby` 语义整合到合适的现有可见区域，以消除额外独占行；这是结构及焦点顺序改变，**不是纯 CSS**，不得隐藏入口或绕过保存保护。只调整排版可先限制在当前回放容器，保留原行，不能宣称完整修复。 |
| E01 顶栏并未完整呈现标的、周期、来源、保存状态；长名可能挤压控件。 | `library-practice-replay-before.tsx:188–192` 使用 `practiceTitle || instrumentName || data.instrumentId`，已有 title 时不显示 instrumentName；来源 eyebrow 受共享样式影响。`app/components/recall/recall.css:1713` 特意使 heading 换行、h1 不截断，跟 E01 的长名省略及可查看全名不同。真实保存/错误在底栏状态，不是顶栏。 | 基于已有安全字段显示真实标的、日线、来源和请求状态；长值可省略但可访问完整名称。视觉位置可局部调整；将 E20 变成准确“保存中/已保存/失败/冲突/待确认”需使用真实状态，不能用静态标签冒充，保留 alert、未确认草稿和重试入口。核对 1280 长标题和错误换行不遮挡主动作。 |
| E02 三阶段看似导航但目前全 disabled；B 停止后底栏仍显示“入场前可添加文字”。 | 页面 `:190` 三个按钮无切换 handler，选中态由 `entered` 推导；`:205` 的非播放、非等待 D 分支无条件写该句，B 图已显示错误文案。真实 phase/owner 在 journey，而不是按钮本身。 | 当前阶段可做准确非交互状态展示，disabled 的原因须可感知；纠正 B 的错误提示属于状态文案修复而非单纯 CSS。历史选择/恢复和可操作阶段导航须待后续真实功能，不能上色冒充接线；不要把事实数量当所有 RESTORE 场景的权威阶段。 |
| E03 当前真实 Text 按钮占据图表列上方一行，原图是图左 48px 垂直工具区；完整工具栏缺失。 | 页面 `:195–197` 把普通按钮作为 `.recall-chart-column` 第一个孩子；`recall.css:1729–1745` 显式纵向 flex，为按钮单独占高度。`app/components/chart/drawing-toolbar.tsx` 的共享完整工具栏包含其他实际操作，而本页 `drawingCommand`（`:108` 附近）只接收 A 的 text add/replace。 | 可单独提议把**现有已接线 Text** 放到工作区局部 48px 工具列，保持 `aria-pressed`、disabled、T 快捷键、focus、IME 和命中区；不借用整套工具栏来伪装未接线工具。完整 E03 的选择、线、更多、撤销等须真实数据/命令与可访问性后补；其缺失继续记 FAIL/未交付。改变按钮位置属于结构变化，即便外观为主，也需回归真实交互。 |
| E04 主图高度受上方多层、工具行、状态与底栏共同限制；当前图仍有可观高度，不是完全消失。 | `recall.css:1729` 桌面 `height: calc(100dvh - 170px)` 按当时 64+58+48 外壳硬编码，图列在剩余空间与工具行共享；状态与错误也处在实际流中。 | 可提议在回放专属作用域内整理 flex/间距与主图剩余空间，保留有意义的信息和错误行。若改变外层入口，应同步重新计算剩余空间而不是保留过时的 170px；长标题、告警和草稿可复制 textarea 必须能看见/滚动。不得把“最大化画布”当理由裁掉任何状态。尺寸变化涉及图表 resize、锚点、viewport 和 scene paint，不是纯视觉零风险；V unknown 不得自行声称修复视野恢复。 |
| E19/E20 底栏有真实控件、保存与重试，但与示意图的信息层级和状态位置不同。 | `library-practice-replay-before.tsx:199–205` 将揭示计数、回放/保存、保存或错误、草稿和状态文字放在同一流式区域；部分控件显式 disabled。 | 在不改变命令与屏障的前提下整理顺序、间距与对齐；每个实际 disabled 保留原因，保留错误与复制入口。不能让“上一根/下一决策/留存/播放”的装饰状态看起来已交付，亦不能把保存当继续揭示的通用门槛。 |

## E01–E22 范围及依赖

- **E01/E02/E03/E04/E19/E20**：上表为本次可讨论的工作区视觉及准确状态；E02 可操作导航、E03 完整工具和 E19 全部动作仍有功能依赖。任何修复只能对具体实现和证据给部分结论。
- **E05/E06/E09–E13**：02 的价格轴沟槽、计划线和可开关的事前侧栏依赖真实计划对象、校验、推导及持久化；当前 A 截图缺该侧栏。不能只画空壳、虚构价格/指标或隐藏现有信息来追求视觉一致。待对应计划功能的批准范围。
- **E07/E08/E14**：E07 实际成交须以已揭示事实和显示设置约束；E08 当前限定 A Text，B/C 的 A 历史只读；E14 持仓计划/仓位摘要及持仓 Text 的 owner、暂停与恢复属于后续片。04 的历史与持仓文字不能借复制图像冒充已实现。不同交易的 fact 不能当本配对 owner。
- **E15–E18/E21/E22**：事后评价、导出、历史记录/多快照及其真实选择依赖后续功能。不得显示最终结果给 A/B，不得将 disabled 控件或静态截图称为已交付。
- **V unknown**：视野恢复合同尚未确认；任何会改变尺寸/视口的视觉改动都需记录实际结果并保留 unknown，不能以双 rAF 或截图本身证明 viewport 恢复。

## 如 root 决策实施的最小顺序与文件假设

1. 在新授权及冻结清单下保留本报告引用的原图和旧 FAIL；先记录实际版本、参考状态、应用导航展开状态与 1440×900、1280×800 的 CSS viewport/DPR/缩放。若只做纯排版，预计 `app/components/recall/recall.css` 的 `.library-practice-pair-replay` 限定规则；不得修改共享 Recall 的其他消费者。
2. 若要解决额外旧入口行、工作区头或实际工具布局，需 root 明确扩大至 `app/components/library/library-practice-entry.tsx` / `.css`、`app/components/library/library-practice-replay-before.tsx` 及受影响的对应测试；如需跨父子放置入口再明确 `library-practice-browser.tsx` / `trade-library.tsx` 的精确最小接线与测试，不能默认扩大。保留实际回调、阻断说明、返回焦点、草稿和所有现有信息。应用壳及已冻结后端/Canvas/图表不因本方案自动解冻。
3. 正确状态文案与必要的可访问状态从现有权威状态接入；不更改 SAVE/BEGIN、未知结果原命令重试、冲突处理或 owner。适配新布局时保持 T、Text 点击、输入/IME、NEXT 编辑阻断、SAVE→BEGIN 串行，及重开后的 A 文字锚点。
4. 图表尺寸变更须用真实 painter 验证新 scene 的实际绘制、双帧与 B/C 完整 400ms 屏障和 D 绘制屏障；`chartBox` 还供 controller 前台可见性/尺寸资格检查。不能仅断言 CSS 或两帧。检查主图平移/缩放、既有 Text、返回/reload、暂停和 resize 不丢场景或泄露未来数据。
5. 对实际更改执行有区分度的默认超时定向测试、typecheck/lint；独立私库真实写入验证 A 输入保存→返回→reload→NEXT、持仓暂停及出错/重试；由非作者在相同状态和可比视口直接比较 02/04、V2 与实际截图，列出每个控制的状态与证据。物理 IME/触屏及未获授权范围照实记 NOT VERIFIED/排除。功能、真实持久化、视觉分别报告；原 FAIL 只能以版本绑定证据关闭。

本次仅离线读文档、代码和已存在截图；未检查在线服务、数据库或实际本次交互，故所有拟议变更和后续验收均未实施。
