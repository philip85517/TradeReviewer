# E 细化样例独立验收

验收人：`/root/e_independent_acceptance`；未参与此样例实现，仅直接看图与只读审查源码。日期：2026-10-24。

**独立静态视觉与源码审查：PASS。** 已直接看图复核 1440 和 1280 四主态、1240 断点两侧、五类说明浮层及分布滚动终点，无阻断差距。真实鼠标、键盘和内存状态链由 root 另行记录，不能用本报告的静态视觉审查替代实际操作。

## 版本与边界

- 工作目录：`/Users/zhoulin/.codex/worktrees/cf84/TradeReview`，HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`。
- 当前候选：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-e-prototype.html`，SHA-256 `3b1068e9d156aa27af5a00cbaf676451dc492c38c0f47426b57a6cd3037c6025`。
- URL：`http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-e-prototype.html`。
- 范围：用户选定 E 后的七项视觉调整及保留样例状态模型；静态 fixture，无业务数据库、保存或生产导航。手机、触控生产版不属于本轮桌面样例契约。
- 触发：前端视觉修改后的独立验收，按项目 `frontend-control-audit.md` 执行。实现文件只读；三个历史 FAIL 文件与截图均保留，未用于当前候选的通过判定。
- 依据：[DESIGN-COVERAGE.md](DESIGN-COVERAGE.md)；主页 v2.5 `visual-design.candidate.md` 64–107、451、520–538；`home-1440.svg`；旧 E 的 `../de-prototype/screenshots/E-confirm.png`。

## 直接看图记录

| 对照 | 观察与边界 | 当前状态 |
| --- | --- | --- |
| 旧 E 与当前 E | 旧 E-confirm.png 实际 1440×495，是顶部裁切；当前 accepted 四主态 1440×1000。仅对共同顶部区域比较 E 的标题—相邻模式/页签—筛选—内容顺序。无返回首页、视角及 D/E 比较器；顺序保留。 | PASS |
| 全站侧栏 | 直接查看 reference-home-v25.png、site-reference.png 和补充的 reference-home-v25-1440.png；三图实际均为 1418×985，不能声称 1440 同尺度像素对齐。SVG 原始尺寸 1440×2346；72px 栏宽、56px 项高、24px 图标、64px 垂直节奏与 SVG 源坐标一致。参考仅作已说明缩放差异的图形和层级比较，准确尺寸以正文和 SVG 坐标校准。当前四态中 SVG 图形、标签、TR 及蓝色选择面一致；旧徽章按正文取消。 | PASS |
| 实盘列表/统计 | 直接查看 accepted-live-list-1440.png、accepted-live-stats-1440.png。全站深底，卡片表面与侧栏层级清晰，表头与数据列对齐；指标计数、胜率、费用为中性，盈利绿、亏损红。 | PASS |
| 模拟列表/统计 | 直接查看 accepted-sim-list-1440.png、accepted-sim-stats-1440.png。从次导航到工作区底部使用连续蓝灰底、内边及淡蓝顶线；页头和侧栏保持稳定。模式选中仍为同一种蓝色，没有紫色。模拟统计双行指标、回撤未知值、曲线与分布按原状态保留。 | PASS |
| 五类说明 | 直接查看 fee-help-1440.png、drawdown-help-1440.png、trend-help-1440.png、distribution-help-1440.png、prototype-help-1440.png。说明图标靠近对应指标/标题，文字可读；费用浮层在右边缘以内、底部样例说明向上展开；下滚后的分布可完整查看。截图证明展开结果，不证明 hover/键盘触发。 | PASS |
| 1280 四主态 | 直接查看 live-list-1280.png、live-stats-1280.png、sim-list-1280.png、sim-stats-1280.png。日期、模式、标签、身份、主值和表列没有挤压遮挡；实盘与模拟盘的全工作区层次差异在此宽度仍可辨。统计内容通过工作区纵向滚动查看，不通过缩字塞屏。 | PASS |
| 1280 浮层与底部 | 直接查看 prototype-help-1280.png、distribution-help-1280.png、sim-stats-bottom-1280.png。底部样例说明向上完整展开；分布浮层无视口越界；滚到底部可完整查看五组条形、频数及占比，固定工具条不遮挡最终内容。 | PASS |
| 1240 断点两侧 | 直接查看 live-stats-breakpoint-1239.png 与 live-stats-breakpoint-1241.png（均 800px 高）。实盘指标从 6×1 变为 3×2，保留指标顺序、字号和命中区；筛选行、模式/页签与侧栏几何不随指标换行跳变。图表随额外指标行正常下移，未横向溢出或压缩文本。 | PASS |

## 源码审查

只读检查当前候选的 fixture、render/bind、日期记忆、模式/页签及说明事件。当前 live 与 simulation 使用各自 rows/exercises 分支，不包含第三轮失败中实盘访问 exercises 的路径；切模式保留 page，日期按模式存储；收益分布单位只替换分布数据；刷新从 live/list/normal/rate 与默认日期初始化。说明采用统一模板、视口边界定位、单浮层显示、focus/blur、鼠标进入/移出、点击固定、Esc 与滚动/resize 关闭。

未发现阻断源码问题；以上为静态推导，实际行为必须引用 root 的浏览器证据。

非阻断观察：分布副行的“条长表示回合数”与浮层重复，但属于短图表读数提示，未恢复旧版底部长段落。不阻断本轮视觉样例确认。

## 门槛

| 门槛 | 状态 | 依据/责任人 |
| --- | --- | --- |
| 源码静态审查 | PASS | 本报告，未发现阻断回归 |
| 实际功能正确性 | NOT VERIFIED（本报告不执行） | root 真实浏览器操作证据 |
| 内存状态链 | NOT VERIFIED（本报告不执行） | root 模式/页签、日期、分布、预览、刷新测试 |
| 独立视觉对照 | PASS | 1440、1280、1239/1241、五类浮层与滚动终点；参考缩放限制已在表中说明 |
| 持久化/业务数据写入 | NOT APPLICABLE | 固定 fixture 的静态样例，无数据库写流 |
| 生产集成/用户确认 | NOT APPLICABLE | 本轮交付可确认的视觉样例；新模拟盘底色方案仍待用户视觉选择 |

## E01–E08 对应结论

| ID | 独立审查结论 | 具体证据边界 |
| --- | --- | --- |
| E01 | PASS | 两行 E 导航与相邻模式/页签保留，四主态直接比较 |
| E02 | PASS | 页头不含返回首页，四主态截图和源码共同确认 |
| E03 | PASS（静态展开视觉） | 费用、回撤、趋势、分布、原型说明五类浮层完整可读；真实输入行为见 root 浏览器记录 |
| E04 | PASS | 侧栏图形、顺序、宽度与垂直节奏按全站引用校准 |
| E05 | PASS | 可见界面无“视角”冗余标签 |
| E06 | PASS | 模拟全工作区低饱和蓝灰底、连续内边和顶部线；按钮选中色统一，无紫色 |
| E07 | PASS | 盈亏绿/红，中性费用/胜率/数量/未知值；两类分布盈利绿与亏损红 |
| E08 | PASS（源码审查） | 状态分支与保留规则无阻断缺陷；真实操作由 root 验收，不能以此行替代其证据 |

最终结论仅放行此固定 fixture 桌面样例的独立视觉和源码审查，不代表生产应用或整个站点验收。root 仍须签发真实功能、内存状态链和服务存活的最终接受记录。2026-10-24T12:51:22.808Z 的 `browser-evidence.json` 有 37 个 checks，但当时 `views` 为空；该证据缺口已于 2026-10-24T12:53:33.819Z 补齐，见下面复核记录，旧空数组未冒充有效几何证据。

### 补充证据复核：已补齐

直接读取 `geometry-evidence.json`，共 10 条：1440×1000 与 1280×800 的实盘/模拟盘×列表/统计四态，以及 1239×800、1241×800 的实盘统计。全部 DPR=1，均无 document 横向溢出；模式控件在全部 10 条中为 x=96、y=70.5、width=184、height=44 CSS px。1440/1280 对应四态的页头64px、侧栏72px、次导航58px、筛选75px和内容起点 x=96、y=140 一致；模拟模式只改变主区背景/内边线，实盘 `rgb(11,16,25)`，模拟 `rgb(17,30,44)`。这组真实浏览器只读几何补充支持导航稳定性的判定。截图像素尺寸与 CSS 视口仍分开记录，不以截图 API 缩放后的尺寸倒推布局。

直接读取 `fresh-console.json`：2026-10-24T12:52:40.500Z，全新 tab 17 的四主态分别渲染 11 条实盘记录、6 个实盘指标、6 次模拟练习、8 个模拟指标，`logs=[]`。旧 tab 12:45:23 的 TypeError 属于保留的第三轮失败版本，不归到当前候选。此次补充未修改实现，SHA-256 保持上文值。

补充结论：几何证据缺口 **已关闭**；当前独立源码及视觉审查仍为 **PASS**，无待补阻断项。本代理只复核 root 的实际操作输出，没有将其记为本代理亲自执行鼠标或键盘。


## 已直接查看图像的 SHA-256

本清单绑定本轮已查看的渲染图；图片来自 root 的浏览器截图，本代理未编辑图像。

```text
3997176563ef591e5ba69bc741110cf059ea5da6c00216f2db3eb0db0bad6adf  accepted-live-list-1440.png
7c2a33a84d02956f93e71971348432e0b651843ad4e17ef04c244037acd05635  accepted-live-stats-1440.png
fb912315670a2c97027287aeb016f61e8d00f62fca3689e705fd6662ea6d538f  accepted-sim-list-1440.png
eb61d68a77be94b73f9adc3e387d15f16ac327b584040c55635f57201f1323b0  accepted-sim-stats-1440.png
c8c36bb43e844c80be8d9477fce66c25064eca753538bb88efc0b7416539c77b  live-list-1280.png
63ec7587ffe9cfe220d38ee11a027b5ddf421840670dc625bf4aa3c69edfbe2b  live-stats-1280.png
fec09354ded053d0eb1da1917941a2a769fcd0fcbc1da64ea358a6c558131af4  sim-list-1280.png
bceddcd4c5fe0d1b10e8399ad515b57055585f156bb291c8e5b2ad650f4d8f94  sim-stats-1280.png
d873b15dc5ad064556e8d57a5f4e64890aa1a0f81b5a899b485e0fd0856abf4d  sim-stats-bottom-1280.png
d9880b16ef132f8ba6954b75608cb15d07af0d61f16ac2196ef6d5fc062b8127  fee-help-1440.png
0e2d505e5c4491ace2393e22681de9cf49739e86e41fdfa823aa84a8cbf3d3f0  drawdown-help-1440.png
1a893cc2dd8924d706b4cf9c1daf0ece998f07c1fbf576ba3c94696f8c2a7bb5  trend-help-1440.png
c0c0f629481191ba5cf7b601460e2290eaead29035a3cfc1fe0bbfa8ee04cd0c  distribution-help-1440.png
414edb5e811d38e230c16b63e7f7cb5f469579d9ce873ecbeb0568bf4e101a7b  prototype-help-1440.png
6659474d391b2b4e8164271c7005950344ae6a6d4e6c05e7cb1a07f5f0eb0616  prototype-help-1280.png
7ffeefccfe875073564a2646ab3bbfbad0d9f401b6817bf9ae28e720e7d52c5b  distribution-help-1280.png
60013c054263da89a283f62589d7921dde7a072383c6ef75385d633b121895f4  live-stats-breakpoint-1239.png
eea25e2a98130458569b89b0542885cb30532935276c14b1951368dd5b3f6eeb  live-stats-breakpoint-1241.png
e1d78631d21696bd15c011743b5d9cb0f75e8acf40c585e4031a550506981716  reference-home-v25-1440.png
```

补充证据 SHA-256：

```text
e54c426b9a63565e4e8a53f7d14c3448361400293719698ebe2edba45f75da98  geometry-evidence.json
a30f5cd4fedef41390baf4fac7429c6c165bfb1665800a0d0b75210bae499c50  fresh-console.json
```
