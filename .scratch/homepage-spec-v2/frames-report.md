# Homepage V2 SVG frames report

状态：图稿已生成，等待协调者与独立审查者验收；不代表产品实现已完成。

## 生成与验证

在仓库根目录运行：

```sh
python3 docs/design-system/baselines/2026-10-16-homepage-v2.0/build-frames.py
for f in docs/design-system/baselines/2026-10-16-homepage-v2.0/images/*.svg; do xmllint --noout "$f"; done
```

本次生成 30 个 SVG（另加 `history.svg` 历年结果独立走势图）。脚本使用合成数据，未读取或写入业务数据库；示例数值仅用于视觉密度与正负状态。局部组件图已改为独立画布，不嵌入导航与页头。

细节图由独立脚本生成，不改主生成器：

```sh
python3 docs/design-system/baselines/2026-10-16-homepage-v2.0/build-detail-frames.py
```

新增 `controls.svg`（11 个控件、每个 8 种适用状态）、`tokens.svg`（3 个字体候选与真实样本）、`motion.svg`（popover 0/80/160ms、贡献 0/100/200ms）、`snapshot-options.svg`（A/B tooltip 方案）、`library-handoff.svg`（首页导航徽标到交易库队列）、`holdings-name-tooltip.svg`（长名完整 tooltip）。6 张细节图已通过 `xmllint`。

细节图第二轮修订：11 个原子控件已按正文语义拆分，并在不适用状态标明原因；字体候选调整为系统 UI Sans / Web Sans 示意 / 等宽数字层；popover 整体使用 opacity + 向上 4px transform，贡献行逐步出现；快照方案仅保留曲线图点详情入口；交易库交接拆为日期入口、日期+市场应用、3 条目标交易行与返回保留范围三个独立场景。

## 图稿要点

| 图稿 | 具体设计点 |
|---|---|
| `home-1440.svg`, `home-1280.svg` | 72px 左导航、紧凑页头、范围/市场页签、四个 KPI、全宽净值图、8 行固定持仓槽、历年结果与贡献分析。页面按 1440 宽设计，`home-1440` 约 1900 高。 |
| `history.svg` | 历年已平仓 KPI 与独立历史净盈亏曲线；与当前期间 `+¥18,420` 分开，按平仓日归年。 |
| `market-all.svg`, `market-us.svg` | 市场页签控制币种与上下区数据语义，全部为 CNY，美股为 USD；KPI与图表单位同步。 |
| `search-open.svg`, `filter-open.svg`, `filter-applied.svg` | 搜索浮层含交易所类别缓存；筛选展开与已应用态结构不同，已应用态显示条件标签。 |
| `chart-hover.svg`, `chart-gap.svg` | 折线、横纵轴、网格、hover 详情；缺口标注“未插值，不代表零”。 |
| `holdings-0/5/10/20/50.svg` | 统一 8 行槽位与固定分页；0/5/10/20/50 按实际数量填充或留空，含唯一代码/交易所、14/12px 字体、右对齐 CNY 数值、持仓天数与查看图标。 |
| `contribution-0/5/10/20/50.svg` | 正负贡献共用零线，按绝对贡献排序；0/5/10/20/50 数量为不同实稿，20/50 纵向展开。 |
| `state-loading.svg` | 首载骨架固定在主数据位置。 |
| `state-updating.svg` | 旧值保留，旁边显示后台更新；1.2s `animateTransform` 状态环，`prefers-reduced-motion` 显示静态环。 |
| `state-stale.svg`, `state-no-fx.svg`, `state-partial.svg`, `state-error.svg` | 过期、缺汇率、部分行情、失败均使用小警告与细节浮层；缺汇率不绘制不可比曲线；失败只保留图标和浮层重试入口。 |
| `tokens.svg` | UI sans、等宽数字候选、颜色角色和最终色值。 |
| `controls.svg` | 搜索/筛选/查看/导出/重试/日期真实线性图标，覆盖 default/hover/focus/pressed/disabled。 |
| `motion.svg` | 0/80/160ms 的控件/浮层节奏以及 1.2s 更新环示意；reduced-motion 说明。 |
| `snapshot-options.svg` | D01 两个候选入口并列；保留二级日期查看与删除入口，明确“待决策”，未写成已批准。 |

## 未验证项

- 尚未在评论阅读器中核对目录、分镜、图片评论锚点和实际渲染截图。
- 尚未由独立审查者逐条对照 39 条评论、V2 DESIGN-COVERAGE 与 V1 原图验收。
- 尚未进行浏览器多视口视觉比较；SVG XML 结构已通过 `xmllint`。
- 动效由 SVG 语义声明表达，需在真实浏览器确认 reduced-motion 媒体查询和状态环动画行为。
- `filter-open.svg` 与 `filter-applied.svg` 当前保留相同几何框架，应用态差异以条件标签/选中样式为后续评审重点。
