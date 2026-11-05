# Candidate-45 independent static visual review

## Scope and evidence freeze

这是对已合入 `task-final-candidate45` 证据的只读、非实现者视觉复核。未运行浏览器或 CDP，未修改原型源码、业务文件、规范或数据库；以下结论只来自截图及同目录的观察记录，不能把截图当作独立交互、鼠标/键盘、持久化或状态链通过证明。

对照合同为 issue 17 / R03（自由 Text 保留在图上；买入、加仓、减仓、退出标记绑定交易 Bar；不得新增持仓右栏 Text 记录；不得改变用户选择的真实时间/价格锚点）。同态比较基线明确为 frozen candidate-31 的 `task-final-candidate31/text/`，不是旧 `review-fixes` 中的 v31。Candidate-45 的文本截图是 3091 Chrome 证据；其观察记录给出 1200×569 CSS 视口、图表 `1062×296 CSS px`。候选 45 不是 candidate-44 隔离试验，因此不把 candidate-44 的 T4/T5/T6 金色身份徽记改善计入本轮。

## 截图逐项复核

| Candidate-45 证据 | 可见事实 | 结论 |
|---|---|---|
| `text/buy-conflict-A-confirmed.png`；`text/observations.json` 的 `buy-conflict-A-confirmed` | Text 卡片文字可读，`首次买入` 箭头/标签也可读。观察记录中买入 marker 的中心约为 `(956.10,322.85)`，Text anchor 为 `(952.09..960.09,318..326)`；两者是同一图上位置，A 的 leader 只向 marker 旁边短接。卡片覆盖右侧若干 K 线/网格。 | **PASS（局部）**：单条文案、交易标签和工具栏均可见。**FAIL（issue 17 视觉身份/遮挡）**：没有独立可辨的 Text 身份端点，锚点与真实成交 marker 视觉合并，卡片遮住行情。 |
| `text/buy-conflict-B-confirmed.png`；同一观察记录的 `buy-conflict-B-confirmed` | A/B 两张卡片的标题和同一 `2025-02-03 · 48.00` 均可读；两个 anchor 均落在与买入 marker 相同的 `(956.10,322.85)` 附近。B 的 leader 从同一锚点折向左下再回到卡片；截图中的长浅蓝路径经过买入箭头/标签邻域。 | **FAIL**：同点多 Text 可以读标题，但不能立即区分各自与交易箭头的绑定关系；路径形态会被理解为交易标记的连线。两卡及路径同时占用行情区，遮挡 K 线/价格线。 |
| `text/edit-second-before-cancel.png` | B 编辑器为大块输入卡，显示 `确认/取消`；其 leader 从图上同一锚点延伸至编辑器，覆盖大量绘图区；A 卡及买入标记仍在右侧。 | **FAIL（视觉密度/可读性）**：编辑态可见控件，但编辑器和连线侵入行情区，不能据此认为短窗口中图表与 marker 关系清晰。 |
| `text/edit-second-cancel.png` | 取消后的静态帧可见编辑器消失/回到已确认内容。 | **PASS（局部静态结果）**；**NOT VERIFIED**：截图不能证明真实 Escape/鼠标取消路径、状态回滚持久化或再次加载。 |
| `text/pan-after.png` | 平移后 A/B 卡仍可见，买入箭头/标签仍可见；观察记录显示 marker 与两个 anchor 仍处于同一可视位置关系，卡片和 leader 改变屏幕位置。 | **FAIL（静态布局）**：两 Text 与交易身份仍未分离。**NOT VERIFIED**：不能由该帧证明 `anchor.time/price` 保持不变、平移后的点击命中或重新渲染一致。 |
| `text/price-zoom-after.png` | 价格缩放后两卡、买入 marker/标签和工具栏仍显示；两 anchor 仍同点，卡片继续覆盖绘图区。 | **FAIL（静态布局）**：缩放没有解决身份/遮挡。**NOT VERIFIED**：不能证明真实价格锚点不被变换改写，也没有覆盖边缘/超长文本。 |
| `side/1200x569.png` | 入场计划态中图表、绘图工具栏、右侧计划面板、底部回放控件和 `图上 Text` 入口同时可见；该帧没有持仓右栏 Text 记录。 | **PASS（仅布局/入口）**：支持 Text 是图上工具且入口可达的静态事实。**NOT VERIFIED**：这是入场计划态，不证明持仓自由 Text 的放置、同点身份或保存链。 |
| `scene/scene-select-end.png`、`scene/scene-select-holding.png` | 1440×900 scene 选择/入口帧中图表、工具栏、侧栏和回放区可见；没有 Text 卡与同点成交冲突。 | **PASS（仅场景布局）**；**NOT VERIFIED** issue 17 的 Text/交易语义，因为关键对象未同时出现。1440×900 不称为“小视口”。 |
| `side-scale/exit-both-open.png`、`side-scale/exit-both-closed.png` | 两个侧栏展开/关闭对照中退出场景的买入、加仓、部分退出、退出箭头/标签可见；侧栏打开时图表横向空间变窄，关闭时图表变宽。没有 Text 卡。 | **PASS（交易 marker 与布局对照）**；**NOT VERIFIED** Text 叠加态。该图只能支持横向空间取舍，不能直接断言 K 线实际 CSS 高度被压缩；1200×569 同点前后图表高度记录均为 296 CSS px。 |

## 结论与未决范围

Candidate-45 相对 frozen candidate-31 保留了可见的单条文案、买入交易箭头、工具栏和回放区；侧栏开关也有可读的交易 marker 对照。但本轮最终证据没有解决 candidate-31 已确认的核心视觉缺陷：

1. 同一真实时间/价格点的自由 Text anchor 与买入 marker 共用同一视觉圆点；同点双 Text 只有标题不同，没有独立、不会误导为交易绑定的身份标识。
2. leader/卡片进入 K 线和价格网格，B 的折线路径尤其会把 Text 关联误读成交易箭头关联；编辑态大卡片进一步占据行情区。
3. 平移、价格缩放帧只显示了屏幕上的重新布局，不能证明真实时间/价格锚点、重绘、命中或持久化保持；场景/侧栏截图没有 Text 对象，不能替代这些检查。

因此本轮 Task 04 / issue 17 的独立视觉门槛为 **FAIL**，不能据此放行 candidate-45。仍需交互验证/补证：真实鼠标、键盘取消与编辑、同点多 Text 的选择身份、边缘/长文本/更密集 Text、平移/缩放后的真实时间价格锚点、保存/返回/reload、回放未来信息边界，以及触控路径。静态截图支持的局部 PASS 不抵消上述 FAIL。

