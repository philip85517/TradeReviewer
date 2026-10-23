# HistoryChart candidate1 独立视觉复核

2026-10-23。审查人：`/root/chart_visual_independent`，未参与该组件实现。本报告只辅助 root 接受受控历史图叶子，不签署全页、功能、数据链或发布接受，也不自行改变正式轮次计数。

**本轮视觉结论：FAIL。** 已确认空范围缺少原参考的低干扰区域背景（VIS-HC-01，P2）。其余已看静态图的主要绘图层级、320px 卡高、轴单位、缺口语义和窄屏标签基本符合原稿或已记录的 root 局部适配。实际动效中间帧、部分读数状态及完整宿主仍为 NOT VERIFIED；静态通过项不能抵消这些限制。

## 触发、范围与版本条件

- 触发：HistoryChart 新增四模式、点位/缺口读数、状态与响应布局后的独立视觉验收，适用项目 `frontend-control-audit.md`、`ui-task-templates.md`。
- 已读：当前 `AGENTS.md`、项目 development-workflow / frontend-control-audit / ui-task-templates、`../ROOT-DISPATCH.md`、本目录 `AUTHORIZED-DEVIATIONS.md`，以及批准规格 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP05:349–395。
- 范围：纯受控叶子，四模式；15 个 fixture 的 1440/390 静态状态；40 年的 1280 与实际 SVG 759/760/761px 边界；一张极长读数窄屏图。15 个 fixture 主要为各期盈亏，并非四模式 ×15 状态的 60 组合全覆盖。
- 排除：整页模块排序、四张历史指标卡、年份选择器、历史财务计算/数据来源正确性、范围三处原子替换、真实持久化/返回、其它叶子、性能。叶子无 IO，数据库写验收为 NOT APPLICABLE（本范围没有写流程），不能外推为全页数据库通过。
- 本审查只读文件并直接查看截图；未开浏览器、执行交互、运行测试/build/bench/服务/DB/git。root 浏览器记录作为补充来源，不冒充本审查亲自操作。
- 已用只读 SHA-256 核对当前产品文件：

| 文件 | SHA-256 |
|---|---|
| `app/components/homepage-v25/history-chart.tsx` | `03b9825a52e797b795e6f163697d98acd658d9f2e3a2427747f0d66f0fc4fc5d` |
| `app/components/homepage-v25/history-chart.css` | `0db1c089e2d2522ce3a9e0755df6c47353e719f77cb760d4f2d7d2b652df9dfe` |
| `app/components/homepage-v25/history-chart.test.tsx` | `b1526865de7b34cea7a9465685baa5b6dbbcf7586638fec917fba112ffed0851` |

结论只适用于上述版本。截图与该版本的捕获绑定由 root 提供，本审查未重新捕获；源版本改变后需重开受影响项。

## 原参考、比较条件与证据目录

以下九张原参考 PNG 均已直接 `view_image`，不是只读标题或实现者描述：本目录 `references/history.png`、`history-stats-cumulative.png`、`history-stats-win.png`、`history-stats-rounds.png`、`history-stats-empty.png`、`history-stats-error.png`、`history-stats-source-missing.png`、`history-stats-extreme.png`、`journeys-year.png`。

原参考为 1440×1000；图表卡 x56/y214、1328×320，标题约 x80/y240、16px/600；绘图区相对卡 x84…1324、y66…276。图源为 SVG 派生参考，未携带浏览器 DPR 证据，按其声明 CSS 视口及 100% 尺度比较，不能推定其物理 DPR。原参考只省略宿主其它区域，不授权重排模块。

实际证据根目录均位于 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/continue-2026-10-23/`：

- **E1**：`final-leaf-review/`。直接查看 `history-{fixture}-{1440,390}.jpg` 共30张，以及 `history-mode-{period-pnl,cumulative-pnl,win-rate,round-count}-390.jpg` 共4张。补充矩阵 `history-matrix-1440.json`、`history-matrix-390.json`、`history-four-modes-readings-390.json`。
- **E2**：根目录的 `history-years40-boundary-{1280,873,874,875}.jpg` 共4张已直接看图。`history-boundary-1280-759-760-761.json` 文件名中的宽度估算偏2px，实际内容为 SVG 757/758/759；准确 760/761 见 `history-exact-svg-760-761.json`。871/872截图未看，不将 JSON 当作其视觉接受。
- **E3**：根目录 `history-long-reading-390.jpg` 已直接看图；`history-native-keyboard-390.json`、`history-long-lifecycle-390.json` 只作 root 交互记录补充。

实际 E1 是受控 harness，1440×1000 /390×1000、DPR1。桌面图卡 x56/y152、1328×320；窄屏 x24/y268、342×320。与原稿 y214 的差异来自 harness 没有上方四卡，不据此判定叶子错位，也不能据 harness 通过宿主排版。无临时读数时，下模块顶端均在卡底后24px。E2 为 1280/873/874/875×800，实际 SVG 分别1166/759/760/761px。

## 版本绑定的静态覆盖表

“PASS（静态）”只表示所列截图的可见视觉项通过，不包含触发与退出、数据正确性或动画。下表每行均直接看过 E1 的 1440 与390两张图。

| Fixture / E1 文件中段 | 原参考/要求 | 直接观察 | 结论 |
|---|---|---|---|
| `standard` | history；单年语义月刻度、蓝色细线、小点、320卡 | 1440单行12月，390保留12月并两行交错；轴/线点层级清楚 | PASS（静态） |
| `gaps` | 默认及 source-missing；真实零、相邻状态不混同 | 零点可见；无回合琥珀、缺失棕色、未来中性灰、等待蓝、失败红的低对比带可区分；未见跨不可用段连线 | PASS（静态） |
| `pending` | journeys-year；旧数据保留空间 | 原曲线仍可见，蓝色原因在卡内状态带；主图与下模块不移动 | PASS（静态，root适配） |
| `error` | history-stats-error；旧数据失败 | 原曲线仍可见，红色原因在状态带；失败不伪造新范围曲线 | PASS（静态，root适配）；重试由宿主另验 |
| `longPending` | 长原因不挤图 | 状态带单行省略，曲线、轴和下模块不被挤动 | PASS（静态）；完整 AX/title 的实际可用性不由图证明 |
| `longError` | 同上且失败色不同 | 单行省略且为红色，与等待有区别 | PASS（静态）；完整 title 提示未直接查看 |
| `initial` | 首次等待不造曲线 | 没有金融曲线，中心等待说明；卡高保持 | PASS（静态）；过渡中间帧 NV |
| `firstError` | 首次失败不造曲线 | 无曲线，中心失败说明；文字未见截断 | PASS（静态） |
| `empty` | history-stats-empty；整段低干扰背景+空态 | 无假曲线，但只有默认深色绘图区和中心说明，原稿整段琥珀背景缺失；原稿月刻度也未显示 | **FAIL，VIS-HC-01**；轴范围语义见下文限制 |
| `invalid` | 不合法金额不伪造值 | 无假曲线，保留1月语义标签；静态图未展示详细原因 | 无伪曲线 PASS；原因读数视觉 NV |
| `long` | history-stats-extreme；大额轴保留可读性 | 单点和负数轴可见，轴文案没有越过卡片；出现 `-5.00e+20亿` 一类混合科学计数及亿的格式 | 空间 PASS；格式可读性观察项 VIS-HC-03 |
| `subunit` | 非零小额不全缩成0 | 科学计数的小额刻度彼此可辨，单点没有变成零 | PASS（静态） |
| `years3` | journeys-year；年粒度 | 1980/1981/1982 语义年标签，两视口单行；标题为每年净盈亏 | PASS（静态） |
| `years30` | 已授权密集年度策略 | 1440全30标签单行；390抽稀且保留1980与2009、两行，无可见重叠 | PASS（静态，root适配）；所有点键盘可达属独立功能证据 |
| `years40` | 已授权密集年度策略 | 1440全40标签两行；390抽稀并保留1980与2019、两行；蓝点仍覆盖全段 | PASS（静态，root适配）；实际两行与偏差文档的一行声称不一致，见 VIS-HC-04 |

四模式另行比较如下，不把上表各期盈亏的15状态外推为其它模式全状态通过：

| 模式 / E1 截图 | 原参考 vs 实际390 | 结论 |
|---|---|---|
| `period-pnl` | 标题每月净盈亏、金额单位、缺口、12语义月；同一320卡 | PASS（静态） |
| `cumulative-pnl` | 标题累计净盈亏；明确已知的无回合累计点仍可见，其它不可用段不造连线；金额轴缩写 | PASS（静态） |
| `win-rate` | 各期胜率，0/25/50/75/100%，固定0–100%；缺口独立 | PASS（静态） |
| `round-count` | 各期回合数，回合单位，0/3/6/9/12整数轴 | PASS（静态） |

四张390图的卡片、轴槽、绘图区和焦点矩形位置一致，未见曲线被读数遮挡。对应1440的四模式逐张截图不在本次直看集合，故完整四模式1440视觉为 NV；不能用390截图或矩阵补成 PASS。

## 边界、读数与层级

E2 的1280图保留全部40年，双行标签，320px卡。873/874/875图对应实际 SVG759/760/761，均为全部40年双行，首末年在卡内，未见断点处退回拥挤单行或突然抽稀。图上日期十字线与读数安全槽可见；这些图没有动效过程。

原稿的深色卡、细边框、小圆角、灰色辅助轴、蓝色细线与较小点的视觉层级在已看图中基本保留；零轴相对其它网格更清楚。实际右绘图终点相对原稿内缩12px为已披露的 root 局部裁定，并非精确重现原稿；本视口未见由此造成的重大密度差。

正常流读数是 root 批准的局部适配，不是用户原稿提示框尺寸已获批准的证据。E2 的873–875图显示读数在320px图卡下12px开始、宽度跟随卡片、明显延长历史区；800px视口只见读数上半部。E3 的390极长读数图显示完整来源金额按字串换行、主值仍较突出，主曲线未被盖住；读数的纵向长度远大于一般悬停提示，显著增加临时信息密度。截图在读数中部结束，不能视觉确认底部全部字段、下模块最终位置、滚动后可达或关闭恢复。此处未新增 P2，但保留“全读数及下游完整视觉”NV，由 root 的生命周期/滚动证据继续接受。

原生键盘记录说明 root 实际操作过省略年份、Home/End 与读数；本审查没有亲自操作，只确认其存在，不能把 AX 文本当成所有读数视觉截图。四模式1–6月原因/精确金额的每个完整读数画面、鼠标离开/键盘Esc的前后画面、触屏读数均未逐帧直看。

## 差距与独立结论

| ID / 严重性 | 原稿 vs 实际、证据 | 处理结论 |
|---|---|---|
| **VIS-HC-01 / P2** | `references/history-stats-empty.png` 的整段无回合绘图区有低干扰琥珀背景；E1 `history-empty-1440.jpg` 与 `history-empty-390.jpg` 为普通深色绘图区，只有中心空态文字。HP05明确无回合用区域背景区分。 | **FAIL**。当前 `AUTHORIZED-DEVIATIONS.md` 未授权去掉该语义背景。需修复后重新比对两视口；静态无假曲线不能抵消。 |
| VIS-HC-02 / 观察、需根范围裁定 | 原空范围图保留12月刻度，当前 `empty` 由空 points 得到且不显示日期标签。 | 已记录原稿差异；本审查没有范围元数据/父层契约的完整接受权，不据此断言金融范围错误。需要在真正空范围集成时证明可识别所选期间。 |
| VIS-HC-03 / P3可读性观察 | `long` 轴使用科学计数与“亿”叠加，空间未裁切，但需要连续解读两层缩写；原稿大额参考为较直接的万/亿刻度。 | 不作为新增阻断；超常天文金额 fixture 的可读性边界须如实保留，完整值显示由读数另验。 |
| VIS-HC-04 / 证据描述差异 | 偏差记录称1328-card40-year fixture保留单行；实际 E1 1440图、`history-matrix-1440.json` rows=2，E2 1280也为两行。 | 实际可读性按两行接受为已授权“单行放不下则两行”；不能继续宣称本浏览器实际为单行。没有据此新增产品 P2。 |

| 接受维度 / 对应 HC | 本审查结论 | 限制 |
|---|---|---|
| 静态视觉 HC01–10、HC15的可见布局 | **FAIL** | VIS-HC-01；其它已列图静态通过不改变总体失败 |
| 响应边界与320px图卡 | PASS（所看静态范围） | 1440/390的15 fixture、1280的40年、SVG759/760/761；其它组合不外推 |
| 临时读数 HC11–13 | PARTIAL / NOT VERIFIED | 长读数上半部和边界图可见；完整读数、所有状态、触发退出未由本审查直接操作/看全 |
| 动效 HC14，含150ms数据淡入、120ms hover、跨单位无路径形变、reduced motion | **NOT VERIFIED** | 没有实际中间帧/连续录像。静态初末态、CSS/测试或某帧偏暗都不能证明过程 |
| 功能正确性/真实受控最小旅程 | **NOT VERIFIED（本独立视觉审查）** | root的浏览器操作与独立测试为另一路接受，不能由本报告替代 |
| 完整端到端、真实历史范围与持久化 | **NOT VERIFIED** | 纯受控harness不代表宿主集成 |
| 全页视觉与最终交付 | **NOT VERIFIED** | 不在该叶子只读审查范围 |

本轮保留 FAIL 和必需 NV。root 应结合独立功能、状态安全与剩余实际视觉证据作正式叶子裁定；本报告没有签署候选或全页接受。
