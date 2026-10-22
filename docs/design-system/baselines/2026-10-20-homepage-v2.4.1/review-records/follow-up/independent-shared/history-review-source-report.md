# History/contribution independent visual review

日期：2026-10-21（Asia/Shanghai）  
范围：当前 `history*.svg`、`journeys-year.svg`、`contribution*.svg`，以及为核对 D11 而只读比较的 `home-history-1440.svg`。本次按当前源文件逐张重新渲染并直接查看 19 张图，旧 hash、旧截图和旧 FAIL 结论继续保留在本目录，不能冒充当前证据。

当前静态结论：19 张当前图稿均已用真实 Chrome 1440px 原尺寸渲染并目视通过本次静态检查。年度选择器箭头在当前 hash 内，D10 正常宽度卡的 `64.3%` 与 `9 / 14 盈利回合` 共用基线且完整落在卡内。`journeys-year.svg` 当前图表区是明确的加载状态，因此本次只对其可见加载态、轴、卡片和选择器做静态检查，不把加载态当作已验证的年度数据交互。D11 整页静态图仍有 3 个 root-owned parity 差异，详见下文；运行时行为和数据库门保持 `NOT VERIFIED`。

## 证据方法

当前 19 张源 SVG 均由真实 Chrome headless 经本地 HTTP 服务渲染，主视口为 1440×1000；`home-history-1440.svg` 的整页截图为 1440×2346。逐图 PNG 保存在 [`browser/`](browser/)，当前源稿与截图 hash 在 [`SHA256SUMS.txt`](../SHA256SUMS.txt)。判断顺序是先直接查看渲染，再用源坐标核对边界；源码静态检查不能替代浏览器证据。

对照为 round5 的 `history.html` / `contribution.html` 及其 CSS/JS。1440px 原稿按原尺寸查看；1280px 文档容器用横向滚动查看完整画布，不能把容器裁切误报为响应式缺陷。

## 当前 19 张图逐图记录（2026-10-21）

| 当前源图 | 当前源 SHA-256 | Chrome 证据 | 状态 | 目视结论 |
|---|---|---|---|---|
| `contribution-current-a-share.svg` | `cf984c63…ceb528` | [`current-contribution-current-a-share-1440.png`](browser/current-contribution-current-a-share-1440.png) | PASS | 当前模式实心/中空段同一零线，标签、金额和页脚无重叠 |
| `contribution-empty.svg` | `26a2a002…a847872` | [`current-contribution-empty-1440.png`](browser/current-contribution-empty-1440.png) | PASS | 空态保留面板、标题、总计和说明几何，不伪造柱 |
| `contribution-error.svg` | `e4860b5d…47db51` | [`current-contribution-error-1440.png`](browser/current-contribution-error-1440.png) | PASS | 错误提示和重试按钮在错误面板内，未压到边界 |
| `contribution-extreme.svg` | `b25b1a1a…be4590` | [`current-contribution-extreme-1440.png`](browser/current-contribution-extreme-1440.png) | PASS | 极值正负示例均以零线为中心，长正柱和负值点未越界 |
| `contribution-historical-a-share.svg` | `528ab653…42d05` | [`current-contribution-historical-a-share-1440.png`](browser/current-contribution-historical-a-share-1440.png) | PASS | 历史已平仓只显示已实现贡献，行标签与金额列对齐 |
| `contribution-loading.svg` | `9a0ef1de…becd0` | [`current-contribution-loading-1440.png`](browser/current-contribution-loading-1440.png) | PASS | 加载骨架保持八行高度和面板内边距，不覆盖标题/状态 |
| `contribution-mixed-sign-demo.svg` | `50c353b0…11226` | [`current-contribution-mixed-sign-demo-1440.png`](browser/current-contribution-mixed-sign-demo-1440.png) | PASS | 正负实心/中空段从同一真实零线两侧展开，数值右缘稳定 |
| `contribution-states.svg` | `f6638fd6…728cf` | [`current-contribution-states-1440.png`](browser/current-contribution-states-1440.png) | PASS | A/HK/US 行共享市场和贡献列锚点，零值不制造假柱 |
| `contribution.svg` | `944bbbde…349b` | [`current-contribution-1440.png`](browser/current-contribution-1440.png) | PASS | 缺少估值显示“不可计算”，没有把未知值画成真零 |
| `history-stats-cumulative.svg` | `cb48191c…5b298` | [`current-history-stats-cumulative-1440.png`](browser/current-history-stats-cumulative-1440.png) | PASS | 累计曲线和真实零轴可见，图例/单位不重叠 |
| `history-stats-empty.svg` | `31373b67…6c6e6` | [`current-history-stats-empty-1440.png`](browser/current-history-stats-empty-1440.png) | PASS | 空态保留真实零轴和月份网格，提示居中 |
| `history-stats-error.svg` | `6cde268c…d897a` | [`current-history-stats-error-1440.png`](browser/current-history-stats-error-1440.png) | PASS | 错误提示位于绘图区中部，零轴和月份仍可读 |
| `history-stats-extreme.svg` | `d4656e46…ba840` | [`current-history-stats-extreme-1440.png`](browser/current-history-stats-extreme-1440.png) | PASS | 正负极值跨越零轴，刻度和端点均在卡片内 |
| `history-stats-rounds.svg` | `973fcff8…7b72` | [`current-history-stats-rounds-1440.png`](browser/current-history-stats-rounds-1440.png) | PASS | 回合数曲线保留零基线和月刻度，当前范围遮罩在右侧 |
| `history-stats-source-missing.svg` | `10809929…5722f9` | [`current-history-stats-source-missing-1440.png`](browser/current-history-stats-source-missing-1440.png) | PASS | 来源缺失提示使用不可计算语义，零轴与卡片结构保留 |
| `history-stats-win.svg` | `24974a7c…c38d5` | [`current-history-stats-win-1440.png`](browser/current-history-stats-win-1440.png) | PASS | 胜率曲线保持 0% 基线，端点和月份标签未越界 |
| `history.svg` | `71b47090…f153c` | [`current-history-1440.png`](browser/current-history-1440.png) | PASS | 月度曲线、零轴、右侧范围和四张指标卡完整 |
| `home-history-1440.svg` | `1d6dc464…a0e3c` | [`current-home-history-1440-final-1440.png`](browser/current-home-history-1440-final-1440.png) | PASS（静态位置） | root 四 home 合入后的当前源稿；整页只有一个底部历史贡献区，控件壳体与 D11 静态位置可见；不将运行时语义当作已通过 |
| `journeys-year.svg` | `3c4ef764…678677d` | [`current-journeys-year-1440.png`](browser/current-journeys-year-1440.png) | PASS（当前加载态） | 两个箭头在选择器内；D10 主值与计数共基线且计数完整；图表区显示“正在加载历史统计…” |

上述缩写 hash 仅用于表格可读性；完整 hash、视口和 PNG 绑定见 [`SHA256SUMS.txt`](../SHA256SUMS.txt)。每张图均为当前源 hash 对应的直接 Chrome 截图，没有用旧 worker 声明替代目视证据。

当前 `home-history-1440.svg` 在 root 四 home 合入后重新以 Chrome 1440×2346 渲染；当前源 `1d6dc464ffb34dfb02f92687929c8763d4279279c887884eae195cedb52a0e3c` 的截图为 [`current-home-history-1440-final-1440.png`](browser/current-home-history-1440-final-1440.png)，截图 SHA-256 为 `d6a1f7187ee7b38d19833b40e3e94a39f7607b0daf5abb0cbdf6d5856fbdb25e`。此前源 `32075a69…` 的 [`current-home-history-1440-1440.png`](browser/current-home-history-1440-1440.png) 保留为 superseded capture，不再绑定当前源。

## 历史 FAIL 与当前关闭状态

### F-HIST-01 — 年度展示方式箭头越过选择器右边界（历史快照，当前关闭）

旧源 `c0b8c5fab4f67518a95adc82a6f1692a718000904dfc234297e2593566084503` 的第二个 chevron 位于 `x=1376..1390`，选择器右边界为 `x=1384`；旧截图 [`journeys-year-selector-crop.png`](browser/journeys-year-selector-crop.png) 保留了越界事实。当前源 `3c4ef7647ecd9aaac3c446f190ac625b823b6d08b672cdb2f8d7426a5628677d` 的两个 chevron 为 `x=1192..1206`、`x=1306..1320`，边框右边界仍为 `x=1384`，当前截图 [`current-journeys-year-1440.png`](browser/current-journeys-year-1440.png) 直接确认两者均在内。当前 PASS。

### F-HIST-02 — D10 正常宽度卡计数右缘（历史快照，当前关闭）

旧源 `56b9c578ae05aa6bb7ef6342ee7438ee472de0d3a2dc24d378e15db3700d8bf8` 的 D10 文本以错误的起点方式从 `x=1026` 向右延伸，旧截图 [`journeys-year-latest-retest.png`](browser/journeys-year-latest-retest.png) / [`journeys-year-current-retest.png`](browser/journeys-year-current-retest.png) 保留了被 `x=1046` 卡边界截断的 FAIL。当前源 `3c4ef7647ecd9aaac3c446f190ac625b823b6d08b672cdb2f8d7426a5628677d` 使用右对齐计数，文本结束于 `x=1026`，距离卡右边界 `x=1046` 留有空间；当前 Chrome 图中完整可见 `64.3%` 与 `9 / 14 盈利回合`，共用 `y=157` 基线。当前 PASS。

当前 `journeys-year.svg` 的图表区是加载态，因而本次没有将尚未出数据的年度曲线声明为已验证。若 history owner 后续更换为数据态，root 应以新源 hash 重新保留一张数据态截图；这不重新打开已关闭的 D10 卡片布局问题。

## D11 整页只读交叉检查（root-owned，不在本次写入范围）

以下三项来自当前整页静态图稿的实际 Chrome 截图与 round5 实时贡献原型比较；本审查没有修改 `home*.svg`。静态 `contribution*.svg` 不因缺少控制行判 FAIL，因为正式规范把 D11 控制外壳交由 round5 原型承载。

### F-D11-01 — 当前模式的全局市场选择器是文本，没有批准的选择器面

`home-1440.svg` 的当前贡献区把“全局市场 / 全部市场”绘成普通文字，没有 28px visual surface、边框和独立下箭头。渲染局部见 [`home-contribution-current-1440-crop.png`](browser/home-contribution-current-1440-crop.png)；round5 的 36px 命中盒和内部 28px 面见 [`round5-contribution-live-controls-crop.png`](browser/round5-contribution-live-controls-crop.png)。

### F-D11-02 — 历史模式整页省略了应保留但禁用的“仅看未平仓”

`home-history-1440.svg` 的历史贡献区没有“仅看未平仓”控件；round5 历史模式保留同一位置的禁用 checkbox 与文字。历史整页局部见 [`home-contribution-history-1440-crop.png`](browser/home-contribution-history-1440-crop.png)，round5 控件见 [`round5-contribution-live-1440.png`](browser/round5-contribution-live-1440.png)。

### F-D11-03 — 整页静态当前模式的分类/未平仓样式仍不是 round5 D11 外壳

`home-1440.svg` 把“做多/做空/打新”和“仅看未平仓”画成圆角胶囊；round5 D11 使用 14px 下划线分段标签和独立 checkbox 命中区。该差异在 [`home-contribution-current-1440-crop.png`](browser/home-contribution-current-1440-crop.png) 与 [`round5-contribution-live-controls-crop.png`](browser/round5-contribution-live-controls-crop.png) 的同尺寸比较中可见。它属于 root-owned 整页图稿 parity；不把静态状态分镜因缺少控制行判 FAIL。

整页静态图的源哈希：`home-1440.svg` `729d6095050ae31be571a4327597cd46895fb1f84255dfd37e292502573c2eaa`，`home-history-1440.svg` 当前 root 合入后为 `1d6dc464ffb34dfb02f92687929c8763d4279279c887884eae195cedb52a0e3c`；此前 `32075a69…` 与其截图继续作为 superseded evidence 保留；round5 home reference `609c6e79bfb6268a16915d56841ab096f23422bcd5e5f999c23b34a238ddfba7`。

## 静态视觉合同通过项

- 历史正常、累计、胜率、回合和极值状态均保留可见真实零线；空、错误、来源缺失状态也保留零参考线而不伪造趋势。
- 贡献正负柱从同一真实零线两侧展开；真零不制造最小柱宽；中空/实心只表达构成，当前模式可见浮盈中空段，历史模式不混入浮盈段。
- 贡献空、错误、加载和缺少估值状态保持面板几何；缺少估值显示“不可计算”，未知不等于真零。
- 两张整页静态图都只有一个底部贡献区，当前/历史区块占同一位置；这只证明静态位置稳定，不证明模式切换、下钻和回源焦点恢复。
- round5 实时历史/贡献原型的选择器、零线、D10 正常卡和 D11 控制壳体在直接截图中未发现重叠；它们是对照证据，不替代静态整页的 root 验收。

## 未验证与交接

- 没有执行真实产品中的鼠标/键盘切换、焦点环、自然本周/本月/本年计算、历史范围请求失败/重试、贡献分类/排序/分页、标的详情下钻、返回上下文恢复或数据库持久化；这些门保持 `NOT VERIFIED`。
- 本次没有修改 history/contribution/home 源稿。F-HIST-01、F-HIST-02 仅在当前 hash 的静态几何上关闭；旧 FAIL 截图仍保留，不能改写为当前证据。若 owner 后续改动图表数据态，root 需用新 hash 重新生成对应截图。
- 本报告不宣布 V2.4.1 整体通过；root 仍需独立重建 `review-records/follow-up/build-gallery.py` 生成的 gallery.html，逐一复核正文引用的 106 图并完成集成验收。
