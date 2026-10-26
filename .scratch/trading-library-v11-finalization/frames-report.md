# V1.1 图稿票报告

## 范围与依据

本票只更新 V1.1 图稿生成器、必要的图稿指标断言和生成器输出；V1.0、E 原型、fixture、正文、`homepage-template.py` 与首页图稿没有改动。实现对照权威原型 `docs/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-e-prototype.html`、E refinement 截图和全站 V2.5 参考，比较视口为 1440×1000 与 1280×800。

已落实的公共框架包括：72px `#0E1622` 侧栏、首项 y=73/步长64/高56、24px 线性图标、无账户底栏；64px header 仅保留“交易库”；58px subnav 统一承载实盘/模拟盘与列表/统计，模式槽 184×44（x=96、y=70.5），模式按钮 88×36；筛选控件从 y=161 起，列表/统计内容从 y=215 起。统计趋势与分布按 E 原型上下排列。

模拟盘使用 `#111E2C` main/subnav、`#162332` 卡片、`#40566D` 边框以及 `#607C96` main/nav 顶边；实盘 token 保持现有值。统计指标按要求使用 live 6 项单行、simulation 8 项 4×2；净盈亏/平均盈利为绿色，平均亏损为红色，其余为中性。费用、趋势、分布和回撤采用带 SVG `<title>` 的信息入口，说明文本明确口径；费用与回撤不再占用旧 B 的大横幅。

列表仍保留日期、市场、账户/身份、交易搜索、刷新和复盘状态控件；复盘状态位于单行筛选区，排序摘要位于表格摘要行，避免与搜索/刷新重叠。详情的回合集、复盘和逐层返回继续保留。

## 41 帧覆盖

生成器 `FRAMES` 的实际全集为 41 项，全部由 `generate-library-frames.py --all` 生成并通过 XML 解析：

```text
01-live-normal.svg
02-simulation-normal.svg
03-distribution-selected.svg
04-return.svg
05-loading.svg
06-empty.svg
07-error.svg
08-extreme.svg
09-missing-input.svg
distribution-amount.svg
handoff.svg
hcr06-final-pending-library-1280.svg
hcr06-final-pending-library.svg
hcr06-final-replay-a1.svg
hcr06-final-replay-a2.svg
hcr06-final-replay-b1.svg
hcr06-final-return.svg
hcr06-final-rounds-a.svg
hcr06-final-sim-ab.svg
journeys-date-1280.svg
journeys-date-month.svg
journeys-date.svg
journeys-home-entry.svg
journeys-library-list-return-1280.svg
journeys-library-list-return.svg
journeys-library-list.svg
journeys-library-replay.svg
journeys-library-return.svg
journeys-live-rounds-return.svg
journeys-live-rounds.svg
journeys-rounds-a-return.svg
journeys-rounds-b.svg
journeys-simulation-return.svg
journeys-trend-empty.svg
journeys-trend-gap.svg
journeys-trend-month.svg
journeys-trend-single.svg
journeys-trend-year.svg
journeys-view-restore.svg
journeys-view-simulation.svg
library-return.svg
```

其中首页宿主帧保持现有 V2.5 renderer 与布局，作为 FRAMES 的集成入口继续输出；其余帧覆盖实盘/模拟盘列表、统计、加载/空/错误/缺失、趋势时间粒度、分布下钻、回合集、复盘及返回路径。

## 验证证据

| 检查 | 结果 |
|---|---|
| `python3 .../generate-library-frames.py --all` | PASS；`Generated 41 frames; fixture invariants passed.` |
| `python3 .../test-library-metrics.py` | PASS；5 tests |
| `python3 .../test-homepage-template.py` | PASS；5 tests |
| 全部 SVG `xml.etree.ElementTree.parse` | PASS；41/41 可解析 |
| fixture / 原型 / V1.0 文件 | 未修改 |
| 独立浏览器截图比对 | PENDING；由协调者和独立视觉 reviewer 在真实浏览器完成 |

静态图稿票的独立视觉验收仍以协调者在 1440×1000、1280×800 浏览器中的截图对照为准；该报告不替代该独立验收门槛。

## 后续修复记录

- 趋势卡的信息入口按可见标题末端定位，保留至少 8px 间距，避免与“累计净盈亏趋势/可计算累计净盈亏”等标题重叠。
- 统一将信息入口图标改为 `i`，并保留 SVG `<title>` 与正文口径说明。
- 分布卡将副标题、坐标轴和图表整体下移 12px，为 y+16 的粒度按钮保留至少 8px 可见间距。
- 窄版实盘列表的“状态”表头与数据统一右对齐到卡片内侧：1280 帧使用 `x=1232`、`text-anchor=end`，避免文字越过卡片边界。
- 列表分页恢复由 `navigation.*.page_size` 驱动；实盘首 1280 帧按 fixture 的每页 6 笔输出第 1/2 页，并以回归断言确认第 7 笔不提前出现。
