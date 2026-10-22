# 共享图稿独立复核（V2.4.1）

日期：2026-10-21（Asia/Shanghai）  
复核者：tables（独立复核；不拥有 shared 图稿）  
基线：`docs/design-system/baselines/2026-10-20-homepage-v2.4.1`  
范围：`.scratch/homepage-v241-repair/work/shared/REPORT.md` 列出的 39 张 shared SVG。复核只读，未直接修改 shared 图稿、`home*.svg` 或 `visual-samples-board.svg`。

## 方法与验收口径

我按当前源图的 `viewBox` 逐张渲染，并实际查看了 PNG。`cua_repl` 在本任务中返回空的浏览器清单，因而使用已安装的 Google Chrome headless；首批通过 `http://127.0.0.1:3099/source/images/…`，动画/搜索尾批通过 `file://` 当前源图完成。完整清单、源图尺寸和 PNG SHA-256 前缀见 [current-render-manifest.md](./evidence/current-render-manifest.md)。实际截图视口跟随源图尺寸：1440×1000、1280×800、1100×1060、1100×910、1100×820、1100×760、1100×690 和 480×220；没有把 1440 静态稿误当作响应式重排。按 root 约定，静态图允许文档横向滚动。

复核对照 `source/visual-design.candidate.md` 的 HP04/HP11、§3.4–§3.7、§7.2–§8.5、§9.2–§9.5 和 §10.1，以及 `prototypes/round4/index.html`、已确认的 round5 原型：

- 日期工具区：日历图标、区间/年份语义、搜索或账户控件之间有明确间距；“全部”保持静态条件。
- 表格：工具栏、表头、数据区分带；表头与数据共享列锚点；数字右缘一致；动作命中盒保留 36px。
- 搜索：全局搜索覆盖底层页面，结果区独立滚动；持仓/交易库搜索仍是表内联过滤。
- 旅程：实盘按成交日保留未平仓成交，统计按回合平仓日；模拟盘保留练习身份与回合隔离；返回态保留来源语境。
- 状态：loading、empty、error、extreme、missing 保持原几何和可读性，不以缩小文字或删除交互换空间。

## 逐图结果

| 图稿 | 源视口 | 当前结果 | 具体复核 | 证据 |
|---|---:|---|---|---|
| `01-live-normal.svg` | 1440×1000 | PASS | 实盘日期/市场/排序工具区不重叠；表头、行数据和右侧动作列共用锚点，数字右缘一致。 | [PNG](./evidence/01-live-normal.png) |
| `02-simulation-normal.svg` | 1440×1000 | PASS | 练习日期、市场、排序和状态提示留有间隔；表格数据列未撞工具栏。 | [PNG](./evidence/02-simulation-normal.png) |
| `03-distribution-selected.svg` | 1440×1000 | PASS | 选中区间、统计和 1–8/8 表格保持独立带区；表头/数据右缘及 36px 查看动作对齐。 | [PNG](./evidence/03-distribution-selected.png) |
| `04-return.svg` | 1440×1000 | PASS（底部说明密度较高但可读） | 返回语境说明没有压住表格或分页；来源条件与表格列仍清楚。 | [PNG](./evidence/04-return.png) |
| `05-loading.svg` | 1440×1000 | PASS | 日期控件和 skeleton 区域不遮挡表头；加载态保留表格/统计几何。 | [PNG](./evidence/05-loading.png) |
| `06-empty.svg` | 1440×1000 | PASS | “全部”作为静态条件，空态面板与工具区分离，未伪造日期控件。 | [PNG](./evidence/06-empty.png) |
| `07-error.svg` | 1440×1000 | PASS | 错误/重试区未覆盖日期和表格带区；“全部”条件可读。 | [PNG](./evidence/07-error.png) |
| `08-extreme.svg` | 1440×1000 | PASS | 本年日期、长数值、表头、搜索/导出和动作列均无重叠；数值右缘一致。 | [PNG](./evidence/08-extreme.png) |
| `09-missing-input.svg` | 1440×1000 | PASS | 本月日期控件、缺失退出值说明和表格区分离；状态行未撞动作列。 | [PNG](./evidence/09-missing-input.png) |
| `account.svg` | 1100×760 | PASS | 账户选择器与空列表浮层宽度稳定，长账户名不撞边界；工具栏空间足够。 | [PNG](./evidence/account.png) |
| `atoms.svg` | 1100×1060 | PASS | 搜索 glyph、loading 省略号和账户空列表各自居中；原子控件无互相覆盖。 | [PNG](./evidence/atoms.png) |
| `filter.svg` | 1100×910 | PASS | 本地筛选弹层字段、日期/市场条件和底部动作区分带；无表头或搜索工具重叠。 | [PNG](./evidence/filter.png) |
| `handoff.svg` | 1440×1000 | PASS | 成交日/回合平仓日说明与返回区分离；来源条件与动作区域清楚。 | [PNG](./evidence/handoff.png) |
| `hcr06-final-pending-library-1280.svg` | 1280×800 | PASS | 1280 原稿中日期、账户、市场、待复盘搜索、刷新和表格仍有独立空间；成交日、标的、方向、价格、数量、状态、查看列对齐。 | [PNG](./evidence/hcr06-final-pending-library-1280.png) |
| `hcr06-final-pending-library.svg` | 1440×1000 | PASS | 桌面待复盘工具栏与表格列头/数据列共用锚点；搜索、刷新和状态徽标不重叠。 | [PNG](./evidence/hcr06-final-pending-library.png) |
| `hcr06-final-pending-return.svg` | 1440×1000 | PASS | 待复盘返回卡保留来源日期/市场/状态和焦点说明，未撞控件边缘。 | [PNG](./evidence/hcr06-final-pending-return.png) |
| `hcr06-final-replay-a1.svg` | 1440×1000 | PASS | 练习 A 回合 1 的标的、成交和返回身份层级清楚，卡片无重叠。 | [PNG](./evidence/hcr06-final-replay-a1.png) |
| `hcr06-final-replay-a2.svg` | 1440×1000 | PASS | 练习 A 回合 2 与回源身份可区分，回合卡内文字和动作无碰撞。 | [PNG](./evidence/hcr06-final-replay-a2.png) |
| `hcr06-final-replay-b1.svg` | 1440×1000 | PASS | 同标的再次练习 B 保持独立身份，回放/返回信息未合并或溢出。 | [PNG](./evidence/hcr06-final-replay-b1.png) |
| `hcr06-final-return.svg` | 1440×1000 | PASS | 首页返回条件、滚动/焦点语境说明与内容卡分离。 | [PNG](./evidence/hcr06-final-return.png) |
| `hcr06-final-rounds-a.svg` | 1440×1000 | PASS | 多回合表头“回合/开仓上下文/配对数量/净盈亏”和数据右缘一致；未闭合回合仍可读。 | [PNG](./evidence/hcr06-final-rounds-a.png) |
| `hcr06-final-sim-ab.svg` | 1440×1000 | PASS | 模拟盘日期、日历、市场、局部搜索和刷新空间分开；A/B 练习回合身份和表格列对齐。 | [PNG](./evidence/hcr06-final-sim-ab.png) |
| `journeys-date.svg` | 1440×1000 | PASS | 成交日/平仓日文字、日历图标和日期值在同一工具带；表头与数据右缘一致。 | [PNG](./evidence/journeys-date.png) |
| `journeys-pending-99plus.svg` | 480×220 | PASS | 99+ 徽标、待复盘状态和返回说明在小卡片内不互撞。 | [PNG](./evidence/journeys-pending-99plus.png) |
| `journeys-pending-normal.svg` | 480×220 | PASS | 普通待复盘状态和日期/返回语义均在卡片边界内。 | [PNG](./evidence/journeys-pending-normal.png) |
| `journeys-pending.svg` | 480×220 | PASS | 基础待复盘状态文字与来源关系可读，无卡片边缘重叠。 | [PNG](./evidence/journeys-pending.png) |
| `search--detail.svg` | 1100×690 | PASS | 全局搜索详情覆盖层、关闭按钮、结果区和返回语境分层；局部内容未撞边缘。 | [PNG](./evidence/search--detail.png) |
| `search--empty.svg` | 1100×690 | PASS | 空/失败搜索结果区与重试提示分开；覆盖层边界、关闭动作和输入区不重叠。 | [PNG](./evidence/search--empty.png) |
| `search-detail.svg` | 1100×760 | PASS | 详情四指标、数量/金额读数和查看交易动作共用列节奏；金额右缘一致。 | [PNG](./evidence/search-detail.png) |
| `search-empty-frame.svg` | 1100×820 | PASS | 空结果覆盖内框居中，未下推或遮挡底层页面；输入与关闭动作清楚。 | [PNG](./evidence/search-empty-frame.png) |
| `search-error-frame.svg` | 1100×820 | PASS | 错误覆盖、重试区和遮罩分层，工具栏与正文无重叠。 | [PNG](./evidence/search-error-frame.png) |
| `search-motion-after-frame.svg` | 1100×820 | PASS | reduced-motion 后态的结果框和输入焦点边界稳定；说明文字不撞结果。 | [PNG](./evidence/search-motion-after-frame.png) |
| `search-motion-before-frame.svg` | 1100×820 | PASS | 搜索聚焦前态的输入、遮罩和结果框有独立边界。 | [PNG](./evidence/search-motion-before-frame.png) |
| `search-motion-during-frame.svg` | 1100×820 | PASS | 加载中间态结果区仍保留覆盖层边界，加载提示未撞输入或关闭动作。 | [PNG](./evidence/search-motion-during-frame.png) |
| `search-motion.svg` | 1100×820 | PASS | 搜索开关/全局遮罩与局部表内搜索的语义说明分离，状态帧未重叠。 | [PNG](./evidence/search-motion.png) |
| `search-overlay-open.svg` | 1100×820 | PASS | 全局覆盖阻断底层页面，结果区独立滚动的边界和关闭命中盒清楚。 | [PNG](./evidence/search-overlay-open.png) |
| `search-overlay-reduced-motion.svg` | 1100×820 | PASS | reduced-motion 覆盖页保持输入、结果和关闭动作几何；无动画状态重叠。 | [PNG](./evidence/search-overlay-reduced-motion.png) |
| `search-result-frame.svg` | 1100×820 | PASS | 结果名称、代码、交易所身份与结果卡边界清楚；长名称未撞右侧动作。 | [PNG](./evidence/search-result-frame.png) |
| `search.svg` | 1100×690 | PASS | 全局搜索入口的 36px 命中盒、18px glyph、结果区和独立滚动说明均清楚。 | [PNG](./evidence/search.png) |

## Findings 与边界

本次 39 张当前 shared 图的静态视觉复核没有发现需要退回 shared owner 的日期控件/搜索工具栏与表头重叠、表头/数据列错锚或正文/手册不一致问题。当前可见版本页脚以源图为准；shared 图中已有的 V2.4.1 页脚保持现状，历史候选/冻结副本未纳入修改。

仍未验证的项目是交互行为：真实点击/键盘、Esc/外部点击、结果区滚动锁定、reduced-motion 设置、运行时筛选/请求错误恢复、回放推进、返回导航与刷新持久化。静态 PNG 只能作为视觉证据，不能替代 root 的功能和整页独立验收。`cua_repl` 无可用浏览器，因此没有声称 IAB 或真实运行时交互已通过。

## 代表证据

- [选中区间表格](./evidence/03-distribution-selected.png)
- [1280 待复盘库](./evidence/hcr06-final-pending-library-1280.png)
- [日期旅程](./evidence/journeys-date.png)
- [搜索结果框](./evidence/search-result-frame.png)
- [搜索详情](./evidence/search-detail.png)
- [全部渲染清单与哈希](./evidence/current-render-manifest.md)

## 历史胜率/回合数轴追加复核（只读）

按 root 的 follow-up 要求，我又检查了 history owner 当前修订后的四张正常历史图，重点是“零线高亮 25%”回归和把固定金额轴误带入胜率/回合数轴的问题。复核视口为 1440×1000，证据由同一套本地 Chrome headless 当前源图渲染；没有修改 history 源图。

| 图稿 | 语义轴 | 零线/刻度静态检查 | 实际渲染结果 | 证据 |
|---|---|---|---|---|
| `history.svg` | 每月净盈亏，CNY | 刻度 `1.50万/1.00万/5,000/0/-5,000`；0 在 y=440 且零线 `#A8B6CB`。 | PASS；正负点跨零线，未来区从 11 月起单独着色，未把未来接成实线。 | [PNG](./evidence/history.png) |
| `history-stats-cumulative.svg` | 累计净盈亏，CNY | 刻度 `3.60万/2.70万/1.80万/9,000/0`；0 在 y=490 且零线 `#A8B6CB`，没有负值刻度。 | PASS；累计曲线始终在零线上方，金额单位和“累计净盈亏”标题一致。 | [PNG](./evidence/history-stats-cumulative.png) |
| `history-stats-win.svg` | 各期胜率，百分比 | 刻度严格为 `100%/75%/50%/25%/0%`；0 在 y=490 高亮，25% 在 y=440 保持普通网格。 | PASS；胜率点落在 0–100% 区间，月轴和未来/空区语义清楚；没有金额刻度或 25% 假零线。 | [PNG](./evidence/history-stats-win.png) |
| `history-stats-rounds.svg` | 各期回合数，回合 | 刻度严格为 `4/3/2/1/0`；0 在 y=490 高亮，1 在 y=440 为普通网格。 | PASS；回合点使用整数刻度，未继承百分比或 CNY 轴；同一空区/未来区几何保持但单位已切换。 | [PNG](./evidence/history-stats-rounds.png) |

源码坐标复核也通过：`history-stats-win.svg` 和 `history-stats-rounds.svg` 各有 5 条水平网格线，0%/0 回合均绑定 y=490 的高亮线，25%/1 回合绑定 y=440 的普通线；两图没有固定金额标签（`CNY`）或负值金额刻度。当前没有发现需要退回 history owner 的轴语义问题。交互切换、键盘焦点和 hover tooltip 仍属于本报告的 NOT VERIFIED 边界。



## 12 张 authorized associated filter states 追加独立复核（2026-10-21）

按 root follow-up 要求，对 `work/shared/REPORT.md` 列出的 12 张关联筛选状态做了独立静态复核。复核对象为 shared owner 的当前 source；逐图的 source SHA-256 与 `work/shared/evidence/SHA256SUMS.txt` 一致。当前 CUA 没有可用浏览器，Chrome headless 新开复拍在本机以 134 退出，因此本轮没有声称新的一次浏览器采集；我复制并重新查看了 shared owner 的 1440px Chrome 证据，PNG 副本保存在 `./evidence/independent-shared-review/`，以 source 哈希绑定后逐图检查可见布局。所有 12 张静态图 PASS；没有需要退回 shared owner 的视觉 FAIL。

| 图稿 | 独立检查结果 | 具体检查 |
|---|---|---|
| `multi-applied.svg` | **PASS** | 草稿态 3 条条件、checkbox、字段/值和底部摘要各自分区，未发现筛选控件或表头重叠。 |
| `multi-applied--reopen.svg` | **PASS** | 已应用态 3 条条件、漏斗与计数、摘要行及重开后的控件间距清楚，未发现重叠。 |
| `clear-attachments.svg` | **PASS** | 清除前 checkbox 状态、条件值、清除入口和摘要行分离，未发现工具栏/表头碰撞。 |
| `clear-attachments--after-clear.svg` | **PASS** | 清除后空状态、提示和重置入口分区清楚，未残留旧筛选条件造成重叠。 |
| `reset.svg` | **PASS** | 重置前选中条件、checkbox 与摘要对齐；按钮命中区和提示区没有挤压。 |
| `reset--reset.svg` | **PASS** | 重置后条件清空、默认状态提示与摘要分离，表格/控件边缘未相撞。 |
| `cancel.svg` | **PASS** | 编辑态筛选面板、取消入口、状态说明和底部摘要层级清楚；未见取消按钮与字段重叠。 |
| `cancel--cancelled.svg` | **PASS** | 取消后关闭态与“Esc/外部点击”说明可读，返回后的摘要行没有覆盖。 |
| `error.svg` | **PASS** | 错误卡片、错误原因、重试/修复动作的间距和按钮边界清楚。 |
| `error--update-failure.svg` | **PASS** | 更新失败文案、重试/修复入口和错误状态层级清楚，未发现动作区互撞。 |
| `repair.svg` | **PASS** | 六条修复状态行的标签/状态/右侧动作列均在各自行内，按钮与正文没有重叠。 |
| `detail.svg` | **PASS** | 标题、搜索框、导出工具与正文分离；表头和数据右缘对齐，数量/成本价/市值/浮盈列没有错锚；右侧动作区未与数据撞位。 |

### 视口、日期与验证边界

- 证据采用 shared owner 的 1440×1000 浏览器截图；原始 SVG 的静态 viewBox 允许文档横向滚动，本轮没有把截图中的空白画布误判为响应式失败。
- 这 12 张关联图中没有日期控件；因此“日期控件与搜索工具栏重叠”在本子集为不适用。`detail.svg` 含搜索框与导出工具，已按上表实际检查并 PASS。
- 只有 `detail.svg` 含完整数据表格；其表头/数据列右锚已实际查看并 PASS。其他 11 张是筛选或错误/修复状态面板，不虚报表头检查。
- 真实筛选、清除、重置、取消、重新打开、错误恢复、详情打开/关闭、键盘/Esc/外部点击和运行时请求状态本轮均 **NOT VERIFIED**；这些不由静态 PNG 代替。

### 独立证据副本

以下 PNG 是本轮重新查看的逐图副本；文件名与 source 图稿一一对应：

| PNG | SHA-256 |
|---|---|
| [multi-applied-1440.png](./evidence/independent-shared-review/multi-applied-1440.png) | `96743c8b32b08f0a6c589f3fda09c74f3088cf31eadd75e4d654d3a359659438` |
| [multi-applied--reopen-1440.png](./evidence/independent-shared-review/multi-applied--reopen-1440.png) | `07b54ecf789ec114ddfd7ed216ba425659e859cd0d8eb4515fa7906d10636485` |
| [clear-attachments-1440.png](./evidence/independent-shared-review/clear-attachments-1440.png) | `7ff2981b82805eca5c5cd54747268f366e1ec65277db604b137f78e19385c8ac` |
| [clear-attachments--after-clear-1440.png](./evidence/independent-shared-review/clear-attachments--after-clear-1440.png) | `7e8d4abc3425f6a22afa7be4c4d2e00db9a237c733372de0dfff0035affa4ec0` |
| [reset-1440.png](./evidence/independent-shared-review/reset-1440.png) | `c4c6848e668b9eb919cad232fe164b95b5eb9f85b5b597fba925066effe16abb` |
| [reset--reset-1440.png](./evidence/independent-shared-review/reset--reset-1440.png) | `2ae9e3f81792c31e88de323fc3a3533a0a608d0899143dde352e0f0f1ad076fe` |
| [cancel-1440.png](./evidence/independent-shared-review/cancel-1440.png) | `8d9c211a0407e008b948ba558e8e791994d6952552848658d48a347053c126b9` |
| [cancel--cancelled-1440.png](./evidence/independent-shared-review/cancel--cancelled-1440.png) | `c754b0d1aa2a7efd116a84e795bc26d53d293f28aed38fac6d5bfc57e8dd7419` |
| [error-1440.png](./evidence/independent-shared-review/error-1440.png) | `7a68dbcaee6b4d36384f026ba83858f5e18193d2b4f617ccab2e29182d5b4919` |
| [error--update-failure-1440.png](./evidence/independent-shared-review/error--update-failure-1440.png) | `fe84b1626a31ffa3bf8c6ba51db34ad71de7e38a1a6d428429b039b07534e16f` |
| [repair-1440.png](./evidence/independent-shared-review/repair-1440.png) | `8ad91a0be3039708dcf821518eb4da2c9d7b482a212a3d3c77dd1da236b6772f` |
| [detail-1440.png](./evidence/independent-shared-review/detail-1440.png) | `c108812c22269f0dd5144e7283b247cfdcabda8ed48a36ccf05bdc02837ec45f` |


## Shared 39 图 follow-up：`local-search-pages--clear.svg` FAIL（2026-10-21）

root 反馈并要求复核的 shared 39 图问题已独立查看：当前 source SHA-256 为 `2294ed552ce1b67699dcc0c04ace9e0133c9a46e7804e7aaad9702596560cae1`。在 `translate(0,-1326)` 后，持仓卡片底边为 y=520、页脚 baseline 为 y=518；原始 Chrome 证据 [local-search-pages--clear.png](./evidence/local-search-pages--clear.png) 显示页脚贴压/触及底边，判定 **FAIL**。本图还存在同一底部区的分页摘要与页脚纵向间距不足，修复必须用实际渲染重新确认。

按照本任务“不得直接修改 shared owner 文件”的边界，我没有写回 shared source。已提供可审阅、只写输出副本的 [fix-local-search-pages-clear.py](./fix-local-search-pages-clear.py)：它先校验上述 source SHA，再把页脚 `y=1844→1838`（变换后 `518→512`），并把分页摘要 `y=1829→1825`（变换后 `503→499`），写入指定输出路径。使用该脚本生成的修复副本 source SHA-256 为 `1bdd2f4634e6cf614a310af0f57aacd8f88edb9190aed31c28e327f25ae2c828`，sharp 实际渲染为 1100×560 PNG，SHA-256 `7baeeeb5cb5cfa6aadc817924d1216dadabf4fef92dafa4342f1e8ceff2e29dd`：[fixed PNG](./evidence/local-search-pages--clear-fixed.png)，底部 crop：[fixed crop](./evidence/local-search-pages--clear-fixed-crop.png)。渲染复核中页脚与卡片底边留有可见间距，且不再与 `1–8 / 50 项` 互撞；该副本仍需 shared owner/root 将坐标正式合入源图后重新绑定最终 source/Chrome 哈希。

## 8 张 chart/period 补审（2026-10-21；此前 39/51 覆盖之外）

root 的覆盖矩阵指出，以下 8 张当前源图没有出现在此前 39 张 shared 清单、12 张关联筛选清单或本报告之前的 51 张证据中：`chart-gap.svg`、`chart-hover--keyboard.svg`、`chart-hover.svg`、`chart-scale--extreme.svg`、`chart-scale--normal.svg`、`chart-scale--wide.svg`、`chart-scale.svg`、`period.svg`。本段补齐了它们的只读静态视觉证据；8 张历史 `holding-option-A/B` 候选仍按任务边界排除。

`cua_repl.getState()` 返回空浏览器清单；本轮重新尝试 Chrome headless 时进程以 134 退出且没有输出截图。因此本补审没有声称 Chrome/CUA/真实交互证据。使用 `sharp` 从当前 SVG 以 `density: 72` 渲染，PNG 画布严格保持各源图 `viewBox` 尺寸；这属于静态 SVG 栅格证据。源 SVG 与 PNG 的完整 SHA-256、视口和证据链接见归档 [`chart-review-manifest.md`](./evidence/chart-review-manifest.md)。

| 图稿 | 画布 | 独立静态结果 | 具体验收结论 |
|---|---:|---|---|
| `chart-gap.svg` | 1100×1000 | PASS geometry；OPEN identity | 缺口断线、未知值 `—`、全段缺失保留空间均清楚，无重叠/裁切；页脚仍为 V2.3，需 current V2.4.1 owner 处理。证据：[PNG](./evidence/charts/chart-gap.png)。 |
| `chart-hover--keyboard.svg` | 1100×350 | PASS static；runtime NOT VERIFIED | 聚焦 tooltip、十字线、完整金额和边缘留白可见，无裁切；键盘 Tab/左右/Home/End/Enter/Esc 未实测。证据：[PNG](./evidence/charts/chart-hover--keyboard.png)。 |
| `chart-hover.svg` | 1100×350 | PASS static；runtime NOT VERIFIED | 悬停 tooltip 自动避让曲线/右下边缘，完整读数可见，无重叠；300ms/100ms 行为未实测。证据：[PNG](./evidence/charts/chart-hover.png)。 |
| `chart-scale--extreme.svg` | 1100×380 | PASS | CNY 轴、末尾缺口、断线和日期标签清楚，无静态重叠。证据：[PNG](./evidence/charts/chart-scale--extreme.png)。 |
| `chart-scale--normal.svg` | 1100×380 | PASS | 常规金额轴、曲线、五个网格刻度和日期标签无静态重叠/裁切。证据：[PNG](./evidence/charts/chart-scale--normal.png)。 |
| `chart-scale--wide.svg` | 1100×380 | PASS | 起始缺口说明、断线和轴标签清楚，无伪造连接线或静态重叠。证据：[PNG](./evidence/charts/chart-scale--wide.png)。 |
| `chart-scale.svg` | 1100×380 | **FAIL (spec)** | 几何无碰撞，但刻度可见为 `2亿/1亿/0亿/-1亿/-2亿`；当前曲线契约要求万/亿缩写保留两位小数，应由 owner 评估 `2.00亿` 等修正或补充明确例外。证据：[PNG](./evidence/charts/chart-scale.png)。 |
| `period.svg` | 1100×1100 | PASS geometry；OPEN identity | 快捷期间、自定义日期校验、四项 KPI、图表和 CNY 轴无重叠；页脚仍为 V2.3，需 current V2.4.1 owner 处理。证据：[PNG](./evidence/charts/period.png)。 |

本补审未写入 8 张源图；`chart-scale.svg` 的刻度精度与 `chart-gap.svg`/`period.svg` 的旧页脚是需要返给对应 owner/root 的具体问题。静态证据不替代 tooltip、键盘和日期应用/取消等运行时验收。
