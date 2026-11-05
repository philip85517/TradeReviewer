# TradingView 回放栏视觉差异与证据缺口

ID: review-audit-19
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P2
Blocked by: 无

## Scope / What to build

对照用户截图审阅底部回放控件形态、顺序和信息密度，并维护各绘图槽位的功能证据缺口。此票仅记录审阅发现，不构成修复授权或完成 TradingView 1:1 的证明。

## Refs

- [审阅报告及参考链接](../evidence/independent-design-review-20261028/REPORT.md)。
- [逐项对齐合同任务](05-tradingview-contract.md) 与 [参考研究](02-tradingview-research.md)。

## 验收标准与反例

- [ ] 同状态视觉对照用户参考与原型，标注槽位、图标、容器、间距及产品自有入口；注明原图视口未知而不可作像素等同结论。
- [ ] 每个图标/功能记录真实身份、交互证据、缺失和禁用状态；未取得证据明确 NOT VERIFIED。
- [ ] 保留用户要求缩小的绘图工具条，区分视觉外形与真实绘图/回放行为两道验收。

反例：用相似的 SVG 或禁用占位直接声称完整功能 1:1。

## candidate-v37 版本绑定观察（2026-10-29）

candidate-v37 的版本边界见[manifest](../evidence/review-fixes-20261028/candidate-v37/manifest.json)，其中 `workspace-replay.css` 快照 SHA-256 为 `b1dc068c88992ae009f14411382e1e66ec9bf9d493cb38b998791e65b1a52ab1`。协调者真实浏览器记录 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 测得 1108 与 1280 的入场/持仓播放按钮 x 坐标只变化约 0.33px，并记录 1327/1328 断点两侧候选槽显示状态改变、播放按钮位置约移动 17.5px。未参与实现的审阅者对协调者截图作独立静态比较，见 [final-review-v37](../evidence/review-fixes-20261028/final-review-v37/REPORT.md)：窄屏所示主要操作可见，图标造型较协调；同时保留了跨断点焦点/点击目标的 P3 交互风险，并指出多节点图形与参考较简化。该审阅没有独立操作工具，也没有证明 TradingView 1:1。

因此 v37 只提供候选回放布局的协调者几何观察和静态局部视觉改善。实际命中、各工具图标身份与绘图功能、断点切换中的焦点/可用操作、参考截图视口差异仍未验收；历史差异及 FAIL 不因本版局部观察关闭。本票保持 open / acceptance-failed。

## candidate-v37 独立逐槽对照追加（2026-11-04 至 11-05）

未参与实现的审阅者直接对照用户 TradingView 截图及自己捕获的原型画面：普通 Text 的 T 底部短横在候选中缺失，多节点图形的连线和节点布局较参考图明显倾斜、简化；逐项视觉 1:1 **FAIL**。上下箭头、旋转图形和框内文字在本次截图尺寸下未再见用户此前指出的明显粗大变形，但精确比例仍未证实。见[参考裁图](../evidence/independent-acceptance-20261104/visual/tv-reference-toolbar-crop.png)、[候选裁图](../evidence/independent-acceptance-20261104/visual/candidate-toolbar-crop.png)与[逐槽报告](../evidence/independent-acceptance-20261104/visual/REPORT.md)。

参考图的视口、DPR 和 TradingView 版本未知，当前比较可判断可见轮廓与顺序，不能宣称像素级相同。回放栏存在日期文字、速度箭头及额外“下一回放停点”等差异；除 Text 演示外其余绘图项在本原型禁用，实际 TradingView 功能 1:1 仍 **NOT VERIFIED**。本票继续 open / acceptance-failed；本记录不构成修复授权。


### 2026-11-05 candidate-16 局部轮廓与交互复测

D02 和 D11 可见轮廓在参考尺度归一后由非实现者复核通过；D02 鼠标和键盘选中、定位、取消以及 D10/D11/D12 禁用中心点击已按限定路径复测。详情见 [task 05 验收](../evidence/systematic-fixes-20261105/task-05-candidate16/REPORT.md)。TradingView 原版精确矢量、身份及全部实际功能仍 NOT VERIFIED，本问题保持开放。
