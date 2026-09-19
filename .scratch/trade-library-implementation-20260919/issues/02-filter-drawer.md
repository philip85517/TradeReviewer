# 02 — 高级筛选抽屉与来源平台筛选

**What to build:** 右侧抽屉编辑高级条件，应用后生效，关闭放弃未应用修改。

**Blocked by:** 01 — 统一交易库入口与浏览状态

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 主页面常驻性质、市场、搜索、复盘状态
- [x] 来源平台多选下拉，TradingView 仅一个选项，运行单独筛选
- [x] 年份、账户及运行在抽屉内，应用标签可逐项移除
- [x] 键盘焦点、Escape、窄屏及打开关闭行为可用；无无关行情请求

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
