# V2.4.1 C02/C03/C04/C05 图稿修复记录

日期：2026-10-22

本记录对应 `.scratch/v241-comment-repair-20261022/DESIGN-COVERAGE.md`、诊断报告 `review-records/2026-10-22-comment-diagnosis/REPORT.md`，只覆盖本图稿 owner 的 source SVG 与本目录脚本。未改 `home*.svg`、正文、manual、生成器或 comments。

## 已改文件与规则

- `chart-hover.svg`、`chart-hover--keyboard.svg`：两个 `ChartTooltip` 外框从 `264×112` 调整为 `264×144`；七行文字整体下移 `10px`，首行基线由外框顶端 `+14px` 调整为 `+24px`，末行“费用”基线由 `+118px` 调整为 `+128px`，为实际字形 bbox 的上下四边各保留至少 `12px` 的目标空间；右侧字段距右边 `12px`。正常态的“汇率✓ 行情✓”已删除，字段、轴刻度、图表线、点位和避让坐标保持原值。键盘图同样处理，未改变它的裁剪/视口变换。
- `atom-charttooltip.svg`：八态共享控件外框统一调整为 `264×124`；六行文字整体下移 `10px`，首行基线为外框顶端 `+24px`，末行“费用”基线为 `+108px`，以满足四边实际字形 bbox 至少 `12px` 的验收下限。四个正常态的“汇率✓ 行情✓”已删除。加载、行情缺失、汇率缺失三态改为统一的 `16×16` 蓝色圆形/路径 info SVG，原因保留在 `<title>`/`aria-label>`；禁用态的外观/命中说明同步为 `264×124`。
- `history.svg`、`history-stats-cumulative.svg`、`history-stats-empty.svg`、`history-stats-error.svg`、`history-stats-extreme.svg`、`history-stats-rounds.svg`、`history-stats-source-missing.svg`、`history-stats-win.svg`、`journeys-year.svg`：删除标题下重复的“按平仓时间 · 2026”（年度图为“按平仓时间 · 2024–2026”）。标题 `历史已平仓`、年份/展示方式选择器、业务指标、数据缺失/错误业务文案及图表轴均保留；标题右侧 `x=162,y=56` 放置 `16×16` 圆形/路径 info SVG，说明放在 `<title>`/`aria-label>`：`统计日期取平仓时间；仅统计已平仓回合`。标题图标右缘 `178`，选择器左缘 `1102`，不会挤占选择器。
- `chart-gap.svg`：缺失数据提示保留业务文案，在提示框内增加统一 `16×16` 圆形/路径 info SVG（`x=462,y=313`，文案从 `x=462` 移到 `x=482`，同一基线 `y=321`）；未改轴、线段、点位或图表布局。

统一图标结构是 `16×16` SVG，`viewBox="0 0 24 24"`，圆形 `r=9` 与 `1.5px` 路径，避免用字体字符模拟 `ⓘ`。源文件中不再有 `ⓘ`。

## 最终坐标、字段底边与内边距目标

以下坐标按 SVG 外框左上角含义记录，右/下边界采用左上角加宽高计算。`baseline` 是 source 中的文字基线；实际字形 bbox 由 `chart-acceptance.html` 在浏览器字体环境中读取，不能用基线加固定经验值替代。四边验收下限为 `12px`。fixture 的测量结果通过根 SVG 的 `getScreenCTM().inverse() × element.getScreenCTM()` 还原为该 SVG 的 viewBox/user units，不受页面流式缩放影响。

| 图稿/状态 | 外框（源坐标） | 变换后可见外框 | 高度 | 最后字段基线 | 字段最大底边（浏览器） | 四边最小内边距（浏览器） |
|---|---|---|---:|---:|---:|---:|
| `chart-hover.svg` 首个 tooltip | `(748,250)`，`264×144` | `(748,150)–(1012,294)` | 144 | 378 | 浏览器 fixture | 浏览器 fixture |
| `chart-hover--keyboard.svg` 第二个 tooltip | `(128,568)`，`264×144` | `(128,62)–(392,206)` | 144 | 696 | 浏览器 fixture | 浏览器 fixture |
| `atom-charttooltip.svg` 默认/悬停 | `(44,134)` / `(584,134)`，`264×124` | 同源坐标 | 124 | 242 | 浏览器 fixture | 浏览器 fixture |
| `atom-charttooltip.svg` 聚焦/按下 | `(44,379)` / `(584,379)`，`264×124` | 同源坐标 | 124 | 487 | 浏览器 fixture | 浏览器 fixture |
| `atom-charttooltip.svg` 加载 | `(584,624)`，`264×124` | 同源坐标 | 124 | 732 | 浏览器 fixture | 浏览器 fixture |
| `atom-charttooltip.svg` 空/错 | `(44,869)` / `(584,869)`，`264×124` | 同源坐标 | 124 | 977 | 浏览器 fixture | 浏览器 fixture |

`chart-hover.svg` 的另一 tooltip 源坐标为 `(128,568)–(392,712)`，但所在 `translate(0,-100)` 后落在 `(128,468)–(392,612)`，超出该分镜视口；键盘图的首个 tooltip 源坐标为 `(748,250)–(1012,394)`，经 `translate(0,-506)` 后落在负 y 区域。两者都保留原有状态分镜与裁剪关系。

七行 chart tooltip 的首行/末行基线规则为外框顶端 `+24/+128px`，共享 atom 的六行规则为 `+24/+108px`；右侧字段右缘距外框 `12px`。内容顺序、字号、行距均保持不变，只移动内容并增高外框。

root 的首次 CUA 复核已观察到 9 个有内容的 active tooltip 四边均显示 `≥12`，另有 2 个无内容的 inactive tooltip 因继承分镜的原有裁剪而被标记为 clipped，排除在 padding 验收之外。随后已修正 fixture 的 CTM 归一化，使同一结果以 source user units 展示；root 需在修正后的页面刷新一次并记录最终数值。

## C05 文案分类与迁移去向

- 业务主信息（保留在画布）：`历史已平仓`、年份与展示方式入口、净盈亏/回合/胜率/费用指标、图表标题、轴刻度、时间标签，以及缺失/错误状态的业务事实说明。
- 次要口径（移入统一 info 说明）：`统计日期取平仓时间；仅统计已平仓回合`。图标可访问名称和 SVG `<title>` 同步保留该说明；tooltip 异常原因分别为 `行情加载中`、`行情缺失`、`汇率缺失`，缺失金额提示为 `数据缺失 · 金额 —`。
- 技术/作者/设计说明：本轮 C04/C05 覆盖的 `history*.svg` 与 `journeys-year.svg` 未发现这类可见文案，因此没有伪造删除或迁移；正文/manual 的对应说明由 root 按任务要求补写。`chart-gap.svg` 原有底部“V2.4.1 · 设计状态图，非产品运行截图”和 `atom-charttooltip.svg` 顶部状态图说明属于各自原始图稿说明，C05 覆盖表未登记它们，本次最小同步保留并列为未迁移项。

## Source 级校验

已运行：

```text
node .../review-records/2026-10-22-comment-repair/repair-charts.mjs --apply
node .../review-records/2026-10-22-comment-repair/repair-charts.mjs
node --check .../review-records/2026-10-22-comment-repair/build-chart-acceptance.mjs
node .../review-records/2026-10-22-comment-repair/build-chart-acceptance.mjs
Python XML parse：13 SVG files
xmllint --noout：13 SVG files OK
git diff --check：无输出
```

脚本检查了 tooltip 数量/尺寸、正常态勾选移除、历史副行移除、info marker 存在、所有 info marker 使用 `16×16` circle/path SVG、无 `ⓘ` 字符，以及 atom 统一 `264×124`。source 级检查未替代浏览器渲染、实际悬停/键盘操作、全页嵌入视觉对照或业务数据库流程验证；这些属于 root 的集成验收范围。浏览器最终文字 bbox、四边剩余内边距和 clip 状态由 root 在 CTM 归一化后的 fixture 中记录。

## 可视测量页

`chart-acceptance.html` 是本目录的静态复核页，内嵌上述 13 个 source SVG，并按文件提供锚点。浏览器加载后会读取每个 `ChartTooltip` 的 root user-coordinate 外框与文字 bbox，计算四边剩余内边距并直接标记是否达到 `≥12px`，同时检查外框是否越过 root `viewBox` 或祖先 `clipPath`；没有 `ChartTooltip` 的历史图和缺失提示图仍保留完整画布供视觉检查。测量代码已抵消 fixture 的 CSS 显示缩放，表中数值单位与 source 的 `viewBox` 一致。

需要重建页面时运行 `build-chart-acceptance.mjs`。协调者可将本目录作为静态根目录在 3088 端口提供给 CUA，例如：

```sh
python3 -m http.server 3088 --directory docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/2026-10-22-comment-repair
```
