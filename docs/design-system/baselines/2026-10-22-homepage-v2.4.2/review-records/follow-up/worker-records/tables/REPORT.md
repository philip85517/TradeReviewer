# D01 / D02 / D10 表格与持仓修订报告

日期：2026-10-21（Asia/Shanghai）  
执行者：tables（Luna 5.6 MAX）  
集成负责人：root

## 交付状态

本子任务范围已修完。23 张允许直接修改的 source SVG 已通过脚本修订；root 已执行共享脚本并合入四张 source home 与 source 样例板。root 的整页集成验收仍由 root 负责。

精确引用为 `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/visual-design.candidate.md` 的 HP04／HP11、`prototypes/round4/index.html` 的 D01／D10 区域，以及 `source/images` 当前图稿。覆盖矩阵见 [COVERAGE.md](./COVERAGE.md)，修订前哈希与图稿清单见 [inventory-before.txt](./inventory-before.txt)。

## 直接图稿改动

* 4 张 holding C 图（`holding-option-C-normal-*`、`holding-option-C-large-*`）：4 个可见金额表头的全角 `（CNY）` 改为半角 `(CNY)`；列位置、标题右侧摘要、搜索／导出和字号保持原布局。
* 18 张当前状态图（`holding-return*`、`count-*`、`50-items*`、`local-search-pages*`、`empty*`、`loading*`、`extreme.svg`）：旧的标题下方汇总移到标题基线右侧，市场值锚到 `x=400`，浮动盈亏锚到 `x=600`；分离的数值锚到 `x=456/710` 并使用既定 14px 数值层级；标签统一为 `持仓市值`／`持仓浮动盈亏`。loading／extreme 的合并未知值仍保留原状态文案和结构。
* `atom-datatable.svg`：四个面板的摘要分别移到 `x=400/600/1480/1680`，市场／浮盈表头统一为 `持仓市值(CNY)`／`持仓浮动盈亏(CNY)`，保留双列八态、行高和操作区。
* `holding-return.svg` 与 `holding-return--detail.svg`：详情卡与表格使用同一 fixture。数量读数为 `182.00`（无 CNY 单位），市值标题精确为 `125,337.94 CNY`，浮盈标题精确为 `9,431.24 CNY`，可见摘要仍按现有万位格式显示。

这些改动由 [repair_current_tables.py](./repair_current_tables.py) 和 [repair_holding_fixture.py](./repair_holding_fixture.py) 的精确锚点完成；两个脚本第二次运行均只报告 `already-current`，没有重复替换。

## 共享整页与样例板交付

最终可执行入口是 [apply_shared_tables.py](./apply_shared_tables.py)。它只处理 `source/images/home-1280.svg`、`home-1440.svg`、两张 `home-history-*` 以及 `source/images/visual-samples-board.svg`，不会修改打包 `images/*`。root 已执行 `--apply`；再次运行对全部 5 个目标均为 `already-current`。

四张 source home 的标题行摘要使用以下守卫几何：1280 为 `545/601/710/790`，1440 为 `705/761/870/950`（标签／值成对），值与标签间距分别至少 56px／80px，且 P&L 值到右侧搜索工具至少 220px。这样四字 `持仓市值` 不会与值重叠，也不会撞搜索工具。

样例板 D15 的共享变更为：`开仓` → `开仓日`，`平仓` → `平仓日`，金额表头 → `合计(CNY)`；可见金额为 `+1.20万`、`−600.00`、`+7,000.00`、`+1.84万`，四个 `<title>` 分别保留完整 `+12,020.00 CNY`、`−600.00 CNY`、`+7,000.00 CNY`、`+18,420.00 CNY`。D16 的 `60.0%`／`6 / 10 盈利回合` 与 `100.0%`／`1,000 / 1,000` 只作保留守卫，未改变 root 并行修订的胜率卡。

`shared-source-tables.patch` 在 root 合入后为空，这是预期的已应用状态；请以 `apply_shared_tables.py --apply` 作为可重复入口。先前生成的旧 `shared-tables.patch` 已删除，避免误把打包 artwork 作为共享补丁。

## 验证

静态验证命令：

```sh
python3 .scratch/homepage-v241-repair/work/tables/repair_current_tables.py
python3 .scratch/homepage-v241-repair/work/tables/repair_holding_fixture.py
python3 .scratch/homepage-v241-repair/work/tables/apply_shared_tables.py --emit-patch .scratch/homepage-v241-repair/work/tables/shared-source-tables.patch
python3 .scratch/homepage-v241-repair/work/tables/verify_tables.py
```

结果：23 张直接图稿均可 XML 解析；4 张 C 图各有 4 个半角 `(CNY)` 且无全角括号；标准图、atom 摘要锚点和 fixture 均 PASS；A/B 历史候选无 tracked diff；共享 home／样例板变换在内存中解析为合法 XML，D16 标记保留；最终输出为 `PASS all table/holding static checks`。

交付前对 `apply_shared_tables.py`、`make_preview.py`、`repair_current_tables.py`、`repair_holding_fixture.py`、`verify_tables.py` 做了无缓存 `ast.parse` 语法检查，5 个脚本均 PASS。

实际浏览器渲染使用独立新 IAB tab，未接管用户或其他代理 tab。静态服务器为 `python3 -m http.server 8765 --bind 127.0.0.1`，预览 URL 为 `http://127.0.0.1:8765/.scratch/homepage-v241-repair/work/tables/preview/index.html`。实际 viewport 为 `1280×720`，devicePixelRatio 为 1；8 个 SVG 均 `complete=true`，无 console warning/error。首屏、holding/C、atom、D15/D16 和剩余状态分别在多个滚动位置截图并通过 CUA 输出：

* 首屏观察到 home 标题行中的 `持仓市值`、值、`持仓浮动盈亏`、值同一基线，搜索工具仍在右侧独立空间。
* holding-return 与 C 图中表头及数值右缘保持一致，详情 fixture 与表格读数一致。
* atom 双列八态保留表结构，摘要和表头在同一标题区。
* D15 的 `合计(CNY)` 右缘、`+1.20万`／`−600.00`／`+7,000.00`／`+1.84万` 可见；D16 A／窄 B 的百分比和计数共基线。

子代理 IAB 只允许把截图输出到当前工具结果，不提供将 screenshot bytes 写入工作区的接口，因此没有伪造截图文件路径；viewport、滚动位置、图片加载状态和截图观察均记录在本报告与 COVERAGE 中。

## 未验证项与边界

* 本轮浏览器只使用实际 `1280×720` viewport；1440 宽响应边界和 round4 的独立 1440×1000 浏览器截图留给 root 的独立验收。source 1440 图已在静态 XML 和同一预览页加载，但不把它当作 1440 viewport PASS。
* root 已应用共享 source 脚本，但最终整页 `home*.svg`、样例板与其他代理并行图稿的统一视觉验收仍由 root 完成；本报告不替代 root 的整体验收。
* 本任务只涉及文档／图稿，不启动业务服务、不写数据库，也不宣称产品交互或持久化流程已验收。

## 页脚身份 follow-up

root 要求当前表格组的现行图稿统一页脚身份。我执行了 [update_tables_footers.py](./update_tables_footers.py)，只将以下四张允许直接修改的 source SVG 中可见的 `V2.3 · 设计状态图，非产品运行截图` 更新为 `V2.4.1 · 设计状态图，非产品运行截图`：

| 图稿 | 当前源 SHA-256 |
|---|---|
| `holding-return--after.svg` | `d8ec41af5b346f37f87b7422a18644b79e1f2024e452a7d9d3b01fd2579e69a7` |
| `holding-return--detail.svg` | `500d9ef4a7861796db36e086f152c3e56377679088a4dcaaae781b0c524dbb5a` |
| `local-search-pages--clear.svg` | `2294ed552ce1b67699dcc0c04ace9e0133c9a46e7804e7aaad9702596560cae1` |
| `extreme.svg` | `98617362bbae84d585dc15b876428db02c38fc2e0011be1fe3175d5ef7467db9` |

四张图均经当前源直接 Chrome headless 渲染并实际查看：[holding-return--after](./evidence/holding-return--after.png)、[holding-return--detail](./evidence/holding-return--detail.png)、[local-search-pages--clear](./evidence/local-search-pages--clear.png)、[extreme](./evidence/extreme.png)。脚本对非预期页脚计数会失败，对已更新图稿报告 `already-current`；当前四张各有 1 个 V2.4.1、0 个旧 V2.3 页脚。

全 source 目录检索仍有 `chart-gap.svg`、`period.svg` 保留旧 V2.3 页脚；二者属于 history owner 的 chart/period 范围，不在本 worker 的表格直接修改清单内，本轮未改，留给 root/history owner 处理。

## 共享图独立复核

按 root 后续要求，39 张 shared 图的只读逐图复核已完成，报告和 PNG 清单见 [independent-shared-review.md](./independent-shared-review.md) 与 [current-render-manifest.md](./evidence/current-render-manifest.md)。当前未发现日期控件/搜索工具栏与表头重叠、表头/数据列错锚或正文/手册不一致。另追加检查了 `history.svg`、`history-stats-cumulative.svg`、`history-stats-win.svg`、`history-stats-rounds.svg` 的零线和 metric 刻度；胜率与回合数均以 0 作为 y=490 高亮零线，25%/1 回合为普通网格，没有继承金额轴。
