# 协调者独立核验

- 2026-10-16，版本绑定见 version.json：冻结清单 81/81 哈希一致。
- 原始 HOME-DOC revision 39 全文读取；C07/C10/C12/C24 同时读取 quote/segments，避免脱离锚点理解。
- 在实际浏览器打开 V2 阅读器，确认 HP01–HP09 可见；未修改或提交评论。
- 真实浏览器打开 controls-states.svg 并保存完整渲染 controls-states-browser.png（图板 1660×1480；不把图板尺寸当作浏览器 CSS 视口）。
- 观察：状态全集中 DataTable、Popover、ChartTooltip 多用同形矩形替代真实结构；许多 error 格使用相同的“保留旧数据 / 原因”“详情 / 异步重试”。这只能证明类别标签齐全，不能直接证明具体组件的异常布局和触发/取消/恢复完整。
- 根协调者阅读 visual-design.md、build-frames.py、build-detail-frames.py，待与审查者的具体证据交叉确认。

本次为设计规范审查。实际产品功能、业务数据库持久化、物理触屏等不在审查范围；不以静态图判定其通过。
