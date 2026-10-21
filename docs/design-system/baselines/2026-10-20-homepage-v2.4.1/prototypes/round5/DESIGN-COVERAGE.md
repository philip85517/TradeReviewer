# 第五轮：两组完整原型

2026-10-21；用户已授权执行剩余两组。root 集成、状态流与独立验收；两个实现者各自负责互不重叠文件。静态示例数据，不访问业务数据库；无回放执行、无持久化写入。保留四轮既有选择，正式文档及冻结归档不修改。

参考：docs/design-system/baselines/2026-10-19-homepage-v2.4/source/visual-design.candidate.md；图片均位于该目录 images/；已确认控件来自 ../round4/index.html、../round4/ui-select.js。剩余范围依据 docs/design-system/iterations/2026-10-21-homepage-v2.4.1-prototype-coverage-audit.md。

|ID / 规格行|元素与状态|准确参考图|owner|旅程及可观察结果|证据/状态|
|---|---|---|---|---|---|
|D05 /216,347|金额、比例、回合轴及提示|history.svg, history-stats-win.svg, history-stats-rounds.svg|root（接管整合）|盈亏→胜率→回合数；单位正确、轴最多7刻度、数量整数|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|
|D06 /345|月份/年份刻度|history.svg, history-stats-cumulative.svg|root（接管整合）|2026→2024–2026→2025；月/年明确|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|
|D07 /343–359|范围与模式、指标联动|history.svg, journeys-year.svg；round4 #d07|root（接管整合）|单年每月/累计，跨年每年/累计；四卡、轴、数据一致且容器不跳|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|
|D08 /343,345|真实零、无回合|history-stats-empty.svg|root（接管整合）|零值有回合；无回合胜率未知；背景hover/focus说明|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|
|D09 /351–377|未来、缺失、等待、失败|history-stats-source-missing.svg, history-stats-error.svg|root（接管整合）|未来不连线；缺失不伪零；失败保留旧范围；重试|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|
|D14 /216,351|线点、十字线、提示避让|history.svg, history-stats-extreme.svg；home-1440.svg|root（接管整合）|历史边缘键盘读数；纯hover未独立验证；当前曲线仅静态线条风格参考|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|
|D12 /389|贡献实心/中空几何|contribution-states.svg, contribution-mixed-sign-demo.svg, contribution-extreme.svg|contribution worker|双正/双负/异号/微小/零/缺失/大额；同中心外高度，无假最小宽|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|
|D13 /389–414|正负颜色、图例、历史模式|contribution-current-a-share.svg, contribution-historical-a-share.svg；round4 #d11|contribution worker|旧/建议同数据；单一底部区；市场下钻返回，历史只显示已平仓|evidence/ACCEPTANCE.md；原型范围通过，限制见记录|

## 视觉和控件验收契约

局部前端开发触发 frontend-control-audit.md。控件清单按各实现页面真实 DOM 与动态选项登记；root 做真实鼠标、键盘和前后空间比较。默认1440×900、1280×800、窄容器边界；窄屏只验证原型可滚动阅读，不提出新的移动端产品布局。参考 SVG 1320 宽及全页1440/1280不是 CSS 像素等同比对，需记录缩放。功能18/600、图题16/600、线2、轴12/16；零线#A8B6CB、网格#283448。图表容器和绘图区在指标/范围/异常间不得改变尺寸。D07 A、D10 A/窄B、D11 B保留。仅未决颜色/点径的完整组合为候选；说明在产品画布外。

原型A在同一首页历史区位置，可明确注明局部裁切并提供原整页位置参考，不重排首页。原型B只一个贡献区，旧/新切换复用同数据与范围。新图稿仅为原型，用户未确认前不替换规范。无后端、无数据库、无保存承诺；刷新恢复示例默认，不冒充持久化。

完整交易详情容器不属于本轮：仅连接占位，验证分页/筛选/焦点返回；当前表现曲线完整交互也排除。纯hover和物理触屏未验证，不计为通过。正式文档传播尚未执行。
