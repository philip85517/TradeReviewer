# B01 桌面图表高度与时间轴裁切修复

State: open
Status: ready-for-agent
集成/整页视觉/完整持久化负责人: root
实现 owner: desktop_chart_layout（gpt-6.1-terra / ultra）
独立接受: 非作者 Agent 及 root，待冻结后执行

## 范围与依据

这是 B01 首旅程中的独立布局修复，不接新 journey API，不解除后端独立验收前置，也不扩展三阶段功能。用户授权逐项修复；本次前端布局开发触发 frontend-control-audit.md。只检查日线桌面，触屏、窄屏和小时按用户决定 EXCLUDED。

准确依据：docs/specs/2026-09-25-chart-first-review-ui-elements.md §3、E01/E04/E05/E08/E19、§6；docs/specs/2026-09-25-chart-first-review-ui.md；docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png 和 04-holding-stage.png；V2 批准正文及 source/images/hcr06-final-replay-a1.svg。原 1440×900 画板不冒充 1440×1000 的像素同态，另检查 1280×800；缩放100%、DPR1。原图案、行情及文案样本不同单列，不以此放宽结构。

根因基线见 b01-ui-before-baseline.md 与 b01-ui-before/：两个桌面图表时间轴 canvas 落到 shell 外且被 overflow:hidden 裁切；外层 scrollTop 0→148 可以到按钮，故不是所有滚动均失效。首屏核心动作仍应可达。保留原截图、raw源副本和SHA，不覆盖 FAIL。

## 可观察目标与边界

- 在两个桌面尺寸与参考 1440×900 下，列表→详情→回放后，图表时间轴和底栏核心动作同屏且不被裁切；绘图工具、价格轴、标题、文字入口维持批准尺寸和层级。
- 高度由实际可用布局分配：工具行与图表共同处于栏目预算内；不使用全页缩放、缩字、隐藏主要动作、任意大 max-height 或删 overflow 掩盖根因。
- 对已保存画面、文字入口展开/取消、长标题、加载/错误和 resize 的适用状态检查。仅页面布局，不推进、保存文字或升级数据库；正常打开配对所需 binding 写入登记并核对原始成交未变。
- 不改变旧 RecallWorkspace 的布局或五轮 STOPPED 测试；规则限于 .library-practice-pair-replay。需额外 JSX 改动先向 root 说明，禁止擅改数据/状态和通用 ReplayChart。

## 所有权与验证

只允许修改 app/components/recall/recall.css 中上述限定样式，以及本任务独立证据文件；不改 JS/TS、业务库、现有3426 fixture或默认配置。浏览器用自建临时隔离库/端口，按在线备份生成，不直接 cp 活动库。可使用基线唯一测试库做只读源，但不能读取业务库。

真实浏览器红测已存在，不写只复述CSS的单元测试。先复现并记录 before，再限定修复，记录 after 对应源码内容manifest、DOMRect、滚动、价格/时间轴canvas实际边界、完整截图，打开/关闭文字输入并 resize；鼠标/键盘证据分开。默认超时不增加，不运行 Recall STOPPED 文件或全套。每个同根因连续五轮无进展停止并记录。

报告 b01-desktop-chart-layout-implementation.md 须列触发、控件/状态局部登记和分母、实际操作、功能/状态/视觉三个门槛；作者自测不是独立接受。后续新API接线若改变几何，必须重新验证，不能沿用本次最终SHA。
