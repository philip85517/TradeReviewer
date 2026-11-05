# 策略台公共视觉规范只读审计

审计日期：2026-10-24。审计者：独立 shared audit agent，未实施图稿。触发：用户要求全部策略台图稿与公共库/首页 V2.5 对齐，特别缺失的侧栏图标；应用 `docs/agents/frontend-control-audit.md`。工作树 `/Users/zhoulin/.codex/worktrees/b387/TradeReview`；HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`；策略设计目录未跟踪、工作树 dirty。本文只读审计，唯一写入本文；不改产品、设计源或数据库。

## 范围及证据边界

范围：21 张 `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/images/*.svg` 的公共 shell/navigation/icons/colors/typography/button/input/table，三份实际生成器（base + library override + time/results override），V2.5正文和控件手册，以及当前应用公共源码。不能只修改 base：后两个 override 会覆盖其输出。

服务与数据：本审计未启动产品服务，不执行写流程；图稿为虚构静态数据。现有截图为浏览器阅读画布，一般原1440画布显示1100px；截图像素不能当作CSS视口。鼠标、键盘、模拟触控、物理触控和持久化均 NOT APPLICABLE（本次静态设计规范审计）。没有声称任何控件功能PASS。视觉证据是现有图稿截图阅读，不能据此宣布V1.2最终验收。

直接查看过的图片（相对策略根目录）：`evidence/01-library-final-top.png`、`02-compose-final-top.png`、`03-experiments-final-top.png`、`04-create-final-top.png`、`04b-select-strategies-v4-top.png`、`05-confirm-final-bottom.png`、`06-observe-v5-top.png`、`12-components-final-top.png`、`11-compact-v5-top.png`、`11-narrow-v5-middle.png`。共同可见：整页左轨除TR外空白、工具栏文字图标、密集小chip模式切换、部分56px嵌入标签日期框与36px外标签输入混用。

首页视觉参考：已直接查看 `docs/design-system/baselines/2026-10-22-homepage-v2.4.2/review-records/follow-up/independent-shared/evidence/history/current-home-history-1440-final-1440.png`，并核对当前V2.5 `source/images/home-history-1440.svg` 与V2.4.2同名源文件字节完全相同。参考中侧轨有5项图标+标签、当前入口底色与操作色，日期为日历图标。该旧截图中的徽章等历史内容不应机械继承；当前V2.5正文是语义权威。

## 权威来源与数值性质

- V2.5正文：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`。公共范围在30、79、520行；视觉token在83–107行；控件表524–536行；图标实现边界665行附近。
- 手册：同目录 `component-manual.html#全局对齐与内层尺寸`（107–108行）、`#图标按钮iconbutton`、`#分段标签segmentedtabs`、`#账户选择器select`、`#持仓数据表datatable`。12类96态，85适用11不适用；首页八行表、账户业务、唯一修复入口不强加其他页面。
- 策略正文 NAV01 114行：展开200px、折叠54px、顶栏48px，来源H04，明确“非首页72/64”。H04 `source/history/H04-2026-09-30-strategy-workbench-v1-integrated-design.md:83–85` 要求一份导航状态、用户主动切换、跨页不跳宽，200/54均须验收。
- 首页72px侧栏和64px页头在V2.5正文64–65行；79行明确其为首页布局，不是全站硬值。不能把54/200直接判错，也不能把64误说为导航宽度。
- 当前真实应用壳 `app/components/trade-review-workspace.tsx:5702–5777`，图标来自 `lucide-react`（15–25行）：LayoutDashboard、BookOpenCheck、BarChart3、Database、Workflow、Settings2，均`size={16}`。Menu/X用于窄屏菜单。当前策略按钮disabled/“未开放”；这是生产现实，不是设计图必须disabled。`app/globals.css:6254–6260`桌面宽度为`clamp(148px,14vw,208px)`，不是固定200或72；不要把历史运行样式当成V2.5设计token。
- V2.5图稿 `source/images/home-1440.svg` 用自绘24×24 SVG线性路径，正文附录明确这些分镜路径不是产品图标库；可用作设计图视觉来源，产品仍复用lucide-react。公共扩展可记录两者角色，不应临时找Unicode图标。
- 公共token：页面/面板/浮层 `#0B1019/#111A26/#162233`；边线`#283448`；正文/次级/弱提示`#E6EDF7/#A8B6CB/#71829B`；操作/焦点`#6CA8FF/#A9C8FF`；盈利/亏损/提醒`#53D7A0/#FF8592/#FFC66D`；hover/pressed `#1C2B42/#243B5C`；disabled文字/边线`#53647B/#202B3A`。`#EF7F89`仅贡献柱/图例负色，不是通用亏损字色。
- 字级：页标题24/32、模块18/24、图标题16/600（正文48行）、正文金额控件14/20、辅助轴12/16、主值28/34；tabular-nums只用于数字。小控件r6、面板浮层r8、焦点2px外描边。间距4/8/12/16/24/32。
- 图标按钮36×36命中、通用16px视觉；首页头搜索/筛选18px视觉/24坐标是例外。分段36px/14px；select36px且最小120、当前值左齐12px内距独立箭头；token/status24px（可操作token36命中）；表头40/数据48/分页48；数值表头与值共右界，动作36命中居中。

## 问题表（均为当前静态图稿 FAIL；不是运行产品故障）

| ID | 严重度/归属 | 实际 vs 预期与精确源 | 受影响图稿 | 修复建议/接受证据 |
|---|---|---|---|---|
| SH-01 | P1 / 共享shell | `build-artboards.py:84–96 chrome`与`build-time-results.py:88–97 opening`仅绘54px空轨+TR，没有首页/交易库/分析/数据/策略图标、当前策略态和折叠入口。参考截图与真实组件都有导航。 | 所有使用chrome/opening的整页（见清单）；局部裁片无须假加导航 | 同源生成共享导航，保留54/200/48策略契约；补当前策略态、默认、hover/focus与disabled语义；整页和扩展/折叠示意同源。独立查看同视口渲染，不只查SVG标签。 |
| SH-02 | P2 / 共享shell扩展 | NAV01明确200展开/54折叠及跨页面状态；当前21图只见折叠空轨，没有展开200的渲染证据，也没有真实折叠图标。 | 整页和11-responsive/compact | 保留策略尺寸为共享扩展，不改首页默认；补200展开参考与宽度不足/长名边界。不得声称200已视觉验收。 |
| SH-03 | P1 / 共享控件 | `base:51–56 pill`与`time:66–69 chip`统一24px/12px，却用于正文569行明确的SegmentedTabs（库/实验、图模式、检查区）。透明36命中不等于36px分段视觉；time chip甚至没有命中描述。 | 01、03、06、06-detail、08、09、11各版，向导状态按专属角色另判 | 拆SegmentedTabs与Badge/Token，分段36px/14px且留焦点空间；badge/token继续24px，禁止全局机械放大所有pill。对同一模式切换的布局预算重新比图。 |
| SH-04 | P2 / 共享输入 | base `field:66–71`及time `field:79–85`56px带框内嵌label，library `input36:32–39`和12组件稿却明确36px外label。 | 06观察/局部、08、09、11compact/narrow、时间字段局部 | 活动日期/选择器统一外label+36px输入；只读截止信息可作为“信息字段”保留复合布局，但必须去交互暗示并注明差异，不把56复合框谎称36输入。 |
| SH-05 | P2 / 共享icon/select | library `input36:38`、base `field:70`使用字体⌕/⌄；library:62/195/264将select当居中button，箭头附文字而非独立槽；base:180更多组合同类；库表:79用•••文字动作。V2.5:107,536以及手册108要求输入左齐独立箭头，日期日历SVG。 | 01、03、04b、06/detail、08、09、11compact/narrow；04日期缺日历 | 使用统一Search/Calendar/ChevronDown/Ellipsis等SVG（视觉16、独立槽）；当前值12px左内距，36动作命中；更多菜单单独36命中+名称。静态日期不加图标；叙述性箭头不必全替换。 |
| SH-06 | P2 / 共享状态色 | `build-library-forms.py:398–404` hover #34445A、pressed #1C2B3D、disabled WEAK；base button:61与time button:74也用#71829B禁用字。预期#1C2B42/#243B5C/#53647B。12截图中hover明显亮灰。 | 12-components；所有disabled按钮，06底部与08/09、11回放尤明显 | 集中公共状态token；修复源和独立override，保留disabled边线#202B3A；用同一控件四态并排截图比图。 |
| SH-07 | P2 / 共享表格 | library:321–334目标/实际仓位头值均start且13px，time compare_details:415–426三列数字均start；正文107/策略527要求共同右界14/20。 | 05-confirm、09-compare；其他数值列表应同查 | 建列定义rightAnchor/minWidth/overflow；数值和头均end，14px/tabular-nums，动作中心；按可见字形逐列比图，不能只凭x相等。 |
| SH-08 | P2 / 共享字体/密度 | library:75行高70、experiments:行高76、confirm:329–333行间40/底36且数值13；策略正文605却宣称数据行48，没有列明例外。两行身份有合理业务需要，不能直接压扁。 | 01、03、04b、05以及表类 | 单行遵循48，双行扩展按内容/行高注册如72或明确70/76理由；正文不要笼统48覆盖全部。13px正文和金额改14，辅助才12。保持信息完整与真实密度。 |
| SH-09 | P2 / 共享色义 | time:421用NEG #EF7F89为最大回撤普通数字。该色V2.5仅贡献柱/图例；普通亏损为#FF8592。 | 09-compare；time中其他NEG使用按图形/文字角色复核 | 回撤数字按普通亏损色RED；不要把贡献专色迁移为策略通用负色。复核不同组合颜色与盈亏颜色的含义并有文字区分。 |
| SH-10 | P2 / 共享Metric | base:185/time:134的摘要标签12px；策略正文116明确14/20标签，V2.5主Metric标签实例14。当前全幅大主值/细小标签层级不符自身契约。 | 06、08、09、11摘要 | 标签14/20、值28/34；连续四等分88px是策略扩展可保留，不必拆成首页四卡。金额右齐/中性、收益按正负。 |
| SH-11 | P2 / 共享金额呈现 | 06主值¥102,540.84、side_check ¥56,819.15以及多处本金保持完整值；策略正文330和V2.5要求金额万/亿两位缩写、详情/聚焦完整。输入本金可完整，但只读指标/表格不能无声明全部例外。 | 06、08、09、11，05只读金额；04编辑输入不机械改 | 区分编辑原值和只读格式化；金额formatter统一万/亿两位、详情完整；净值/百分比/单价不套金额规则。共享扩展有充分理由时显式记录，而非全局改规则。 |
| SH-12 | P2 / 共享图标题/正文 | base chart:103/106/110以18px画净值图标题，V2.5:48固定图标题16/600；截图06主图标题与右侧模块同级。base/time文本helper大量直接传13/11无语义角色。 | 06主图及其局部；其他图标题按role盘点 | 设page/section/chart/body/caption语义助手；图标题16、模块18，允许明确特殊角色，避免全局替换所有18或13。 |

## 不应机械复制或误判

1. 54/200/48有来源，72/64是首页布局。当前运行壳clamp尺寸与设计来源必须分栏描述。
2. 不复制首页“交易库12”旧徽章、唯一修复、固定八行、实盘范围、四卡模块顺序。V2.5正文451的普通交易库入口不显示待复盘徽章；历史SVG有徽章不是新的授权。
3. 保留策略连续摘要、320检查区、480包浮层、1240内容上限、四日期边界与回放业务状态，引用公共样式不等于同一页面结构。
4. 独立金额输入应完整；净值1.0254不是金额；组合身份蓝/紫不是盈亏色；三包角色青/蓝/橙可注册业务扩展，不是所有非公共色都错误。
5. 24px状态徽章/token合理；不能为修复SegmentedTabs把状态徽章、向导步骤指示、所有pill都改36。向导本身应独立角色描述。
6. 局部裁片不需要补整站导航；11-responsive为比较图，不要将组合画布尺寸说成真实响应式CSS视口。
7. 真实app/globals.css仍有另一套历史token/Geist字体，不应覆盖当前V2.5权威方案；本轮只设计对齐，不顺手改生产壳或开放策略入口。
8. 金额/表头和焦点应以最终字体渲染比图；旧截图只能诊断历史现状，V1.2更改后要新截图，不能复用本报告PASS。

## 21图版本绑定登记

下列为source静态普查全集，非鼠标执行全集。点击覆盖/尝试率/状态操作覆盖均N/A（静态设计审计）；未逐张直接视觉检查的图保留NOT VERIFIED。这里的source review不能当100%视觉验收。

|图稿|原画布|当前源SHA256|视觉证据边界|
|---|---|---|---|
|01-library.svg|1440×1000|`0c56cb6b6e0ae940fc04adba81e2ad4b39fa69d403f2fc055300da0411afbec2`|已查看现有截图；最终V1.2仍须新鲜复验|
|01b-package-management.svg|920×470|`66c00c066636c50a43c2f291226f252bb9aab58c585c55f8ccfaf7ee9c52d76b`|源码普查；直接逐图视觉NOT VERIFIED|
|02-compose.svg|1440×1000|`1773bae8fdbd65ab6190f318ab7eeb2863834d5d97e03bd185dcc40f2852e385`|已查看现有截图；最终V1.2仍须新鲜复验|
|03-experiments.svg|1440×1000|`00ed2256bb242b0fd0b207aef9a532cb0d0ce3f5f846287695aff305c0b0beda`|已查看现有截图；最终V1.2仍须新鲜复验|
|04-create.svg|1440×1000|`4262056f8d7f406634cc96192221b3defffd9a49a60c30b8d56344e686d44fc4`|已查看现有截图；最终V1.2仍须新鲜复验|
|04b-select-strategies.svg|1440×1000|`a4f862e5760e05dbb7ae6718a868e513716708c22640c26b0e6eecf4aba5198a`|已查看现有截图；最终V1.2仍须新鲜复验|
|05-confirm.svg|1440×1000|`4d2e18ca9da8b18d185de5a91c2ee5ee92fea232d0875664e55b4169eafd7570`|已查看现有截图；最终V1.2仍须新鲜复验|
|06-observe-status-detail.svg|920×360|`ebc080427911f409cec15fba5907a99a146d7172aa52020bfce49c235a6edd53`|源码普查；直接逐图视觉NOT VERIFIED|
|06-observe.svg|1440×1080|`c3a19740ff5f56f607b70b6d01e03da5160d0f48d0dfd6121385f9c28b75ebe7`|已查看现有截图；最终V1.2仍须新鲜复验|
|07-time-controls-detail.svg|920×360|`a924ce3d53c571c14de5f0cad069fad6110be764f41c956af0b07db558e2ea74`|源码普查；直接逐图视觉NOT VERIFIED|
|07-time-states.svg|1440×1010|`7fe05817f22ca748fa8698f3ce98a703d1ffe4b61fae524292386dd586dd279e`|源码普查；直接逐图视觉NOT VERIFIED|
|07a-t0.svg|920×720|`59d8b854c89003ab0cfc6ce4846efbb570a636a146b53e3efab98d20ebd8f86a`|源码普查；直接逐图视觉NOT VERIFIED|
|07b-first-day.svg|920×720|`71f6fa26a3a65cfca6d87ec321f5a72707dd1f8f49ead4455bbd16e72609af89`|源码普查；直接逐图视觉NOT VERIFIED|
|07c-lookback.svg|920×720|`3e222976f2e04594c62ee6e2d6801692e57abaee8b6a388ed6c0d122dfb807d8`|源码普查；直接逐图视觉NOT VERIFIED|
|08-results.svg|1440×1410|`f050ee51e37f63ecc884a74919526df7c8e4b39abda6285931727b567960ad31`|源码普查；直接逐图视觉NOT VERIFIED|
|09-compare.svg|1440×1460|`d10aad7ff3f68141cfa5cd1cd3bc52bf8d45d8494b4f165666695d4c8aeebb32`|源码普查；直接逐图视觉NOT VERIFIED|
|10-states.svg|1440×1000|`35136e36a30190e7acf7a5abe3ecb9c5e04eb44160756d9c83ad1a8125dbb519`|源码普查；直接逐图视觉NOT VERIFIED|
|11-compact.svg|1280×1000|`793ea7ceaee42c6e9935410952fe1c5d51b47d12ea4142766dd05b63f563e208`|已查看现有截图；最终V1.2仍须新鲜复验|
|11-narrow.svg|390×1600|`0a165a0cc4bf96434ff19d353564867a159d08fda8916b6f832d43c006d99053`|已查看现有截图；最终V1.2仍须新鲜复验|
|11-responsive.svg|1280×1320|`d7ba4e5ec969ff6cab33fe1a3fb3966f9c11207344e33d9594d54fae296a3bd6`|源码普查；直接逐图视觉NOT VERIFIED|
|12-components.svg|1440×1000|`05ad3dfa7ece5030062719f43003c6dda8e31d972324be421886fdb19112fb01`|已查看现有截图；最终V1.2仍须新鲜复验|

## 生成源内容指纹

- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/build-artboards.py`: `260711dd43302d6a3391978bf81868f9d7d0381eacc339186ad8a23a5b1774e8`
- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/build-library-forms.py`: `792276361a18627eeac09f715af222d001a21e8f7525d3fece5da64674a9b014`
- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/build-time-results.py`: `d688af1fc685cb653abd16f2bcfbf61451dfbf2101e44e0e5f3d8f3fdbf5ac71`
- `docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/visual-design.candidate.md`: `a4fdb7157297eaa16248c6638a6bf3420cc7f7c920b194935f85c902e2a81da9`
- `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`: `daa1434e4437c340cbd23e38e15a7a34c31a892685ad7dfd1269ffe418605c22`
- `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html`: `1f532219fc78f52b8c9c7366aa4bf1b02d349fb43c3d0093311f7784bde246f0`
- `app/components/trade-review-workspace.tsx`: `608f67cf29284bad6c252ba4843b2bc20fe67e9ef43583247d88e8fdc729e74b`
- `app/globals.css`: `400d7b77c7d2c6e8600121ec9469a6143bc4a0176693062ea4ee0094fe8225e8`

接受门槛：本审计发现SH-01至SH-12；只静态来源/现有图稿判断，无功能修复或V1.2放行主张。协调者按最终内容指纹补21图新鲜独立视觉、导航两态、控件代表状态与适用窄屏。
