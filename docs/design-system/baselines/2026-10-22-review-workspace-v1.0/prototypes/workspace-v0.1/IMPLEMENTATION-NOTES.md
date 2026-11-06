# Implementation notes

- `workspace.js` defines named render slices (`leftPanel`, `chartPanel`, `rightPanel`, `replay`, `reviewStrip`) and one in-memory state object so the first journey is visible without business wiring.
- The chart uses the local Lightweight Charts standalone production bundle and real candlestick/histogram series. Synthetic data is clipped at `state.revealed`; no hidden future series is passed to the chart.
- The toolbar uses the corrected read-only `../tradingview-alignment-v0.1/icons.svg` sprite with explicit per-slot viewBox crops for all 13 slots. D02 wires to the local Text demo; the other slots remain high-contrast disabled controls with an explicit reason.
- Rail width follows the contract: 224px / 304px expanded, 40px collapsed, 14px gaps. At 1291px and below the left rail defaults closed; at 1107px and below both rails close to preserve the chart surface. The document retains a minimum desktop workspace width and does not claim mobile adaptation. Chart pan/zoom is enabled, and the chart instance plus visible logical range survive rail and replay rerenders.
- A review strip reserves 44px outside the product workspace and has explicit hide/show state; it never overlays the 60px replay bar.

## Phase 2 state wiring

`state.scene` carries entry, holding, add, partial, exit, and resume fixture cutoffs. Drafts are keyed by `state.drafts[tradeId][nodeId]`: entry owns the first fill and holding interval, add owns the add-to-partial interval, and partial/exit own their later evaluations. Playback and node actions update scene and revealed bars together; markers and known facts are gated by the same cutoff. Entry/add/resume inputs calculate quantity, amount, percent, risk, and reward from finite positive values; invalid values remove price lines. Holding/partial/exit use read-only plan facts and exit evaluation fields. Records, close, speed, replay visibility, trade selection, date selection, filtering, and scene review all have stable hooks.

The fixture is memory-only. It does not persist, export, implement TradingView drawing lifecycles, or claim mobile, physical-touch, or business calculation acceptance.

## Revision 01 UI slice

- 三个回合共用“示例股份 / 600000”身份但各自拥有独立买入日期与日线时间轴；日期回放范围由当前回合合成数据计算。
- 右侧只保留 A 结构：买入前编辑计划，持仓阶段自动收为 40px 状态轨道，结束后展开评价。持仓阶段不提供右侧 Text 卡或独立判断表单。
- Text 记录按回合隔离，T 工具进入图上定位；每次确认追加自由锚点，点已有标注可编辑，取消/Escape 不改已确认内容。锚点保存时间、价格和 logical 坐标，随图表视窗重算位置，并按已揭示截止隐藏。
- 回放与评价仍为合成内存演示：不写业务数据库、不实现 TradingView 绘图生命周期、不声称移动端或真实交易数据已验证；Text 支持回合内多条单点自由标注；区间映射不在本轮范围。
