# 自由 Text 人工调整能力核对

## 触发与结论

2026-11-06 用户明确：文字由自己放置，影响阅读时自己调整文字控件的范围；文字和文字、文字和成交标记的重叠无需专门处理。本次只核对隔离 v5 的普通 Text 能力，自动避让、同点同时可读及额外防碰撞控件作为 **EXCLUDED** 移出本轮检查分母，不记为 PASS。保留既有各版本历史判定，不直接重判整页或修改正式视觉规范。

限定路径中，v5 可以先选择图表位置并确认文字，再打开并修改文字内容；尝试从一条已确认文字的中心拖动后，其坐标与时间/价格标签均未变化。独立只读源码复核也未找到移动单条已确认文字位置或调整显示宽度的控件与状态更新。编辑器 textarea 可以纵向调整的是临时输入框，不是确认后图上文字的显示范围。此结果只适用于本版本及所列样本，不能推广到其他候选或所有输入设备。

## 冻结条件与责任

- 代码：隔离 [direct-text v5 清单](../../candidate-20261105-direct-text-v5/manifest.json)，九项文件 SHA-256 均于本轮核对一致；`workspace.js` 为 `f18728ad337822e765b9c67d3e7c85125d2ae73918f9f2e934a14e1ed47de54b`。未修改该原型代码。
- 服务：仓库根目录 `python3 -m http.server 3098 --bind 127.0.0.1 --directory .scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-04-direct-text-stage`；持仓页面 `http://127.0.0.1:3098/workspace-v0.1/index.html?variant=A&scene=holding`。
- 数据和界面：合成持仓数据，已揭示 31 根，内存文字；Chrome headless/CDP，1440×900 CSS px，DPR 1，左栏展开、右栏收起。输入由浏览器鼠标与文本事件驱动，不直接调用页面处理函数或修改状态。非物理鼠标、键盘、触屏、IME 和真实业务保存不在本次证据范围。
- 执行：协调者操作浏览器；未参与该候选实现的独立 Agent `/root/text_manual_review` 只读核对源码与既有证据。独立浏览器实操 **NOT VERIFIED**。先前 computer-use 状态读取超时；使用本地 Chrome CDP 完成限定操作。首轮检查坐标落入定位面板而中止，是检查脚本前置命中问题，留存 `../coord-manual-check-20261106/observations.json`，不判为产品故障。

## 版本绑定覆盖

| 元素与旅程 | 操作和观察 | 结果及证据 |
| --- | --- | --- |
| D02 / I13、I15：放置文字 | 选 T，在已揭示图上点选后输入并确认 | 样本文字可见；[确认前后](02-confirmed.png)、[步骤和坐标](observations.json)；限定 PASS。 |
| I17：修改文字内容 | 点击已确认文字，在输入框追加内容并确认 | 内容由“等待确认再行动”变为“等待确认再行动（补充）”，时间/价格标签不变；[编辑态](04-editing.png)、[确认态](05-content-edited.png)；限定 PASS。 |
| 已确认文字手动移动 | 在文字中心按下并移动 +80、+32 CSS px 后释放 | 样本文字位置、时间/价格标签未变；[操作后画面](03-after-text-drag.png)、[数值](observations.json)。独立源码核对未发现单条文字拖动及锚点更新实现。该事实不等于对其他设备的完整实操。 |
| 显示范围调整 | 查看最终文字和编辑输入框样式及保存逻辑 | 输入框计算样式为 `resize: vertical`；确认态宽度随内容变化且最大 280px。独立源码核对未找到独立调整确认态文字显示宽度的控件或保存状态；未实操输入框的原生缩放手柄。 |
| Text 相互或与成交标记重叠 | 用户明确自行调整，不要求专项处理 | 范围 EXCLUDED，N/A，不作为当前失败或通过；历史截图保留。 |
| 跨阶段、多个对象、完整键盘/触屏和整体视觉 | 超出本次局部核对 | NOT VERIFIED；既有限定样本仍须按原版本与范围阅读。 |

主要源码位置：[首次定位](../workspace-v0.1/workspace.js#L1076)、[编辑与确认](../workspace-v0.1/workspace.js#L1315)、[文字与编辑器样式](../workspace-v0.1/workspace-overrides.css#L123)。[原始观察](observations.json)含步骤、实际坐标与异常列表；该检查不能替代产品持久化和完整工作区验收。

## 3091 当前预览的补充样本

协调者另用相同浏览器输入与视口，实际打开 3091 的持仓页并完成首次放置、对一条已确认文字从中心拖动 `+80,+32` CSS px、点击编辑和确认补充内容。该样本中拖动前后卡片坐标与时间/价格标签未变；内容编辑确认成功；临时 textarea 的计算样式同为 `resize: vertical`。见[观察](../../task-final-candidate45/coord-manual-check-20261106/observations.json)、[确认态](../../task-final-candidate45/coord-manual-check-20261106/02-confirmed.png)、[拖动后](../../task-final-candidate45/coord-manual-check-20261106/03-after-text-drag.png)、[修改内容后](../../task-final-candidate45/coord-manual-check-20261106/05-content-edited.png)。

本轮核对 3091 读到的本地源码九项与 [candidate-45 清单](../../candidate-20261105-45/manifest.json)一致，`workspace.js` 为 `0504ece60a3f04fc27f78ab13db3f44a8bcfe0ee930bb56a6bcb08be06ff9ca2`。这只证明上述单条文本样本；候选 45 没有在本次由独立审阅者复核手动调整实现，其他状态与设备仍 NOT VERIFIED。
