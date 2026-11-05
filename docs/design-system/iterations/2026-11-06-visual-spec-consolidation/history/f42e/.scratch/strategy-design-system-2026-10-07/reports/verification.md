# 验证记录

## 自动验证

2026-10-07，root 在当前 worktree 执行：

```sh
npm run typecheck
npx vitest run app/components/chart/drawing-canvas.test.tsx app/components/chart/drawing-canvas.recall-review.test.tsx app/components/chart/replay-chart.test.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/recall/recall-workspace.test.tsx app/components/recall/recall-integration.recall-review.test.tsx
```

结果：typecheck PASS；6 个文件、180 项测试 PASS，退出码0，43.57秒。该轮在最终全文阅读区与布局校准前执行；最终源码需另行复核。测试用于默认路径回归，不证明样板画面、真实回放或数据库持久化。

## 原始数据保护

`execution-protection-before.json` 与 `execution-protection-after.json` 记录共享库和隔离副本。root 使用只读 SQLite connection 读取表，按确定排序计算全部行 JSON 的 SHA256。四张原成交/关联表前后均 MATCH：

- executions：1866行，`5079f3f5afa4e56192efcc52d3773a0ad02b4377eb010c1fd0b9ff6348a33bf6`。
- recall_evaluation_executions、recall_manual_evaluation_executions、recall_manual_evaluation_association_executions：均0行，`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`。

正式组件实测运行服务已显式设置隔离库。原生样板 repository 不调用网络/SQLite；仅本会话保存，刷新重置。上述核对不宣称业务库每张表都未变化，仅覆盖原成交与关联保护范围。

## 证据可信度

所有 `baseline-s0-*` 和最终推荐截图均采用同一完整合成 fixture、1D、S0截止2024-02-11 15:00 Asia/Shanghai、成交未揭示、DPR1。`current-native-*` 是实际空计划状态，用于现状诊断，不能作为固定 fixture 对比图。

`recommended-checkpoint-layout-fail.jpg` 是真实失败画面，保留作为旧 flex/grid 高度覆盖冲突证据；不作为最终推荐稿。热更新期间状态会重置，最终浏览器验收必须从冷刷新重新执行，不把热更新中的旧 session 当成最终保存证明。

字体集合 loaded、computed 字体链与图表API显式配置分别记录；当前能力未提供逐汉字实际渲染字体，glyph验收仍 NOT VERIFIED。

## 收尾验证与证据边界

- root第二轮默认路径回归：6文件180测试PASS，44.20秒；`final-regression.log`。在全文阅读区和主要布局接入后、externalOHLC提取前运行。
- externalOHLC opt-in提取后，root复跑ReplayChart两个文件43测试PASS，5.20秒；`final-readout-regression.log`。这是180项中的相关子集，不能相加成223个不同测试。
- 最后CSS/Space修复由实现者运行typecheck/diff-check；root最终独立命令另见`final-typecheck.log`。
- 实际 normal主按钮、输入边界、正文/标签、选中和focus均有computed记录；hover/active及coarse44仅源码规则和颜色计算，未冒充真实鼠标状态或触控验证。
- body推荐限定overflow:auto后，root实际wheel从scrollY0到516到达S1全文末段和回放；Tab焦点截图是键盘证据，分别记录。
- S1展开全文的legacy fullPage捕获曾使受控details折叠，原因未确认；最终S1采用原生viewport截图，已验证open=true及全部五段原文/三段补充。该工具差异不算正式功能已通过或失败。
- 原始数据保护四表证据保留；正式SQLite写入/返回/刷新链、真实回测/导出不属于这次视觉样板的实现与验收范围，正式功能仍NOT VERIFIED。

整体及最新More状态结果，以FINAL-ACCEPTANCE为准；历史FAIL图不删除。

最终CSS冻结后root独立运行`npm run typecheck`，exit0；`final-typecheck.log`。`git diff --check` exit0。未因纯CSS再次重复180项，回归范围与43项子集关系仍如上。`lsof -nP -iTCP:3064 -sTCP:LISTEN`确认node PID37559监听127.0.0.1:3064；同时在真实浏览器冷刷新最终1440/1280推荐页面并检查图表与内容，未用LISTEN或HTTP代替UI证据。
