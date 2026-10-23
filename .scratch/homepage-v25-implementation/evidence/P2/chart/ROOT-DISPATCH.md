# P2 日曲线受控 leaf：有限提前实施

当前用户明确要求 GPT6.1 SOL / ultra 并行推进。root 仅调整可独立撤回的新文件准备顺序：允许图表消费冻结 B 的数据类型进行受控渲染，不释放 A 性能门、P2 页面接线或 P4 财务。P2 正式0/3；原 FAIL/NV 与轮数保持。root 已阅读 HP02 正文及手册，直接查看 chart-hover/gap/keyboard 和本目录五张原 SVG 渲染；图板不是浏览器 viewport，正文更新约束优先于旧图中的固定高度、缩写金额及默认圆点。

实现 owner `/root/daily_chart`，实际 `gpt-6.1-sol / ultra`。root 唯一拥有整页视觉、完整数据流和独立接受。只准新建 `app/components/homepage-v25/performance-chart.tsx`、`.css`、`.test.tsx` 与本 evidence 子树。禁止 Surface/host/Workspace/F/S/B、现有控件、依赖、全局样式、配置、服务、浏览器、网络、数据库、子代理、commit；不得自行接入首页。

## 精确来源与映射

|需求/元素|准确规格与原图（baseline source/）|旅程/必需反例|owner、组件与证据|
|---|---|---|---|
|HV25-19，HOME-HP02-B030；无原 elementID|visual-design.candidate.md:223–248；images/chart-hover.svg / chart-hover--keyboard.svg；component-manual.html:872–959 / images/atom-charttooltip.svg|单线2px/点6px仅hover或focus；六字段同序；鼠标300ms/离开100ms；键盘立即、方向有效相邻、Home/End、Enter固定、Esc关闭且重入才显示；禁止日期敞口入口|daily_chart 实现，root独立鼠标/键盘/视觉；本目录 RED/GREEN、CONTROL-STATE-MAP、manifest、报告|
|HV25-20，HOME-HP02-B030|同正文；images/chart-gap.svg、chart-scale--wide.svg / chart-scale--extreme.svg|真零与未知、内部/首尾缺口、未来灰区与截止边界；不插值/制造点/最新替历史；缺口原因可Tab，无重试|同上；实际数据与 synthetic caller 明确区分|
|HV25-21/22，HOME-HP02-B030|正文225–248；images/chart-scale.svg / chart-scale--normal.svg；manual:872–959|最多7金额刻度、12/16字体、币种、万亿两位；tooltip完整千分位/精度及来源，264宽自然高度pad≥12完整末行；左右上下边缘和390可读|同上；1440/1280/390及尺寸边界真实浏览器由root后续比较|

## 最小接口与设计约束

开始写产品前，在本目录登记明确 props、状态与布局合同，不另造财务 authority。首选只读 `HomepageV25SeriesBundle` + 明确报告币种；从 `HomepageV25BoundaryPoint` 读六金额和 evidence，不计算金额或重新投影。若加载/错误不由 B 的 point state 表达，可接收明确的受控加载/原因 props；不能隐藏旧成功值冒充新点。采用现有纯金额格式化约定，保留原始 decimal 字串；几何数值转换仅用于坐标，不能回写金额。不得读时钟、fetch、storage 或调用 A/B builder。

六行顺序：当日市值、当日浮盈、累计已实现、累计净盈亏、期间净盈亏、期间费用；历史数据不能以 current 替代。日期/说明12次要色，市值12正文色；盈亏按正负/零独立着色，期间13；费用中性。正常行情/FX不常显成功勾选。异常表头16说明入口，具体原因 hover/focus 可读，缺失“—”。264px tooltip 自然高度，pad≥12，边缘避让且不遮主要曲线；严重长文本不可裁切或缩字。图卡以原稿1020×320比例、首尾留白/金额轴为基线，实际宽度响应容器。记录窄屏尺寸策略，禁止用缩放整图把12px文字缩小。

先定义可演示的受控单线→键盘点选→真实零→缺口/未来→长tooltip的完整叶级旅程。重用既有 SVG/图标惯例；不要引新图表库。完整控件与八态登记（禁用不渲染需有依据），包括每个数据驱动点/缺口原因的实例计数规则；鼠标、键盘、模拟及物理触控证据分开。所有页面金融原子更新、贡献、导航/持久化仍 NV；无业务写入的 leaf DB 门为N/A且说明原因。

## 实施与接受

先最小 RED，再单一候选 GREEN；独立字面数据覆盖正负零、极值、稀疏/无有效点、内部及首尾缺口、未来点、六金额与异常原因、loading/error不展示旧值、键盘及定时取消，不能只测 path 存在。只跑新测试、严格 scoped type/lint，不跑全量/性能，不占浏览器。保存命令/退出码/真实失败；冻结3文件SHA后停写，交root直接审查及真实浏览器比较。leaf最多3轮；第3轮仍FAIL/必需NV暂停同任务，不能改名重置。worker pass 不等于接受。
