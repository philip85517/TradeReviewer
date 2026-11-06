# 自由 Text 轻量候选：独立静态视觉复核

日期：2026-11-05。非实现者根据协调者在真实 Chrome 中采集的同一状态截图复核；审阅者没有进行独立浏览器操作。本记录只覆盖指定图片，不代表整页验收。

## 对照与结论

- 1200×569 CSS、DPR 2、持仓 31 根：对照 [v4 编辑已有 B](coord-same-point-v4/edit-second-before-cancel.png) 与 [v5 同状态](coord-same-point-v5/edit-second-before-cancel.png)。v5 顶部显示“正在编辑图上 Text · 修改后确认或取消”，和打开的编辑框一致。**局部 PASS**；v4 此项为 FAIL，历史证据保留。
- [v5 新建 B 时](coord-same-point-v5/buy-conflict-B-edit.png)，A 仍可读；编辑框没有遮住绘图工具条和价格轴，也没有横跨图表的长引线。编辑框仍暂时覆盖部分 K 线。
- [v5 确认态](coord-same-point-v5/buy-conflict-B-confirmed.png)的自由文字、买入箭头及“首次买入”标签视觉上叠成一组，容易混淆归属；画面只能辨认 B，不能直接阅读被盖住的 A。**视觉 FAIL**。两个自由对象放在同一点可能自然遮挡，这不自动等于必须强制避让；是否接受和如何选择仍待设计审阅。

以上仅是截图观察，不能由此证明两条文字均可通过鼠标或键盘单独选中、取消路径或其他视口与输入方式通过。协调者补充的真实操作独立见 [REPORT](REPORT.md)；该操作不等于审阅者本人实操。
