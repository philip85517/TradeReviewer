# 复盘工作区自由 Text：轻量候选与复核

> **2026-11-06 用户取舍：** 标注由用户自行放置，影响阅读时自行调整文字控件的范围；不再为文字之间或文字与成交标记的重叠设计专门的自动避让，也不要求同点文字同时可读。以下 2026-11-05 判定及截图作为历史证据保留，重叠本身不再构成当前验收失败；候选的其他功能、视觉和整体通过情况仍须单独核验。v5 仍为隔离试验，未并入正式原型或视觉规范。

## 结论与范围

用户要求持仓期间由交易者在图上自由放 Text，买入/平仓标记则跟对应成交 Bar 绑定；右栏不增加持仓记录。本次针对问题 17 的图上文字进行隔离探索和局部复核，不改变业务页面和正式视觉规范。原 3091 预览仍为 candidate-45；3098 是尚待审阅的 v5 试验。用户之前没有要求把完全重合的文字强制避让，之前问到的“多条同点”是人工构造的边界测试。

原方案把一般文字做成带大卡片、锚环与长引线的注释，使图表中的价格、成交标记和文字关系难以辨认；多轮避让又引入了新的遮挡和复杂度。TradingView 官方 [Text](https://www.tradingview.com/support/solutions/43000516983-text-drawing-tool/) 说明文字贴在图表点、随图移动，可在图上编辑；[Price Note](https://www.tradingview.com/support/solutions/43000791741-price-note-drawing-tool/) 是另一个带价格线的工具。二者不证明本候选的弹框、图标、重叠处理或全部行为与 TradingView 1:1。

v5 在确认态直接呈现图上文字，去除常驻大卡、锚环及长引线；编辑时使用较小的浮动输入框。真实锚点仍是时间与价格；绘制模式让已放文字不拦截下一次图表点击。浮动编辑框并非 TradingView 原样；拖动语义尚无足够参考证据。按 2026-11-05 当时标准，该候选未达到整体功能及视觉放行条件；当前范围以本页顶部的用户取舍为准，其他整体验收仍待核验。

## 冻结条件

- 版本：隔离 [v5 九项内容清单](../candidate-20261105-direct-text-v5/manifest.json)，`workspace.js` SHA-256 `f18728ad337822e765b9c67d3e7c85125d2ae73918f9f2e934a14e1ed47de54b`；v5 相对 v4 仅增加进入编辑态的提示。2026-11-05 10:25 CST 已核对 3098 HTTP 响应九项与冻结清单一致。3091 `workspace.js` 仍为 `0504ece60a3f04fc27f78ab13db3f44a8bcfe0ee930bb56a6bcb08be06ff9ca2`。
- 服务：在仓库根目录运行 `python3 -m http.server 3098 --bind 127.0.0.1 --directory .scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-04-direct-text-stage`；地址 `http://127.0.0.1:3098/workspace-v0.1/index.html?variant=A&scene=holding`。Chrome 156 headless 通过 CDP 实际鼠标及模拟键盘操作，非 DOM click/handler 模拟；复核快照不等于物理键盘或触屏。
- 数据：合成行情、持仓 31 根；文字存在页面内存，刷新会重置；无业务数据库及跨会话保存。本次仅分析设计原型，不排除此前 3091 台账中任何适用项。
- 视口：普通分散样本 1440×900 CSS、DPR 1；同点边界样本 1200×569 CSS、DPR 2。截图像素与 CSS 尺寸分开；其他窗口及断点没有据此通过。v5 同点采样在两侧栏收起条件下复现。
- 独立职责：隔离候选实现者未做视觉验收；协调者执行浏览器路径；非实现者做截图对照，证据与限制见 [独立静态复核](INDEPENDENT-VISUAL.md)。独立浏览器交互仍 NOT VERIFIED。

## 候选局部旅程台账

下表保留 2026-11-05 的局部样本和当时评价，不是整页控件全集；重叠专项已按本页顶部的 2026-11-06 用户取舍排除。现行 3091 的 40 组清单见 [candidate-45 台账](../task-final-candidate45/ACCEPTANCE.md)，不能把它的通过转移到 v5。

| 控件/旅程 | 条件与真实操作 | 实际与状态 | 证据 |
| --- | --- | --- | --- |
| D02 / I13、I15：放置与确认 | 1440×900，两次鼠标选 T 后点图，输入内容，以模拟 Tab/Enter 确认 | 产生两条分散文字；限定路径 **PASS** | [普通路径观察](coord-normal-v5/observations.json)、[确认画面](coord-normal-v5/量能不足，暂不行动-confirmed.png) |
| I16：再次放置不误编辑第一条 | 1200×569，同一买入标记位置两次选 T、点图并确认 | 创建 A、B 两个对象，ARIA 均为 2025-02-03 · 48.00，限定路径 **PASS**；v2 曾错误追加到 A，保留 [v2 证据](coord-same-point-v2/observations.json) | [v5 观察](coord-same-point-v5/observations.json) |
| I17：第二条取消 | 鼠标打开 B，输入后取消 | 观察到编辑前后 A、B 均保留，限定路径 **PASS** | [取消前](coord-same-point-v5/edit-second-before-cancel.png)、[取消后](coord-same-point-v5/edit-second-cancel.png) |
| I18：选中被覆盖的 A | 在 B 确认并获焦后，模拟 Shift+Tab 到 A，Enter 打开，随后取消；另用鼠标打开 B | 该指定键盘路径可打开 A 且输入框显示 A；鼠标可打开 B，限定 **PASS**。A 的鼠标选择、触屏、读屏和一般可发现性仍 **NOT VERIFIED** | [键盘序列与截图](coord-same-point-v5-keyboard/observations.json)、[键盘打开 A](coord-same-point-v5-keyboard/keyboard-edit-first.png) |
| I19：回看截止 | 日期从 31 根回到 28 根，再回到 31 根 | 指定样本中 A/B 随回看先隐藏再重新显示，限定 **PASS**；不外推跨回合或全部播放状态 | [观察记录](coord-same-point-v5/observations.json) |
| I19：平移与价格轴缩放 | 1440×900，命中画布路径后真实鼠标拖动 | 可见范围与文字位置随操作变化；限定 **PASS**。该采样不证明所有文字锚点精度、手势或状态 | [命中与观察](coord-normal-v5/observations.json)、[平移后](coord-normal-v5/after-pan.png)、[缩放后](coord-normal-v5/after-price-axis-drag.png) |
| I16：归属与重叠的视觉 | 1200×569 同点、1440×900 价格轴边缘 | 被覆盖的文字在确认态无法从截图辨认；自由文字与成交箭头/标签仍可能被看作一组，**FAIL**。普通样本中有文字因边缘限制显示在相邻买入标记附近；不能证明它属于该交易 | [v5 确认态](coord-same-point-v5/buy-conflict-B-confirmed.png)、[普通样本](coord-normal-v5/量能不足，暂不行动-confirmed.png)、[独立复核](INDEPENDENT-VISUAL.md) |
| 编辑提示 | 已确认 B 再打开编辑，非实现者对照 v4/v5 | v4 提示错误；v5 提示与编辑状态一致，局部 **PASS** | [独立复核](INDEPENDENT-VISUAL.md) |
| 整体功能、状态链及视觉 | 全场景、断点、真实浏览器独立实操及产品业务链 | **NOT VERIFIED / 视觉 FAIL**。原型无业务数据库写入；真实保存、返回与 reload 不适用这个内存试验，不能冒充业务验收 | 本报告及 [candidate-45 台账](../task-final-candidate45/ACCEPTANCE.md) |

`node --check` 通过；以上两条 v5 浏览器脚本记录的异常列表为空。截图、状态数和一个用户路径均不能替代其余路径；v4 的观察不会自动转嫁 v5。需额外复验：A 的鼠标选取、编辑期间回放推进与截止的状态契约、输入法组合态 Escape、长文字、越界、入场/结束、更多视口和触摸；部分项目目前仅有源码风险提示，并未实证为 bug。

## 历史记录与后续

旧 3091 candidate-45 的大卡片/引线问题和 33 PASS、1 FAIL、2 NOT VERIFIED、4 N/A 的局部台账仍按原版本保存。v2 有二次放置误编辑，v3/v4 用放置模式穿透修复了本次采样路径；v4 编辑态提示错误，v5 已修补该单项。各版 [冻结清单](../candidate-20261105-direct-text-v4/manifest.json)和图像独立保存，不能互相抵销。

2026-11-06 更新：不再专门推进重合对象选择或自动避让。普通自由文字的人工调整能力及基本状态链仍需按相应版本核查，见[本轮限定检查](coord-manual-check-20261106-v2/REPORT.md)。最终方案需要跨状态回归、非实现者独立视觉对照与用户审阅后，才可回填正式 V1.0 规范。
