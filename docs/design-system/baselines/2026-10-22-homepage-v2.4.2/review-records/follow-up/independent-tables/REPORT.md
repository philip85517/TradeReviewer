# Tables follow-up 独立复核记录（V2.4.1）

日期：2026-10-21（Asia/Shanghai）  
复核者：tables（只读独立复核；不拥有 shared/history source）  
范围：39 张 shared 基础图 + 12 张关联筛选图（共 51 张 shared 图），另补审 8 张此前遗漏的 chart/period 图（shared/chart 静态覆盖共 59 张），以及 history owner 的 4 张整页 home preview。  
基线：`docs/design-system/baselines/2026-10-20-homepage-v2.4.1`  

本目录是最终复核材料快照。没有直接改写 `source/home*.svg`、`visual-samples-board.svg`、shared owner 文件或 history owner 脚本；候选整页仍由 `apply-shared-embedded.mjs --preview` 生成，root 负责 source 合入和最终整体验收。

## 渲染口径（更正）

- 51 张 shared 证据的“静态渲染”口径是 **Chrome headless 浏览器引擎输出**，不是 sharp：39 张基础图是本轮按当前 source 重新生成并查看的 Chrome PNG；12 张关联筛选图是 shared owner 已生成的 1440px Chrome 证据的副本/独立复看，本轮没有再次采集新的浏览器截图。
- 4 张最新 home preview 的完整 raster 是 **sharp SVG 栅格化输出**，不是 Chrome/IAB 截图；对应 SVG 仍做了结构检查和像素查看。报告中这些 home PNG 不作为浏览器证据。
- 新补审的 8 张 chart/period 图同样是 **sharp SVG 栅格化输出**（`density: 72`，画布严格保持源 `viewBox`），不是 Chrome/IAB 截图；完整源/PNG hash 与逐图结论见 [`evidence/chart-review-manifest.md`](./evidence/chart-review-manifest.md)。本轮 Chrome headless 重试以 134 退出，未把它写成浏览器证据。
- 本任务的 `cua_repl.getState()` 返回 `apps:[]`、`browsers:[]`，所以没有 CUA tab、点击、键盘或运行时交互验收。Chrome headless 仅证明静态浏览器引擎绘制，不能替代 CUA 交互证据。

## 交付内容

- [shared-review.md](./shared-review.md)：39 张 shared 基础图逐图结论、历史胜率/回合轴语义复核、12 张关联筛选图复核、补充 8 张 chart/period 图复核、旧 FAIL 与 guarded 修复副本 hash。
- [chart-period-final-review.md](./chart-period-final-review.md)：8 张遗漏 chart/period 图的最终只读结论、逐图 source hash、渲染方法、截图和待返问题。
- [home-final-review.md](./home-final-review.md)：4 张 home preview 的历史快照、23:20/23:25 结论及 23:37 历史两图图例修复复核；旧 D07/D11/D12 FAIL 与新 hash 均保留。
- [fix-local-search-pages-clear.py](./fix-local-search-pages-clear.py)：只写输出副本的 shared 底部间距修复脚本，源 SHA 校验后才运行。
- `evidence/`：51 张 shared 证据、8 张 chart/period 补审证据、历史 FAIL/修复副本、4 张最新整页 SVG、4 张最新整页 raster、D01/D02/D10/D11/D12 放大裁切和历史轴截图。

## 当前结论

| 范围 | 静态/像素结论 | 当前边界 |
|---|---|---|
| shared 基础 39 图 | **PASS**：日期/搜索工具与表头未见重叠，表头/数据右锚一致，正文和手册语义未见冲突。 | 真实点击、键盘、滚动锁定、请求恢复、返回持久化为 **NOT VERIFIED**。 |
| shared 关联筛选 12 图 | **PASS**：清除、重置、取消、重开、错误/修复和 detail 表格静态布局均通过；detail 的数量/成本价/市值/浮盈右缘一致。 | 运行时筛选、Esc/外部点击、重置/恢复、详情打开关闭为 **NOT VERIFIED**。 |
| `local-search-pages--clear.svg` | 旧独立证据保留 **FAIL**：原 source 在 `translate(0,-1326)` 后卡片底 y=520、页脚 baseline y=518，贴压底边；guarded 修复副本已渲染通过。 | shared/root 仍需把坐标正式合入 source 并重新绑定最终 source/Chrome hash；本目录不替代该复验。 |
| 4 home preview（23:25；history 两图 23:37 follow-up） | **PASS（静态）**：D01/D02 表格、日期/搜索工具、D07 选择器、D10 A/B、D11 单排序/checkbox、D12 当前/历史实心几何、金额 0 线均无新布局缺陷。 | history 两图已更新为 round5 要求的 `仅已实现（历史模式）`，文案与几何均静态通过；浏览器与交互为 **NOT VERIFIED**。 |
| 8 张 chart/period 补审 | **6 张静态几何 PASS；2 张 OPEN identity；`chart-scale.svg` 另有 1 项规范 FAIL**：缺口、tooltip、比例和期间控件无静态重叠；`chart-gap.svg`/`period.svg` 页脚仍为 V2.3；`chart-scale.svg` 亿刻度为整数。 | 本轮未改源图；对应 owner/root 需处理 V2.4.1 页脚和两位小数刻度，hover/键盘/日期应用交互为 **NOT VERIFIED**。 |


## 8 张 chart/period 追加覆盖（2026-10-21）

这 8 张图不在此前 39/51 shared 清单中，本轮补齐了当前 source 的独立静态证据。渲染为 exact-viewBox sharp PNG，清单和 hash 见 [`evidence/chart-review-manifest.md`](./evidence/chart-review-manifest.md)，逐图 PNG 在 [`evidence/charts/`](./evidence/charts/)。

| 图稿 | 结果 | 要点 |
|---|---|---|
| `chart-gap.svg` | PASS geometry / OPEN identity | 缺口断线、`金额 —` 和全段缺失保留空间通过；页脚仍写 V2.3。 |
| `chart-hover--keyboard.svg` | PASS static | tooltip/十字线/完整读数无碰撞；键盘行为 NOT VERIFIED。 |
| `chart-hover.svg` | PASS static | tooltip 靠边避让、完整读数无裁切；hover timing NOT VERIFIED。 |
| `chart-scale--extreme.svg` | PASS | 末尾缺口、CNY 轴、日期标签无静态重叠。 |
| `chart-scale--normal.svg` | PASS | 常规金额轴、曲线、刻度和日期无静态重叠。 |
| `chart-scale--wide.svg` | PASS | 起始缺口、断线和轴标签无静态重叠。 |
| `chart-scale.svg` | **FAIL (spec)** | 几何通过，但 `2亿/1亿/0亿/-1亿/-2亿` 未按现行契约保留两位小数；需 owner 处理或明确例外。 |
| `period.svg` | PASS geometry / OPEN identity | 快捷期间、自定义日期校验、四项 KPI 与图表无静态重叠；页脚仍写 V2.3。 |

8 张源图保持未修改。8 张 `holding-option-A/B` 历史候选不在本轮修订范围。

## 23:25 四张 home preview 哈希

由 sharp 生成的完整 raster 尺寸是固定 `1280×2346` / `1440×2346`；没有改变浏览器 viewport。CUA 浏览器清单为空，因此这些是实际像素检查证据，不能声称 Chrome/IAB 验收。

| 候选 | SVG SHA-256 | raster SHA-256 |
|---|---|---|
| `home-1280` | `c4e341c1bb69ab5b0b658351529310451a47a71b305d5058ee8533a348d516c7` | `4a2bb0c192ce0a9d1f5fd7d3a6c59a131754e9b59ef373d8b67f364354da12c3` |
| `home-1440` | `bcb180ebf38b21725b082dd8f58a9c83eb030a20bb448e3e145e0418e9efdccc` | `c030b154481fb8e3279169da6fd948440d97a15f2614753e13ccc98d5cc422a7` |
| `home-history-1280` | `c3d295c1cc51ea4670be71e00f65bcda05a6fac6bedffa5843beba6768d44d2f` | `02bf38988a11b45e5abd259011369fffc57469143279ab43c56c889b9a9d7794` |
| `home-history-1440` | `70f7761ce6dacd22c91dc1e402705e8a95879c96530c8fc316b4680b4d1db3cc` | `959960a9e335bf58591a2816b604e63ed47d6023f3da56f8daa7cdc905c10db6` |

复制包同时保留 `evidence/history-SHA256SUMS.txt`，便于 root 串行验收时重新计算。

## 23:37 history 两图图例修复哈希

以下文件是 23:37:29–23:37:31 重新生成并独立查看的最新副本；23:25 的旧副本与旧 FAIL 仍保留在 `evidence/shared/`、`evidence/shared-rendered/` 及 `home-final-review.md` 历史段落中。

| 候选 | SVG SHA-256 | sharp raster SHA-256（非浏览器证据） |
|---|---|---|
| [home-history-1280](./evidence/shared-latest/home-history-1280.svg) | `f5a947389865e6beb51de583bdde47fc4dbd48dc822344a0906776fb83deba65` | [`649136459fe97960ad1c539c1cf7a15e7630c27ecb31a9e3f61d771d8961aaaf`](./evidence/shared-rendered-latest/home-history-1280.png) |
| [home-history-1440](./evidence/shared-latest/home-history-1440.svg) | `1d6dc464ffb34dfb02f92687929c8763d4279279c887884eae195cedb52a0e3c` | [`d91c4c64ecb9adffedec81e2ad4b39fe78d58efaf445b94dd1dfe0fd572ac5b6`](./evidence/shared-rendered-latest/home-history-1440.png) |

最新图例裁切见 `evidence/history-embedded-preview/home-history-1280-contribution-controls-latest.png` 与 `home-history-1440-contribution-controls-latest.png`；新 hash 清单见 [`evidence/history-latest-SHA256SUMS.txt`](./evidence/history-latest-SHA256SUMS.txt)。

复核后只读执行 `node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --check`，四张 home source 均报告 `already synchronized`；两个 history source SVG SHA 与上述最新 preview SVG 完全一致。

## 代表截图

- [home-1280 最新整页](./evidence/shared-rendered/home-1280.png) / [home-1440 最新整页](./evidence/shared-rendered/home-1440.png)
- [home-history-1280 最新整页](./evidence/shared-rendered/home-history-1280.png) / [home-history-1440 最新整页](./evidence/shared-rendered/home-history-1440.png)
- [home-history-1280 23:37 修复复核](./evidence/shared-rendered-latest/home-history-1280.png) / [home-history-1440 23:37 修复复核](./evidence/shared-rendered-latest/home-history-1440.png)
- [23:37 history 图例裁切 1280](./evidence/history-embedded-preview/home-history-1280-contribution-controls-latest.png) / [1440](./evidence/history-embedded-preview/home-history-1440-contribution-controls-latest.png)
- [1280 表格与工具](./evidence/history-embedded-preview/home-1280-top-table.png)
- [1280 当前贡献控件](./evidence/history-embedded-preview/home-1280-contribution-controls.png)
- [1280 历史 D10 卡片](./evidence/history-embedded-preview/home-history-1280-d10-cards.png)
- [关联筛选 detail](./evidence/independent-shared-review/detail-1440.png)
- [local-search-pages 原始 FAIL](./evidence/local-search-pages--clear.png) / [guarded 修复](./evidence/local-search-pages--clear-fixed.png)

## 未验证项

因本次 `cua.getState()` 返回 `apps:[]`、`browsers:[]`，没有真实浏览器 tab 可用；因此 Chrome/IAB 视觉复拍、点击/键盘/触摸、下拉展开/关闭、排序结果重排、checkbox 切换、tooltip、滚动锁定、返回导航、运行时错误恢复和真实持久化均明确标记 **NOT VERIFIED**。sharp raster 与 DOM/SVG 静态检查只证明当前候选的可见布局，不能替代 root 的独立运行时验收。

## 2026-10-22 8 张 chart/period 修复后复核

root 已将 8 张补审图稿的修复合入当前 source。历史 FAIL/OPEN 保留在上方 2026-10-21 段落；修复后的逐图 SHA、静态检查与证据见 [`chart-fixes-final-review.md`](./chart-fixes-final-review.md) 和 [`evidence/chart-fixes/current-source-static-check.md`](./evidence/chart-fixes/current-source-static-check.md)。

- `chart-gap.svg` 删除缺失区黄色斜向桥，保留垂直定位虚线与缺失提示；`chart-scale.svg` 亿刻度改为两位小数且零为 `0`。
- 7 张万轴图的可见 `20,000/15,000/10,000` 改为 `2.00万/1.50万/1.00万`，`5,000` 保留；`chart-gap.svg` 与 `period.svg` 页脚更新为 V2.4.1。
- `period.svg` 快捷期间同步为正文确认的 `本年/本月/本周`；metadata provenance 与 `<title>` 完整值未变。
- 当前 source 静态检查 **PASS**；当前 source 的 `period.svg` SHA 为 `4fbe2cdd0d411a25adc92c555784c09b82eabcd5927691edab01aca70e31b6d8`，其余七图 hash 见专项报告。全量截图是 sharp 栅格化，不是浏览器/CUA 证据；root 独立浏览器验收仍是最终运行时门槛。
- 全量 source/PNG SHA 清单见 [`evidence/chart-fixes-current/current-hashes.md`](./evidence/chart-fixes-current/current-hashes.md)。

