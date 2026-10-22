# History 嵌入整页预览独立复核（V2.4.1）

日期：2026-10-21（Asia/Shanghai）
复核者：tables（独立审查；不拥有 history/shared 图稿）
范围：history owner 的 apply-shared-embedded.mjs --preview 产出的四张整页 SVG。只读复核，未执行 --apply，未修改 source/home*.svg、visual-samples-board.svg 或 history owner 脚本。
当前快照：脚本 mtime 2026-10-21 22:50:00；预览文件写入 22:50:17。history owner 正在调整 D07 标签，因此下述 D07 结论对应的是该时间点快照，脚本更新后必须重新 preview、渲染和复验。

> 渲染口径更正：shared 复核报告中的 39 张基础图使用 Google Chrome headless 静态输出；关联 12 张使用 shared owner 已有的 Chrome 1440px 静态证据副本。此文件所述最新四张 home preview（23:25 及后续同哈希重渲染）的 PNG 来自 sharp 栅格化，不是 Chrome/IAB 截图。`cua_repl` 无浏览器清单，因此本文件没有 CUA 交互验收。

> 更新说明（2026-10-21 23:02）：history owner 脚本已于 22:57:44 更新并重新执行 `--preview`；下面的“最新快照增补”覆盖 22:50 旧快照的 D07 结论。22:50 的 Chrome PNG 仍保留作历史证据，不能用来证明最新 D07 状态；当前没有可用 CUA/IAB 浏览器，Chrome headless 重新截图本次退出 134，因此最新四图另用 sharp SVG raster 作视觉核对，并明确标注为非浏览器证据。

## 对照与方法

对照：

- round4 D07：docs/design-system/baselines/2026-10-20-homepage-v2.4.1/prototypes/round4/index.html:17-18 与 evidence/d07-desktop.jpg。组合容器仅显示 2026 与 每月净盈亏，字段名只通过 aria-label 保留；同一个外框、分隔线和两个箭头。
- round4 D10：index.html:19 与 evidence/d10-desktop.jpg / d10-narrow.jpg。正常卡采用 A，窄卡采用右侧分组 B；主值与计数共享真实基线，不缩字号。
- round4 D11：index.html:20 及其 .filter-select、.check 样式。排序为 28px 视觉面、36px 命中区；“仅看未平仓”是独立 16px checkbox + 文本，不是胶囊。
- round5 D11/D12：prototypes/round5/evidence/contribution-all-1440.png、CONTRIBUTION-NOTES.md:3-5。单一排序控件与 checkbox 相邻；已实现为实心、浮盈变化为中空；历史模式移除浮盈段；中空段保持 14px 外包络。
- 现行 source 图脚及历史冻结副本未纳入本次修改范围。

使用 node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --preview 生成预览。22:50 旧快照的 PNG 曾由已安装的 Google Chrome headless 生成并保留；23:02 后 Chrome headless 复拍以退出码 134 失败，23:20/23:25 及同哈希重渲染的当前 PNG 改由 sharp 栅格化。未使用 CUA/IAB（当前浏览器清单为空）：

    --window-size=1280,2346
    --window-size=1440,2346

截图是源图完整高度的 1280×2346 / 1440×2346 PNG；另外保存了各自贡献区裁切（宽度 1088 / 1248，高度 610），只用于放大检查。静态 SVG 不足以验证真实点击、键盘、Esc、外部点击、排序/checkbox 状态或下拉菜单，因此这些交互均为 NOT VERIFIED。

## 逐图结果

| 预览图 | D07 | D10 | D11 | D12 | 独立结论 |
|---|---|---|---|---|---|
| home-1280.svg | FAIL；仍有可见“范围/展示方式”标签 | PASS；窄卡 B 无碰撞 | FAIL；排序仍实心蓝色 28px 面，“仅看未平仓”仍为 28px 胶囊 | FAIL；柱几何 PASS，但图例缺“实心/中空”语义 | 需 history owner 修 D07/D11/D12 图例后复验 |
| home-1440.svg | FAIL；同上 | PASS；正常卡 A 主值/计数同 y=145 | FAIL；同上 | FAIL；同上 | 需修后复验 |
| home-history-1280.svg | FAIL；同上 | PASS；窄卡 B 无碰撞 | 部分 PASS；已移除 checkbox（历史页不应展示未平仓筛选），但单排序仍为蓝色实心面 | PASS；只保留已实现实心柱，无中空段；图例语义仍只有“已实现” | D07/D11 视觉与 D12 语义需确认 |
| home-history-1440.svg | FAIL；同上 | PASS；正常卡 A 主值/计数同 y=145 | 部分 PASS；同上 | PASS；同上 | 需修后复验 |

### D07：组合选择器

当前预览四图的 history child 都生成同一结构：

- 1280 child：外框 x=838..1120、width=282、y=20..56。
- 1440 child：外框 x=998..1280、width=282、y=20..56。
- 可见项顺序为“范围 / 2026 / 箭头 / 分隔线 / 展示方式 / 每月净盈亏 / 箭头”。

round4 的确认结构是一个紧凑组合容器，两个 field name 通过隐藏 select 的 aria-label 保留，视觉上只展示“2026”和“每月净盈亏”。当前两个可见标签违反该约定，并压缩了两个值与箭头的可读间距。当前静态 raster 未见文字直接互撞，但这不消除视觉/语义 FAIL。最小修复：删除两个可见标签，保留统一外框、20px 分隔线、两个值、两个 chevron；字段名仍通过各自控件无障碍名称保留。修完后重新生成四张预览并重新绑定 hash。

D07 的展开、选择、按 Esc 关闭、外部点击关闭、跨年/单年自动模式均未验证。静态 child SVG 没有可操作下拉菜单。

### D10：胜率与计数

当前预览值与卡片几何：

- 1280 child 使用窄 B：卡 3 为 x=580,y=82,w=278,h=104；左侧 60.0% 与右侧“盈利回合 / 6 / 10”分别在 y=145 / y=130、145。
- 1440 child 使用正常 A：卡 3 为 x=666,y=82,w=321,h=88；左侧 60.0% 与右侧 6 / 10 盈利回合同为 y=145。
- 1280/1440 的卡间距均为 12px，卡内文字没有和边框、相邻卡或右侧计数碰撞。

这一项对 round4 A/B 的视觉要求为 PASS。没有缩小 28px 主值，也没有把窄卡的右侧两行计数压到主值同一文本行。交互或 tooltip 未验证。

### D11：排序、分类与 checkbox

当前表现页（home-1280/1440.svg）已经移除了第二个“亏损最大”视觉项，并保留一个“盈利最高 ↓”和 36px hit area；但仍有两项 FAIL：

1. 排序视觉面是 x=312,y=134,w=112,h=28 的蓝色实心/蓝边矩形，命中区为 x=308,y=130,w=120,h=36。round4/round5 要求的是外层 36px 命中区，内部 28px 视觉面（常态深色、箭头独立），当前选中蓝色实心面没有体现该扁平化 custom-select 表面。
2. “仅看未平仓”仍是 x=552,y=134,w=124,h=28 的整块深色胶囊，并保留 x=548,y=130,w=132,h=36 hit area；round4/round5 需要 16×16 checkbox + 文本，checkbox 与排序彼此独立。当前排序结束于 x=424，checkbox 胶囊从 x=552 开始，中间有 128px 空带，造成工具行的假性断裂。

最小修复：保留单一排序选项、chevron 和 36px hit area；将排序视觉恢复为 round4 .filter-select .custom-select-trigger 的 28px 内面/36px 外层命中语义；用 16×16 checkbox 加“仅看未平仓”文本替换胶囊，按 round5 .filters 的相邻 gap 放在排序之后，并保留独立状态与无障碍名称。历史页当前没有 checkbox，符合不混入未平仓筛选的历史模式方向；其单排序仍需沿用同一扁平化视觉。

D11 真实点击排序、checkbox 独立切换、键盘焦点和筛选结果重排均未验证。

### D12：实心/中空柱

当前表现页的中空段已通过脚本归一化为不撑大外包络的形状：

- 实心段仍为 y=293/365/437、height=14。
- 中空段为 y=294/366/438、height=12、stroke-width=2，外包络分别与对应 14px 实心段对齐。
- Chrome raster 中 A股、港股、美股的实心和中空段均在同一行、同一基线，极小负值的中空段没有撑高行。

当前表现页图例仍显示“已实现”“浮盈变化”，没有 round5 已确认的“已实现（实心）”“浮盈变化（中空）”身份提示，因此图例语义为 FAIL。最小修复：将两个图例文本补为“已实现（实心）”与“浮盈变化（中空）”，保留现有两枚颜色 token 和柱几何。历史页已经移除所有中空段，并只保留已实现图例，符合“历史移除浮盈段”；若统一身份文字，应使用“已实现（实心）”或等价历史专用说明，不能重新加入中空图例。

柱 hover title 的完整读数与错误/未知状态未由静态 SVG 交互验证。

## 预览 SVG 哈希

    c70d319c243913f72f28e9898dc6051991a9ef3801d523748d781efb644912e4  home-1280.svg
    2773fde1ab3537408d58934fa6f4f2e43dee05e93d8ad499de0a5681f1267eb5  home-1440.svg
    3a788fd3f690e0cb7915b02d0cd05ad42027f2e6b7be66828a7673add97aa647  home-history-1280.svg
    e3d919c25001c29e1371385d1e270cbeac38bd6545bdec8a51eae542bf0bff82  home-history-1440.svg

## Chrome raster 证据

完整截图：

- evidence/embedded-preview/home-1280.png — SHA-256 d9e96caadca46fb444637ef8dc479bc115bbf5f3765a8ca904c6586d1051bba5
- evidence/embedded-preview/home-1440.png — SHA-256 d7c907f1d1f102ec784a2cfa97f5ef3ceb0ff480a3cd2af73a359bf0511403ef
- evidence/embedded-preview/home-history-1280.png — SHA-256 ea2824affcdea0a94bba5c44e06213b67f889d554397ed87f55f484dfe49e931
- evidence/embedded-preview/home-history-1440.png — SHA-256 0a0b1fa3143fd772fa003e70fa0a481c4af371166a0e12c46d5d3fcfe4bc10d0

贡献区裁切：

- evidence/embedded-preview/home-1280-contribution.png
- evidence/embedded-preview/home-1440-contribution.png
- evidence/embedded-preview/home-history-1280-contribution.png
- evidence/embedded-preview/home-history-1440-contribution.png

## 交付状态

本报告只记录当前 preview snapshot 的独立审查结论，未宣称 history 整页通过。D07 标签、D11 checkbox/扁平化排序、D12 图例语义是具体退回项；history owner 更新脚本后需重新 --preview，更新四张 SVG 与 PNG hash，再由 root 做独立整页验收。

## 最新预览增补（22:57 脚本，23:02 写入；只读）

重新执行：

    node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --preview

脚本 mtime 为 2026-10-21 22:57:44；四张预览写入 23:02:03。最新 SVG 哈希：

    299164e963464612678691ea2f85dd2abee5b84bfcab1a0477760d6fa4c5f82  home-1280.svg
    33861a6264593d3425f2302c02d5600db1c1c4ee81179280f57b59a6f223e925  home-1440.svg
    5fe483658f137c2731be2494e2d9f322c6793f71a35180924efd2f5df2daf284  home-history-1280.svg
    178b74c23b7225f992e6341a468c841701b739ae6a9b649fe4693d91ffe8b72e  home-history-1440.svg

最新静态 raster 证据保存在 `evidence/embedded-preview-latest/`，由 sharp 按完整 SVG 尺寸生成（非浏览器）：

    bca2ef1fd32ea4f04e0e4d44499f97c0a265075f633c34754b8dc1d85a1e5405  home-1280.png
    6f9730ea49de6cf60a1b57e7e1ee060f4a4f1f55d911a6ed0ec98b5c0d9331ca  home-1440.png
    ff9e8c3ea45b74850ccbab5ee5ffbf77d20c8870cdd443026dff53edcba5efdf  home-history-1280.png
    30ade9ea8a5745b0885328b8092c729bd16c58f5b3b3b369efce150befb4eb41  home-history-1440.png

最新四图结果：

| 预览图 | D07 | D10 | D11 | D12 | 当前判断 |
|---|---|---|---|---|---|
| home-1280.svg | **PASS（最新）**；可见项只有 `2026` 与 `每月净盈亏`，字段名只在 `aria-label/title` | PASS；窄 B 共用视觉底线 | **FAIL**；当前页仍将“仅看未平仓”画成整块胶囊，排序仍蓝色实心面 | **FAIL**；当前图例仍只有“已实现/浮盈变化”，没有实心/中空身份 | 退回 D11、D12 |
| home-1440.svg | **PASS（最新）** | PASS；正常 A 主值/计数 y=145 | **FAIL**；同上 | **FAIL**；同上 | 退回 D11、D12 |
| home-history-1280.svg | **PASS（最新）** | PASS；窄 B 无碰撞 | **FAIL**；历史模式移除了“仅看未平仓”，但 round5 要求保留同位且 disabled；排序仍蓝色实心面 | **FAIL（语义）**；历史只保留实心柱，但图例仍未写“已实现（实心）/仅已实现（历史模式）” | 退回 D11、D12 |
| home-history-1440.svg | **PASS（最新）** | PASS；正常 A 共线 | **FAIL**；同上 | **FAIL（语义）**；同上 | 退回 D11、D12 |

D07 最新 raster 中组合外框仍为 282×36，两个值和两个 chevron 间距清楚；`aria-label="范围：2026；展示方式：每月净盈亏"` 保留无障碍语义。D11 的最小修复是采用 round5 的单排序 28px 视觉面/36px 命中区，使用 16×16 `#open-only` checkbox；历史模式保留该 checkbox 的同位结构但设置 `disabled=true`，不要隐藏。D12 的最小修复是当前图例改为“已实现（实心）”“浮盈变化（中空）”，历史图例至少改为“仅已实现（历史模式）”或等价明确实心语义，同时保持历史不绘制中空段。

## 最新四张整页预览独立复核（23:20 脚本；只读）

本次复核针对 history owner 在 23:20 更新脚本后重新生成的四张候选。未执行 `--apply`，未修改 `source/home*.svg`、`visual-samples-board.svg` 或 history 脚本。`node .../apply-shared-embedded.mjs --check` 仍报告 source 图待 structural history/contribution sync；以下结论只绑定 preview 候选，不替代 root 对最终 source 的验收。

时间与视口证据：

- 脚本 mtime：2026-10-21 23:20:34 +0800；四张 SVG 写入 23:20:58；四张 sharp raster 写入 23:20:59–23:21:00。
- 完整 raster 尺寸：`1280×2346`、`1440×2346`；整页 SVG 是固定 1280/1440 画布，允许文档横向滚动。本次未改浏览器 viewport；CUA `getState()` 返回 `apps:[]`、`browsers:[]`，因此本次不能提供实际 Chrome 证据，交互与浏览器渲染仍 NOT VERIFIED。
- 放大裁切证据在 `evidence/history-embedded-preview/`，包括四张 contribution controls、两张 D10 cards、四张 top-table。裁切只用于视觉放大，不替代整页哈希。

最新整页 SVG SHA-256：

    bf9ce415d5c61301869d4ba911c56a9360af0c4b94a6e79d0bde53c24894df57  home-1280.svg
    f07229165480e8ae56c4a511b7fea15f9d98ddb8bfe4df22e7068328245c76cd  home-1440.svg
    b54e97d9a304d9399f1334acd0b51e306681cc101c1b0d3bc14a3988d863782e  home-history-1280.svg
    02b7fc9275e39026cebbc0159d8c4b37bb88128a040ecbf50c5e51f6c67e8f34  home-history-1440.svg

最新 sharp raster SHA-256（非浏览器证据）：

    7734fbd7588a8e4ac32ca061a4b735296daaf2353139803f156871e2dc840e54  home-1280.png
    fe4f7caff062d805e2bf9a9dd9304be7a00d7c5a1af324999e35ee1be8f66e21  home-1440.png
    947b13e9178289b5e9de4dd3349b282a06b97ccd20c194db518a652d11274c40  home-history-1280.png
    0a024c1a4a4faf10b61577d066effcbe8cde73f39354b99642c320a774978455  home-history-1440.png

### 当前结论

| 范围 | 1280 / 1440 观察 | 结论 |
|---|---|---|
| D07 历史组合选择器 | 四图只显示 `2026`、`每月净盈亏`、分隔线和两个 chevron；field name 留在 `aria-label/title`，没有旧的可见“范围/展示方式” | **PASS（静态）** |
| D10 胜率与回合数 | 1280 窄 B 卡将“盈利回合”与 `6 / 10`置于右侧两行，主值 `60.0%` 仍 28px 且共用 y=145；1440 A 版计数与主值共 y=145；卡间距、边框和邻卡均无碰撞 | **PASS（静态）** |
| D11 排序/checkbox | 四图均为单一深色 28px 排序面、一个 36px hit area、一个独立 SVG chevron（`sortTextArrow=0`）；当前 checkbox 为 16px 空框、历史同位且 `aria-disabled=true`、填充灰色；分类三项与选中下划线保留 | **PASS（静态）** |
| D12 贡献图例与柱 | 当前图例为 `已实现（实心）` + `浮盈变化（中空）`，实心/中空柱同一外高；历史只绘制实心柱，未重新加入中空段 | **部分 PASS** |
| 历史金额轴 | 四图 `static-check.json` 的 `zeroY=470`；1500 tick 在 y=440，零线在 1500 与 −1000 之间插值到 y=470，并以 `#A8B6CB data-state="zero-line"` 强调，未错误高亮 1500 | **PASS（静态）** |
| D01/D02 表格、日期与搜索工具 | 完整 raster 与 top-table 裁切中，日期控件、持仓搜索/导出工具和列头/数据右锚点在 1280/1440 均无可见重叠或截断；列标题与数据保持同一右缘 | **PASS（静态）** |
| 字体/层级 | D10 主值 28px/600，卡内标签 14px，图表轴/表头 12px，贡献筛选 14px；裁切未见字塞入控件、溢出边框或异常缩放 | **PASS（静态）** |

### 仍需 history/root 处理的语义差异

round5 `prototypes/round5/contribution.js:67` 在历史模式将 `#floating-legend` 文本设为 `仅已实现（历史模式）`，并隐藏中空 token；当前候选历史四图直接移除了中空图例，只保留 `已实现（实心）`。这已经明确“实心”身份且柱几何正确，但没有复现 round5 的历史模式状态文字；按原型逐字一致性应标为 **D12 语义 follow-up/FAIL（需 history 确认）**，最小修复是把历史图例文案改为 `仅已实现（历史模式）`（保留绿色实心 token），或由 root 明确批准等价文案后更新验收记录。当前图例位置无重叠，问题是文案身份，不是布局。

### 证据索引

- 完整候选：`./evidence/shared/home-*.svg`、`./evidence/shared-rendered/home-*.png`。
- contribution controls 裁切：`evidence/history-embedded-preview/home-*-contribution-controls.png`。当前 1280 SHA `d561d620c4b36926e8b250c0765e3d5bf5c0627409290339efb7a85b37895550`；历史 1280 SHA `8b15e973937ca97130b1d557e6f7d1f7e1cb20cc522ac5603d160ddf15e68566`；当前 1440 SHA `4928c71be457aaecf69f49d6b52bcf98551b41b60d9a5a159b3b312e903fde9d`；历史 1440 SHA `f75d6d16d2a5923eab820a51e83d7979b2d1a12302a19629292c134a48d7bd8e`。
- D10 crop：`evidence/history-embedded-preview/home-history-1280-d10-cards.png` SHA `e2e3537bc3c976b81e134e2d22bd8491d61dfbd93ea6115ed2146b2f2eca02a7`；`home-history-1440-d10-cards.png` SHA `6c3a4070ab03509ff4cebc9dd1eb700cf2a7322f9064667b650e2bb9740f602c`。
- 表格/工具 crop：`evidence/history-embedded-preview/home-1280-top-table.png` SHA `c76840d3e7e1156f51430a138d90d5cbba8301ab399146965ea699eccfcf7588`；`home-1440-top-table.png` SHA `37aea20523eafe7a5ebf44c7097e93e3cb07fa1fee654726ada3872165451a55`；history 两尺寸与当前对应 crop 相同。

因此最新四图除“历史模式图例文案与 round5 动态原型不逐字一致”外，未发现新的表头、日期/搜索工具、D07、D10、D11、D12 柱几何或金额轴视觉缺陷。Chrome 最终验收、点击/键盘/下拉状态仍由 root 在可用浏览器后完成。

## 最新四图 23:25 重生成独立复核（只读）

history owner 在 23:25:17–23:25:19 重新生成 `evidence/shared/` 四张预览及 `evidence/shared-rendered/` 四张 sharp raster；本节覆盖此前 23:20 hash，旧结论和旧 hash 保留在上文。未执行 `--apply`，未修改 source/home*.svg、`visual-samples-board.svg` 或 history 脚本。

### 绑定信息

- 脚本 mtime 仍为 `2026-10-21 23:20:34 +0800`；预览 SVG 写入 `23:25:17`，raster 写入 `23:25:18–23:25:19`。
- 画布为固定 `1280×2346` / `1440×2346`；本次不改变浏览器 viewport。`cua.getState()` 仍返回 `apps:[]`、`browsers:[]`，故本批是 sharp raster 的实际像素复核，不宣称 Chrome/IAB 通过。
- `node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --check` 仍报告四张 source `pending structural history/contribution sync (no files changed)`；当前 hash 只绑定 preview 候选。

当前 preview SVG SHA-256：

    c4e341c1bb69ab5b0b658351529310451a47a71b305d5058ee8533a348d516c7  home-1280.svg
    bcb180ebf38b21725b082dd8f58a9c83eb030a20bb448e3e145e0418e9efdccc  home-1440.svg
    c3d295c1cc51ea4670be71e00f65bcda05a6fac6bedffa5843beba6768d44d2f  home-history-1280.svg
    70f7761ce6dacd22c91dc1e402705e8a95879c96530c8fc316b4680b4d1db3cc  home-history-1440.svg

当前 sharp raster SHA-256（非浏览器证据）：

    4a2bb0c192ce0a9d1f5fd7d3a6c59a131754e9b59ef373d8b67f364354da12c3  home-1280.png
    c030b154481fb8e3279169da6fd948440d97a15f2614753e13ccc98d5cc422a7  home-1440.png
    02bf38988a11b45e5abd259011369fffc57469143279ab43c56c889b9a9d7794  home-history-1280.png
    959960a9e335bf58591a2816b604e63ed47d6023f3da56f8daa7cdc905c10db6  home-history-1440.png

### 23:25 复核结果

| 范围 | 1280 / 1440 复核 | 结论 |
|---|---|---|
| D01/D02 表格、日期与搜索工具 | 持仓表的 `搜索持仓`/`导出` 与日期控件均在各自工具带；表头和数据右锚一致，长金额未撞查看列。两种画布没有可见截断。 | **PASS（静态）** |
| D07 历史选择器 | 组合外框只显示 `2026`、分隔线、`每月净盈亏` 与两个 chevron；`aria-label/title` 仍保留“范围/展示方式”无障碍语义。 | **PASS（静态）** |
| D10 卡片 | 1280 窄 B 中 `60.0%` 仍为 28px，右侧“盈利回合”与 `6 / 10` 分两行；1440 A 中计数与主值共基线；卡间距和边界无碰撞。 | **PASS（静态）** |
| D11 排序/checkbox | 四图均为单一深色排序面、一个 36px hit area、独立 chevron；无第二个 sort 文本箭头。当前 checkbox 16px；历史同位、`aria-disabled=true`、灰色填充；分类三项与选中下划线保留。 | **PASS（静态）** |
| D12 当前贡献 | 图例为 `已实现（实心）` + `浮盈变化（中空）`；实心/中空柱同一外包络，负值条不撑高行。 | **PASS（静态）** |
| D12 历史贡献 | 只绘制实心柱且无中空 token；图例文案为 `已实现（实心）`，没有 round5 `contribution.js:67` 的明确 `仅已实现（历史模式）` 状态字样。 | **部分 PASS；语义 follow-up/FAIL 待 history/root 确认** |
| 历史金额轴 | `static-check.json` 仍为 `zeroY=470`、5 条 tick；1,500 在 y=440，0 线插值到 y=470 并以 `data-state="zero-line"` 高亮，未错误高亮 1,500。 | **PASS（静态）** |

截图观察与结构检查一致：四张完整 raster 没有新增顶部表格、日期、搜索、卡片或贡献控件重叠。历史 D12 未把中空图例重新加入，当前待确认点仅是文案是否必须逐字匹配 round5 历史状态。点击、键盘、下拉展开、checkbox 切换、排序重排、tooltip 与真实运行时滚动/返回仍 **NOT VERIFIED**。

代表证据：

- `evidence/shared-rendered/home-1280.png` / `home-1440.png`
- `evidence/shared-rendered/home-history-1280.png` / `home-history-1440.png`
- `evidence/history-embedded-preview/home-1280-top-table.png`
- `evidence/history-embedded-preview/home-1280-contribution-controls.png`
- `evidence/history-embedded-preview/home-history-1280-d10-cards.png`

## 最新历史两图图例修复独立复核（23:37:29–23:37:31；只读）

history owner 已重新生成两张历史模式整页预览。本节关闭此前 23:25 的历史 D12 图例语义 FAIL；旧结论与旧 hash 保留在上文。未执行 `--apply`，未修改 source/home*.svg、`visual-samples-board.svg` 或 history owner 脚本。

### 绑定与哈希

- 两张 SVG 写入 `2026-10-21 23:37:29 +0800`；两张 sharp raster 分别写入 `23:37:30`、`23:37:31`。
- SVG SHA-256：

      f5a947389865e6beb51de583bdde47fc4dbd48dc822344a0906776fb83deba65  home-history-1280.svg
      1d6dc464ffb34dfb02f92687929c8763d4279279c887884eae195cedb52a0e3c  home-history-1440.svg

- sharp raster SHA-256（非浏览器证据）：

      649136459fe97960ad1c539c1cf7a15e7630c27ecb31a9e3f61d771d8961aaaf  home-history-1280.png
      d91c4c64ecb9adffedec81e2ad4b39fe78d58efaf445b94dd1dfe0fd572ac5b6  home-history-1440.png

- 最新副本：[home-history-1280.svg](./evidence/shared-latest/home-history-1280.svg)、[home-history-1440.svg](./evidence/shared-latest/home-history-1440.svg)、[home-history-1280.png](./evidence/shared-rendered-latest/home-history-1280.png)、[home-history-1440.png](./evidence/shared-rendered-latest/home-history-1440.png)。图例裁切为 [1280](./evidence/history-embedded-preview/home-history-1280-contribution-controls-latest.png) / [1440](./evidence/history-embedded-preview/home-history-1440-contribution-controls-latest.png)。
- 随后只读执行 `node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --check`，四张 source 均报告 `already synchronized`；history source 的两个 SVG SHA 与上述最新 preview 完全一致。

### 独立结果

| 检查项 | home-history-1280 | home-history-1440 | 结论 |
|---|---|---|---|
| D12 历史图例文案 | 绿色实心 token + `仅已实现（历史模式）`，单行 | 同左 | **PASS（静态，逐字匹配 round5）** |
| D12 柱几何 | 仅实心柱，无中空 token/柱 | 同左 | **PASS（静态）** |
| D07 组合选择器 | 仅显示 2026、每月净盈亏、分隔线和两 chevron；字段名仍在 aria-label/title | 同左 | **PASS（静态）** |
| D10 A/B | 窄 B 的 60.0% 与右侧“盈利回合 / 6 / 10”分行；无碰撞 | 正常 A 主值与计数共基线；无碰撞 | **PASS（静态）** |
| D11 | 单排序面/独立 chevron；16px checkbox 同位且 `aria-disabled=true` | 同左 | **PASS（静态）** |
| 金额轴 | `zeroY=470`；1,500 在 y=440，零线未误高亮 1,500 | 同左 | **PASS（静态）** |
| 整页视觉 | 新图例位于贡献控件下方独立一行，未撞排序、checkbox、市场选择器或柱区 | 同左 | **PASS（sharp 像素检查）** |

`static-check.json` 对两图均报告 `expectedRealizedLegend=仅已实现（历史模式）`、`legendRealized=1`、`legendFloating=0`、`hollow14=0`、`disabledVisual=1`、`zeroY=470`、`tickLines=5`。最新历史 D12 语义 FAIL 已关闭为静态 PASS。`cua_repl.getState()` 仍无可用 app/browser，因此 Chrome/IAB 复拍、点击、键盘、下拉、排序/checkbox 运行时行为继续 **NOT VERIFIED**。

