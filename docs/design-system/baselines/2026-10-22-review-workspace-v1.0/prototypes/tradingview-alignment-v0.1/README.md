# TradingView 绘图与回放对齐审阅包

此包用于讨论逐项对应和工作区适配。用户要求的1:1目标保留；所有候选身份、行为及视觉精度缺口见 [方案正文](contract.md)，尚未完成实际功能对齐。

- [原图与拟制组件对照](http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/tradingview-alignment-v0.1/index.html?view=compare)
- [工作区语境](http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/tradingview-alignment-v0.1/index.html?view=context)
- [状态与逐项契约](http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/tradingview-alignment-v0.1/index.html?view=states)

从仓库根目录启动：`PORT=3091 docs/design-system/start-design-preview.sh`。服务只绑定loopback，URL须包含index.html。已运行则复用，不另起占用同端口服务。

本包不访问业务数据库，不执行绘图/播放/下单，不修改权威正文。所选槽位和状态是内存态，刷新回到D01/default；视图用URL保存。点击仅展示设计字段。SVG是拟制轮廓，未取得原始矢量；颜色/尺寸/状态为候选，不得称像素或功能1:1通过。

2026-10-24红框反馈修订：修正D08/D09箭头对应间距、D10旋转矩形的六个控制点、D12框内T的专用路径，以及工具条边框导致的整体缩小。独立浏览器比对和四槽五状态检查已完成。[修订验收记录](../../../../../../.scratch/review-workspace-design-map/evidence/tradingview-contract/icon-correction-20261024/audit.md)保留前后版本；整套视觉及真实功能1:1仍待核实。
