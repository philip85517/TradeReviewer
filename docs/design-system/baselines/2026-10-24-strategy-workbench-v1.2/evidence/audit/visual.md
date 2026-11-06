# 策略台当前源图独立视觉审查

- 审查者：audit_visual；未参与本轮图稿实现；不修复。
- 日期：2026-10-24。触发：策略台整体视觉与公共库/首页 V2.5 对齐；审查范围为当前 21 张 SVG。
- 参考：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`（公共章 I/II/VIII/IX）及 `source/images/home-1440.svg`。首页专属 72/64 栅格尺寸不直接强制套用策略台；下述导航问题基于完整性与视觉一致性，而非强制首页尺寸。
- 方法：先读公共规范，再在真实 IAB 浏览器直接打开当前 SVG，逐张查看 fullPage 截图。桌面 1440×1000，紧凑1280×1000，窄屏390×844；小尺寸局部图在1440视口按原始SVG尺寸查看，白色图外区域不是设计缺陷。三个响应式文件均直接看图，不能以没有溢出替代视觉判断。
- 当前源服务：`http://127.0.0.1:3094/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/images/`。
- 证据目录：`/private/tmp/strategy-audit-visual-evidence/`，21个同名PNG与 `reference-home-1440.png`，全部本次重新浏览器渲染。
- 排除：真实应用交互、键盘/触摸命中、动态焦点、持久化、回放执行正确性、数据库。本次是静态设计视觉审查，上述门禁 NOT APPLICABLE（静态设计范围）；不证明未来实现验收。
- 结论：视觉门禁 FAIL；1项P1、10项P2、2项P3。21/21画板直接查看；问题是跨图规则与局部实例的汇总，不宣称静态图验证了功能。

## 版次与旧证据限制

先前 evidence/*-final-*、*-v2-*、*-v4-* PNG 只用于找历史问题，不能作为当前源FAIL。当前已确认不再复现：01b归档toast遮挡确认按钮、04-create字段与卡标题重叠、02-compose复制/编辑选中状态矛盾、11-narrow检查区底部溢出。以下仅列本次当前浏览器可见问题。源码哈希和PNG哈希见末表；若修复后源发生变化，报告只绑定此版本，需重新截图验收。

## 当前问题

### V01 · P1 · 管理偏好中的两行文字重叠
- 画板：01-library；证据 `01-library.png`（管理偏好卡左上，约x120/y600）。
- 预期：区块说明和字段label各占独立行，至少依公共4/8间距保持可读。
- 实际：“展示偏好不会改变执行顺序或历史运行”与“当前列表”印在同一带，后者无法正常辨认。不是旧PNG遗留，本次直接当前源仍可见。
- 建议：重排副文案、当前列表label、值三层；按实际字体bbox校验，不能只改卡高。

### V02 · P2 · 导航壳缺项且同一导航重复
- 画板：01、02、03、04、04b、05、06、07系列、08、09、10、11compact、12；尤01/03。
- 证据：`01-library.png`、`03-experiments.png` 对 `reference-home-1440.png`。
- 预期：沿用公共产品壳的可识别站点导航；同一“策略库/我的实验”只有一个明确选中入口。
- 实际：54px轨道只有TR、整列空白，无首页/交易库/分析/数据/策略图标；01/03顶栏一组策略库/实验入口，页标题下再一组chip入口。大量纵向空轨道和重复层级使其像独立原型而非同站产品。
- 建议：复用公共导航图标与选中态；保留一处策略局部导航。可保留合理紧凑尺寸，但须明确授权差异。

### V03 · P2 · 产品画面常驻设计与实现解释，压低任务信息密度
- 画板：01、02、03、04、04b、05、06、07time-controls、07a/b/c、08、09、11compact/narrow。
- 证据：`02-compose.png`“包详情·480px覆盖层”、`03-experiments.png`整块“入口规则”、`07a-t0.png`底部“clip”、`08-results.png`“返回恢复筛选/滚动/R”、`11-compact.png`“折叠导航54/图净高320”。
- 预期：公共规范要求页面保留必要业务label、数据、动作；实现参数与状态契约归文档说明。07-time-states、11-responsive、12-components作为显式说明图的解释可保留，不一刀切删除。
- 实际：带产品壳的实际场景图中反复展示V/M/E/R、尺寸、clip与规则说明，长条说明卡占用首屏空间；相同身份、结束日、结果截止在多带重复。
- 建议：将工程解释移到图外注释；业务中保留用户可理解的“当前查看日/已展开至/结果截止”等必要标签与短提示。不可删除数据边界语义本身。

### V04 · P2 · 普通信息过量使用raised层与卡内卡
- 画板：01、02、04、04b、05、06、07系列、08、09、11compact/narrow。
- 证据：`04-create.png`、`04b-select-strategies.png`、`08-results.png` 对首页。
- 预期：公共#111A26作为普通模块，#162233为菜单/弹层等抬升表面；单层模块与分隔线表达结构。
- 实际：普通资金/区间/语义/摘要/回放栏大面积raised底；04b外壳→内卡→表头→每行选中卡多层；图表又有内外同边界卡。首页参考以安静的单层面板为主，策略显著更重、更碎。
- 建议：普通摘要回归module底；内组用标题/间距/分隔线；只对真实覆盖详情、选择浮层保留raised。

### V05 · P2 · 分段控件视觉尺寸与公共控件不符
- 画板：01/03局部导航；06、08、09模式；11compact/narrow图层与检查区；04系列步骤视觉需单独定义避免混作chip。
- 证据：`06-observe.png`、`08-results.png`、`11-narrow.png`、`12-components.png`。
- 预期：公共分段36px高、14px正文；chip是24px可视且36px命中，不可将所有模式切换画成chip。
- 实际：主要模式“回放观察/阶段结果/组合对比”、主图“净值/K线”、检查tabs均约24px高、12px字、逐项描边小胶囊；窄屏三模式与图层形成密集小控件，与首页36px分段明显不同。
- 建议：按语义使用公共分段/页签，重要模式用36/14；chip仅用于标签和轻量过滤。静态图不能证明隐藏命中区，实施时需另验。

### V06 · P2 · 文本字阶散落13px/11px，小控件字重偏重
- 画板：01、02、03、04、05、06、07a/b/c、08、09等。
- 证据：`01-library.png`小搜索图标、`05-confirm.png`百分比表、`07a-t0.png`日期边界；源码style可辅助定位。
- 预期：正文/表体/控制14px，辅助12px；标题24/区块18/图表16有明确分工。
- 实际：业务表体与日期摘要普遍13px，边界label11px；导航/模式为12/13且大量加粗。与首页正文14、辅助12的层级不一致，较长画板看起来密集但核心文字反而小。
- 建议：集中使用公共字阶；保留必要的次要元信息12，不把业务数值降成辅助级。水印不作为产品正文缺陷。

### V07 · P2 · 数字列未遵循字形右沿对齐
- 画板：01b-package-management、05-confirm、09-compare。
- 证据：`01b-package-management.png`引用数；`05-confirm.png`目标/实际持仓；`09-compare.png`比较明细。
- 预期：数字表头、单元格按可见字形右沿一致对齐，名称左、动作中。
- 实际：01b“引用数”表头从x368开始，4/2/1却在x368结束；05目标45.0/10.0及实际0/100以左沿对齐；09收益/回撤/费用的各列亦左对齐，长度不同更突出。
- 建议：为数值列定义固定右锚，表头同右锚；百分比/金额相同小数精度，并做当前字体渲染核验。

### V08 · P2 · 图标使用文字替身且搜索图标过小
- 画板：01、03、04b、06、08、09、11narrow等。
- 证据：`01-library.png`输入右端⌕、选择器文字附带⌄；`03-experiments.png`；`11-narrow.png`。
- 预期：公共16px SVG图标（搜索规范场景18），独立槽位、统一描边与基线；值左对齐，箭头独立右侧。
- 实际：⌕仅一个极小文本字形；“全部类型⌄/最近版本↓/更多组合⌄”将符号接在文字尾，字体决定形态；与首页清晰线性搜索/筛选/展开图标不同。
- 建议：复用公共图标路径，图标与文本分开布局；日期控件补一致的日期/展开识别。

### V09 · P2 · 控件矩阵悬停色偏离公共token
- 画板：12-components；影响后续所有沿用该矩阵的控件。
- 证据：`12-components.png`悬停按钮。
- 预期：公共hover #1C2B42、pressed #243B5C。
- 实际：悬停呈灰亮填充，源码fill #34445A；相较默认表面突兀增亮，矩阵与公共定义冲突。
- 建议：统一引用公共状态token，并对默认/hover/focus/pressed/disabled/loading成组比较；不要仅保留文字“hover”作为证明。

### V10 · P2 · 预览与确认混在同一产品帧，步骤状态不清晰
- 画板：05-confirm。
- 证据：`05-confirm.png`。
- 预期：四步流程每一帧有唯一当前步骤，确认帧选中第4步；若合并设计则同步流程定义与标题。
- 实际：顶端第3步仍高亮，画面同时呈第3步组合表与第4步确认卡，“确认创建”可见；已完成与当前步骤也同样蓝色描边，不能识别现在正在第3还是4步。
- 建议：补独立第3/4步状态，或明确授权合并流程；不以插入“第4步”文案替代当前状态。

### V11 · P2 · 实验列表行高显著偏离公共表格密度
- 画板：03-experiments；01-library双行表也应按内容校准。
- 证据：`03-experiments.png` 对首页持仓表。
- 预期：公共常规表行48，长内容可有明确双行变体；密度由信息量决定。
- 实际：实验每条基本单行，约76px行高，四条即占304px；紧接128px入口规则卡，空间主要给空白和说明而非列表。
- 建议：以48px基础行+必要双行变体统一，列表恢复清晰紧凑扫描；若业务确需大行则文档登记例外。

### V12 · P3 · 紧凑与窄屏图表重复标题及重叠边框层次
- 画板：11-compact、11-narrow。
- 证据：`11-compact.png`图左上“净值”模式下又“净值”；`11-narrow.png`标题“净值”右侧又选中“净值”，图内卡边框落在外卡内部形成重复框。
- 预期：图表标题描述对象（如组合净值），模式控件描述类型；图内plot无需第二个同宽圆角壳。
- 实际：标题与模式同文案，重复层级；两层圆角边框在窄屏纵向分割图轴/说明。
- 建议：标题用对象语义，去内plot壳，用一次module边框包裹完整标题/plot/轴。

### V13 · P3 · 异常状态示例将无需操作的状态画成动作按钮
- 画板：10-states。
- 证据：`10-states.png`“加载中→保留原页面位置”“数据滞后→等待更新”。
- 预期：可点击样式只表达可执行下一步；等待状态用状态文案/加载指示。
- 实际：“保留原页面位置”是系统职责却画成高亮主按钮；“等待更新”看似可点但没有行动含义，削弱公共控件语义。
- 建议：改为状态说明或有明确动作的“刷新/检查更新”，保留真实取消/返回操作。这里只判图示语义，未进行真实功能测试。

## 21画板覆盖与证据清单

每张均检查：布局/密度/层级、文字/颜色、控件/图标、图示状态；响应式画板另检查窄屏阅读顺序。下表的FAIL表示命中上述可见问题，不表示功能失败。说明图可保留工程注释。

| 画板 | 状态 | 主要问题 | 当前浏览器证据 |
|---|---|---|---|
| 01-library | FAIL | V01 V02 V03 V04 V05 V06 V08 | `/private/tmp/strategy-audit-visual-evidence/01-library.png` |
| 01b-package-management | FAIL | V07 | `/private/tmp/strategy-audit-visual-evidence/01b-package-management.png` |
| 02-compose | FAIL | V02 V03 V04 V06 | `/private/tmp/strategy-audit-visual-evidence/02-compose.png` |
| 03-experiments | FAIL | V02 V03 V05 V06 V08 V11 | `/private/tmp/strategy-audit-visual-evidence/03-experiments.png` |
| 04-create | FAIL | V02 V03 V04 V06 | `/private/tmp/strategy-audit-visual-evidence/04-create.png` |
| 04b-select-strategies | FAIL | V02 V03 V04 V05 V08 | `/private/tmp/strategy-audit-visual-evidence/04b-select-strategies.png` |
| 05-confirm | FAIL | V02 V03 V04 V06 V07 V10 | `/private/tmp/strategy-audit-visual-evidence/05-confirm.png` |
| 06-observe-status-detail | FAIL | V04 V05 | `/private/tmp/strategy-audit-visual-evidence/06-observe-status-detail.png` |
| 06-observe | FAIL | V02 V03 V04 V05 V06 V08 | `/private/tmp/strategy-audit-visual-evidence/06-observe.png` |
| 07-time-controls-detail | FAIL | V02 V03 V04 | `/private/tmp/strategy-audit-visual-evidence/07-time-controls-detail.png` |
| 07-time-states | FAIL | V02 V04 | `/private/tmp/strategy-audit-visual-evidence/07-time-states.png` |
| 07a-t0 | FAIL | V02 V03 V04 V06 | `/private/tmp/strategy-audit-visual-evidence/07a-t0.png` |
| 07b-first-day | FAIL | V02 V03 V04 V06 | `/private/tmp/strategy-audit-visual-evidence/07b-first-day.png` |
| 07c-lookback | FAIL | V02 V03 V04 V06 | `/private/tmp/strategy-audit-visual-evidence/07c-lookback.png` |
| 08-results | FAIL | V02 V03 V04 V05 V06 V08 | `/private/tmp/strategy-audit-visual-evidence/08-results.png` |
| 09-compare | FAIL | V02 V03 V04 V05 V06 V07 V08 | `/private/tmp/strategy-audit-visual-evidence/09-compare.png` |
| 10-states | FAIL | V02 V13 | `/private/tmp/strategy-audit-visual-evidence/10-states.png` |
| 11-compact | FAIL | V02 V03 V04 V05 V12 | `/private/tmp/strategy-audit-visual-evidence/11-compact.png` |
| 11-narrow | FAIL | V03 V04 V05 V08 V12 | `/private/tmp/strategy-audit-visual-evidence/11-narrow.png` |
| 11-responsive | FAIL | 说明结构图，仅继承导航壳V02；未把空plot当功能图 | `/private/tmp/strategy-audit-visual-evidence/11-responsive.png` |
| 12-components | FAIL | V02 V09 | `/private/tmp/strategy-audit-visual-evidence/12-components.png` |

## 版本清单

参考SHA256：`a1863fc7f0be221b4e6b25a3d5ad97abbe45758b01fbb5471c16a2f34dba3c6a`。当前任务HEAD为 `5a94ee3ff76e32993fe2c4791a83b40e877a7344`，设计目录为工作区未提交稿，以下以文件哈希为准。截图时间 2026-10-24T01:42:18.401673（本机）附近。

| 源文件 | 源SHA256 | PNG SHA256 |
|---|---|---|
| 01-library.svg | `0c56cb6b6e0ae940fc04adba81e2ad4b39fa69d403f2fc055300da0411afbec2` | `d4ea578bf8e9c636a63913c4696e9413a8de914239631d74111dc4800b94cc9c` |
| 01b-package-management.svg | `66c00c066636c50a43c2f291226f252bb9aab58c585c55f8ccfaf7ee9c52d76b` | `6507b7d212193a60e6a1b617d1ef94691e1c8ca79f3c9797f2d717f9a502e3bf` |
| 02-compose.svg | `1773bae8fdbd65ab6190f318ab7eeb2863834d5d97e03bd185dcc40f2852e385` | `433ba7d223d8d24304310aab31a2fd8a9ced781e736493594bd3f54907abde44` |
| 03-experiments.svg | `00ed2256bb242b0fd0b207aef9a532cb0d0ce3f5f846287695aff305c0b0beda` | `8db03acf2bc9867822d04b27f205c0d4f5f908ab1330a9e6d5c6f5cfe28d6738` |
| 04-create.svg | `4262056f8d7f406634cc96192221b3defffd9a49a60c30b8d56344e686d44fc4` | `16c8b0ff79ad349e66d88429a97c2b4453dc81178fa75840b9d35c3a360ac996` |
| 04b-select-strategies.svg | `a4f862e5760e05dbb7ae6718a868e513716708c22640c26b0e6eecf4aba5198a` | `748bf94ab1d9ea1891ab792677d61e26d1e17a00e33d55a8ee17fda355a48719` |
| 05-confirm.svg | `4d2e18ca9da8b18d185de5a91c2ee5ee92fea232d0875664e55b4169eafd7570` | `01a080efd63c9403d472207e44eeb0fa9cbf30a56dc178f535f22e04b84a2872` |
| 06-observe-status-detail.svg | `ebc080427911f409cec15fba5907a99a146d7172aa52020bfce49c235a6edd53` | `4a920dd61ce393066da6a0849e44fe9f28f42618297b8b05610027b713845f1d` |
| 06-observe.svg | `c3a19740ff5f56f607b70b6d01e03da5160d0f48d0dfd6121385f9c28b75ebe7` | `b94c56b56f1219ab4a0e88dccdee7f8b95960c872536ba229b2b99cf2a426228` |
| 07-time-controls-detail.svg | `a924ce3d53c571c14de5f0cad069fad6110be764f41c956af0b07db558e2ea74` | `5743e998405e8af74378fd706f21dbec9b63eda10a9f9a732b689042ac460c0a` |
| 07-time-states.svg | `7fe05817f22ca748fa8698f3ce98a703d1ffe4b61fae524292386dd586dd279e` | `c6a2b0c06ab7340d5bcecd1dae756aeb833a5763d0a6bfd6e2fce3593069a42f` |
| 07a-t0.svg | `59d8b854c89003ab0cfc6ce4846efbb570a636a146b53e3efab98d20ebd8f86a` | `f4890fee3a628a6443588185b93c71399ed6c583d0eeb1efd002b796719bdc6a` |
| 07b-first-day.svg | `71f6fa26a3a65cfca6d87ec321f5a72707dd1f8f49ead4455bbd16e72609af89` | `fcf04f11ee7731fbc2f5e0cd6a5af2e6a7d2b7d360a1aee747a1a82437286e04` |
| 07c-lookback.svg | `3e222976f2e04594c62ee6e2d6801692e57abaee8b6a388ed6c0d122dfb807d8` | `c92d5c6cf4e69b6aa7645901c8e0c1398da3a27f79877eddf6fc05081f6ee8d1` |
| 08-results.svg | `f050ee51e37f63ecc884a74919526df7c8e4b39abda6285931727b567960ad31` | `7dc0d018ed1dd61801655dfff96ed0806689be9ee266d27d040e50636ddd3d1c` |
| 09-compare.svg | `d10aad7ff3f68141cfa5cd1cd3bc52bf8d45d8494b4f165666695d4c8aeebb32` | `3d7b1bb73241f29d06c277da3857784642952b97e52f3ae3e162b00527726dd3` |
| 10-states.svg | `35136e36a30190e7acf7a5abe3ecb9c5e04eb44160756d9c83ad1a8125dbb519` | `ee4513cc642ec4acd8e06c2fd3aac9f3f1bb92183d261d1b9bc187b53068ae1c` |
| 11-compact.svg | `793ea7ceaee42c6e9935410952fe1c5d51b47d12ea4142766dd05b63f563e208` | `ddc466dffa687957f706706d76210eccc1413c5537e42028d06dde062705665a` |
| 11-narrow.svg | `0a165a0cc4bf96434ff19d353564867a159d08fda8916b6f832d43c006d99053` | `8c0a9823d1f4b216d99aa108adae3b2829bf0be25300e55973aa1affe068351c` |
| 11-responsive.svg | `d7ba4e5ec969ff6cab33fe1a3fb3966f9c11207344e33d9594d54fae296a3bd6` | `a5c1eebedfb5461352395d36126a398ae35d3cd6eeda03809db449062e4c2b13` |
| 12-components.svg | `05ad3dfa7ece5030062719f43003c6dda8e31d972324be421886fdb19112fb01` | `984da051202128d8624a30eda66bd6b9b0213b87727ea2b18216d09d61aa6c24` |

## V1.2独立复验要求

修复者提交冻结源及版本标识后，由本审查者重新直接查看全部21图/新增状态，并与首页参考同尺寸比较；逐项重开或关闭V01–V13。任何业务流程变更（尤其V10）必须由协调者对照批准契约决定，不可借视觉清理删减状态。截图无溢出不代表视觉通过；原FAIL与历史截图保留。
