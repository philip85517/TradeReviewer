# R7 独立覆盖审计

2026-09-27；审查者 `gpt-6-astra / low`；只读产品与既有证据，不运行构建、测试或共用浏览器，不写数据库。整体 **未接受**。本报告的 pass 均限于明确证据覆盖范围；缺少可追踪证据不等于已复现产品缺陷。

已读当前 AGENTS、development-workflow、task-decomposition、批准需求与元素规范、DESIGN-COVERAGE、R1-astra-final-gate、R5-astra-final、R5-continuation、R6-integration、R6-astra-acceptance、R6-header-footer-fix、R6-plan-layout-fix，补读 R2-astra-recheck 与 R4-astra-review。独立打开批准 02/05/07 原图、R6-editor-filled-1440/390 和 R6-more-wheel-bottom-pass。使用准确文件，不用早期空输入 opaque 截图证明填字。

## 元素逐项账本

来源是 `docs/specs/2026-09-25-chart-first-review-ui-elements.md` §5 E01–E22 及 §3/6/8；画板路径均位于 `docs/designs/2026-09-25-chart-first-review/`。下表 R 报告均位于当前 reports 目录。root 是集成验收责任人；最终布局 owner 为 R6-header-footer-fix / R6-plan-layout-fix 中实现者。

| 元素 / 准确参考 | 已有可复用通过范围和证据 | 当前剩余范围 |
| --- | --- | --- |
| E01 / 02-chart-workspace.png | R6 前版已复现1280三层稀疏工具栏，不能保留旧“通过” | 最新紧凑顶栏待R7实际1440/1280/导航展开图和尺寸；源码修正非视觉通过 |
| E02 / 04-holding-stage.png | R1最终门禁：回早期双截止、来源保留、原构图恢复；下一决策不读晚草稿游标 | 新布局阶段导航可达/选中状态随最终视觉复核；不重开已闭合回放根因 |
| E03 / 02-chart-workspace.png | R2复审：13旧工具未删除、紧凑与更多互补，代码/46项定向测试范围 | 最新桌面36px、窄屏44px实际命中及键盘聚焦证据单列，不能由工具数量推定 |
| E04 / 02-chart-workspace.png | R1最终真实窄窗连续至64.89、首买whitespace、回早期；R5手动价窗、R6低价已知事实可见 | 最终footer/resize受影响简短复查即可；不要求重复全链诊断 |
| E05 / 03-structured-record.png | R6低价和右边缘live/retained标签分离，旧capture进入轴缺陷已关闭；R6 pre1280约14px沟槽局部 | R7最终布局轴/侧栏尺寸；真机键盘保持可见尚未验证 |
| E06 / 03-structured-record.png | 历史正常留存计划56/52/68，初始风险4000及后续修订分离；代码/领域证据可复用 | 精确输入→拖线→保存重开、做空/未知价格等若无现成实际记录，保持对应状态unverified，不把整行写pass |
| E07 / 04-holding-stage.png | R1同K600/400独立可点、边界正确及重开；R6低价成本碰撞与轴边capture均关闭 | 显示设置约束的既有测试/真实记录须链接；不再列旧已关闭marker失败 |
| E08 / 07-interaction-states.png | 独立看filled1440/390：32px完整中文、固定样式条、非穿透、shell在轴左；R5/R6旧A图文与新B隔离/真实导出A已闭合；R2新卡/legacy源码定向修复 | 真机IME/软件键盘不能由桌面填字证明；其余IME/拖动/legacy浏览器路径需挂实际记录，不把R2旧失败原样作为当前结论 |
| E09 / 03-structured-record.png | R5 Esc实际回到计划侧栏按钮；R1侧栏/视野状态契约已有证据 | 最终开合尺寸/44px和窄屏分区复核；数据未受纯布局修改影响可复用 |
| E10 / 02-chart-workspace.png | 原1280入场与方向同排违反明确E10；修正报告11测试/类型/lint通过 | 最新入场单行、止损目标双列、14px输入待实际画面；空方向不得自动填 |
| E11 / 03-structured-record.png | root既有规模三模式往返不归零已记录于当前矩阵/R6账本 | 缺基数、舍入提示的领域/实际证据分别链接；最终表单布局另验 |
| E12 / 03-structured-record.png | R6 pre1280资金来源默认折叠、未知基数不冒充比例；R6 More图显示明确参考资金/时点 | 展开长值及窄屏summary44px需最终证据，不从默认折叠截图推定 |
| E13 / 02-chart-workspace.png | R6 pre1280风险4000、3R及3:1解释、未知比例；领域计算历史证据 | 最终长数字可读性；缺项/做空等使用对应领域测试而非同一正常样例 |
| E14 / 04-holding-stage.png | R5/R6原计划只读、修订54/72与初始风险4000独立；真实部分持仓400 | 最终持仓默认层级/修订入口布局，不把只读数据源通过扩大成全部响应式 |
| E15 / 05-final-review.png | R5未知费用非0、未平仓已实现4776/浮动3288分列；R6 full/global重开6760/1.69R | 最终紧凑摘要及长内容首屏评价可达 |
| E16 / 05-final-review.png | R5逐次退出独立；R1同K决策身份，R6实际PPTX4776+1984=6760 | UI/重开独立性引用原真实旅程；相同日期领域用例不等于浏览器全覆盖 |
| E17 / 05-final-review.png | 领域及退出评价记录区分未知/未评价，未以目标价自动判错 | 最终选择控件44px/键盘证据；不能把未知费用状态代替未评价状态 |
| E18 / 05-final-review.png | R4源/10定向测试覆盖引用验证、旧missing保留、关联待确认；R5无退出仍有回合人工标签；R6导出冻结A | R4所列重导→待确认→确认、旧missing证据实际显示若尚无记录仍unverified；非新复现缺陷 |
| E19 / 02/04画板 | R1播放真实核心通过；R6手机横滚到留存/侧栏、44px局部通过；旧1280关键风险摘要已闭合 | 新390返回按钮/More预算与最终桌面底栏待R7；不能沿用旧四行窄按钮失败为修正后事实 |
| E20 / 07-interaction-states.png | R6 newly finalize→立即库1/1→reload1/1、full/post/global重开已关闭；bridge测试临时库安全已修复 | 保存失败/冲突保留本地输入属独立场景，须挂既有证据或保留unverified；最后数据摘要待root |
| E21 / 06-export-storyboard.png | R6真实fixed PPTX10页/3原PNG/7原生表格、0包错误，逐页LibreOffice及render equivalence；auto草稿holding哈希闭环；正式未被改 | 当前改动未影响导出无需再渲染；缺阶段草稿/附录具体范围挂原证据；原生PowerPoint未设备验不得声称其通过 |
| E22 / 06-export-storyboard.png | 独立看More桌面末条全局总结/编辑可见；root真实滚轮scrollTop988.5且点击后正确post/full；collapsed hidden/display:none已记录 | 最新390、1280、导航展开More记录滚动/返回入口仍待R7；旧桌面不可达失败应标已关闭 |

## 用户故事分组

编号来自批准需求 User Stories；这里保留所有44条，不以元素行替代需求覆盖。

| US | 已证据范围 | 尚须保持的边界 |
| --- | --- | --- |
| 01,03,04,05,06,07 | R1最终真实回放/边界/已知持仓，R5/R6扩展auto/manual/capture | 最终布局影响仅做简短resize/playback复核 |
| 02 | 紧凑顶栏修正已实现 | R7三种桌面空间实际视觉 |
| 08,09,10,11,12 | R2代码定向工具/Text；R6填字/边界；A/B冻结图文隔离 | 锚点拖动、IME等实际证据与代码测试分列；真机输入未验 |
| 13,14 | 阶段双游标、同K多决策、桌面全部记录实际可达 | 最终窄屏More |
| 15,16,17,18,19 | 计划同源、规模往返、参考资金、4000/3R局部 | 拖线/未知/做空/长值所需证据不得被正常值覆盖；E10最新视觉 |
| 20,21,22,23 | 原始成交、逐次退出、加权6760、未知非0 | 未评价控件与重开独立记录须准确链接 |
| 24 | 原始风险4000保留、修订独立 | 复用R5/R6不机械重测 |
| 25,26,27,28 | R5未知费用、未平仓、无退出仍可人工标记；R4人工非自动判断 | missing/needs-confirmation实际反例范围仍依R4单列 |
| 29,30 | 自动保存/正式完成→库→reload、工作B不覆盖正式A | 失败/冲突保留输入仍须具体证据 |
| 31 | R5/R6冻结图片/Text版本/图表状态、A/B隔离与导出A | 不扩张为所有legacy编辑路径已验 |
| 32,33,34,35,36 | 自动可比holding→真实草稿PPTX/原图不变；阶段顺序/原生表格/附录10页 | 历史异窗有明确警告按规格允许；缺阶段草稿具体证据需链接；无需篡改历史构图 |
| 37,38,39 | R4结构化投影/稳定身份源和定向领域证据可复用 | 查询分母/缺失/币种/实盘模拟隔离须链接对应测试结果；不虚构新增统计大屏验收 |
| 40,41,43 | R6桌面轴14px/侧栏320、桌面390趋势220局部 | R7最终窄屏布局＋真实手机价格/退出原因软件键盘仍必需且无豁免 |
| 42,44 | 阶段只读/评价隔离、草稿保存及返回早期来源保留 | 最终开合交互复核与失败保存场景分开 |

## 主矩阵修正建议

1. 顶部“最新以R5为准”改为R6闭环＋R7最终视觉；历史失败记录保留，并明确被哪个报告/截图关闭。
2. E08不能继续只写R2旧fail；E05/E07不能继续写capture遮轴仍待修；E20不能继续写完成消费未接；E21不能继续写真实包未验；E22应区分桌面已实测与手机待验。
3. E01/E10/E19保留“最新实现待当前build浏览器验收”，直到真正收到截图/尺寸；source/test不是视觉证据。
4. 不把全部unverified一键改pass。每行拆为功能、状态安全、视觉和边界；上述明确未归档的反例先寻找现有证据，找不到才补测，不把旧旅程计划当观察记录。
5. README、DESIGN-COVERAGE、FINAL-ACCEPTANCE应一起追加当前状态；旧3047服务/PID和早期PPTX/1857业务副本摘要是历史，不与当前3049/repair合成25条混用。
6. 真机软件键盘保留明确unverified和无豁免；即便R7所有桌面视觉关闭，也不能签署整体accepted。

## R7最终截图复核

等待root提供当前build实际截图/尺寸；本审查不独占或操作其浏览器。

### 当前构建桌面截图追加

实际打开 `R7-pre-plan-1280.png`、`R7-pre-plan-1440.png`、`R7-pre-nav-1440.png` 并与批准02原图/元素表对比。尺寸由root真实DOM测量提供，不冒称本代理测量。

- **E10当前布局局部pass**：两种桌面状态均为计划入场独占一行，止损/目标下一行双列；数量主输入完整一行，方向和单位后置但保留。1280输入290px、价格对141px，14px文字与36px控件符合。没有买入前退出评价泄漏。
- **E01当前桌面局部pass**：1280原三层稀疏工具已变明确两行，toolbar内部连续；header89/tool36。1440为紧凑完整工具组，header63.3，主图720.7；没有把最小命中压缩换空间。当前标题短样例不证明任意长标的省略/full-title行为。
- **E05/E09/E13当前默认局部pass**：1280主图595高、侧栏320、沟槽14；1440侧栏320/沟槽14；价格轴独立、风险4000/3R/3:1和未知比例清晰。1280最底说明部分在侧栏滚动区下面，不是已复现主操作丢失。目标68在保留的手动价窗外且有显示计划价格入口，不要求强制扩轴破坏视野。
- **导航展开状态布局局部pass**：实际可用工作宽1086不足绘图区640＋轴84＋工具48＋沟槽14＋侧栏320，转220趋势＋下置独立表单符合规格。图中价格轴和计划字段同时可见。必须将下部实际独立滚动作为行为证据，不由静态图自动推定。
- 这三张不覆盖390 More、真实键盘、长字段/错误状态或最终事后层级；没有据此整体签署。

### 390默认及表单滚动追加

独立打开 `R7-post-closed-390.png`、`R7-pre-plan-390.png`、`R7-pre-form-scroll-390.png`。

- **E19旧窄返回按钮反例关闭**：事后More闭合时“回到买入前判断”单行可读，root测量44px高；不再是四行竖排。
- **E09/E10/US40–43桌面窄屏局部pass**：价格输入44px；实际下表单scrollTop475前后，上部趋势/轴保持相同231..451位置（220px高），后图可见风险/比例缺失/3R说明；没有文档横溢。该证据不是物理手机键盘。
- **E22 More尚未通过**：root当前实际测量body120.5、表单剩60.5、完整记录内容1624；尚未提供修正后的最终图。仅从70增至120.5不等于充分审阅空间，仍由owner处理整体预算。规格不要求三张代表图同时完整出现在390同屏，但至少须有可读代表图/选择器、可达全部记录与清晰单一滚动上下文。

### US39与最终工作区自动化追加

独立读取 `R7-metric-scope.md` / `.txt` 和 actual-metrics.test.ts 新四项真实断言：同simulation run计算6760/1.69、可见异run返回null+execution-scope-mismatch、可见live/simulation混合返回同错误、未来未揭示异run不污染早期4800毛收益。运行日志22/22，原生产守卫未变。**此前明确定位的Recall指标入口混run定向证据缺口关闭**，不是只有上游scope测试，也不增加统计大屏。

独立读取 `R7-workspace-regression-final.txt` 最终结尾：2文件128/128通过。此前名称green但实际127pass/1fail的日志与更早red均保留，不追溯改写。US29/30具体错误/冲突用例自动化证据成立；真实浏览器对应错误路径仍不由自动化替代。

### More/plan互斥冻结源码审查

独立读取 `R7-layout.md` 已授权实施附录、`recall-workspace.tsx`真实状态转换与所有调用方、`recall-panel-state.test.ts`10项断言、`recall.css`最终container规则及 `recall-plan-sidebar.tsx` hidden消费。未重跑测试；实现者报告10/10，root独立type/lint结果另归root。

**源码限定pass，未发现新确定阻断：**

- footer More点击与计划toggle实际接入transition；图上ReplayChart `onPlanPriceSelect={selectPlanPrice}`调用明确open-plan并关闭More，随后pendingPlanField按可编辑条件定位输入，非未使用helper。
- More在宽度<=1105记住原planOpen并暂收；关闭恢复记忆，原本关闭仍关闭。宽→窄observer同样处理；窄→宽恢复原开关并清记忆；宽屏用户再关计划不会被旧记忆重开。换episode关闭More/清记忆，避免跨回合污染。
- 测量对象chart-and-plan无额外padding/border，与父main内容宽一致；1105与CSS recall-work container阈值一致，依据可用内容宽而非浏览器viewport。ResizeObserver observe该容器，并带cleanup。
- aside始终挂载，hidden与inline display:none由同planOpen派生；按钮aria-expanded一致，避免CSS视觉隐藏而aria仍展开。More body hidden规则在关闭时生效，后置高特异display:grid仅匹配data-open=true。嵌套panel overflow:visible，More body负责滚动。
- 状态对象只包含episodeId及布局值；动作/observer没有写phase、行情截止、成交截止、drawings或dirty。布局造成的真实图表resize仍需浏览器确认视野保持，纯源码不能证明SDK结果。
- 新CSS窄More仅把图区域定220，让余量给footer；没有缩小字体/控件来制造空间。真实body高度、实际图/选择器可读性和末条滚轮可达仍待root图与测量。

必验最小路径：390 plan开→More（aside hidden/aria=false且220趋势）→滚到末条→关More恢复plan；plan原关→More→关仍关；价签返回plan并关More；宽More→窄→宽状态恢复；全程双截止/phase保持。10项纯状态测试不替代这些consumer/真实图表证据。

### 最终390 More实际图追加

独立打开 `R7-more-image-visible-390.png` 和 `R7-more-bottom-390.png`。前图代表图完整显示在独立滚动区；后图最后“全局总结”及编辑按钮完整可见，More标题始终在滚动区外，顶部趋势/轴保留。**E22当前390代表图可视/末条可达局部pass**，旧120.5碎片空间反例在此供图关闭。不把缩略图称为全文Text可读，也不要求三张同时完整同屏。

root真实测量/操作：chart220(231..451)，plan hidden/aria=false，More body195(636..831)；真实滚轮到scrollTop459时代表图272×152完整661..814；滚到底scrollTop1859.5/scrollHeight2054，末条编辑766.8..810.8高44；页面390×844无溢出。phase post/global与market09-24 16:00、execution08-20 02:00不变。滚轮和双截止证据归root实际操作，不冒称本代理执行。最后编辑→返回/关闭恢复及宽窄resize仍待追加。

### More最终跨布局/返回实际闭环

独立打开 `R7-more-return-plan-390.png`、`R7-more-resize-1440.png`、`R7-more-bottom-1280.png`、`R7-more-nav-1440.png`。**本轮E09/E19/E22指定More预算与恢复场景局部通过**：390返回后计划摘要恢复且More关闭；1440计划/More并存、轴独立且末记录按钮可见；1280完整最后全局记录/编辑按钮可见；导航展开后220趋势保留，下方全部6条记录可阅，计划显式让位。

root实际动作证据：390点最后全局编辑成功，post/global与09-24/08-20截止正确；图上计划入场56返回计划并关闭More；返回工作图后，原plan=true开关More恢复true，原false开关后仍false。窄More→1440自动恢复plan=true且More=true，chart392.85/body236.85；1280 header89/chart330/body174，真实滚轮末编辑687..723高36；1440展开nav工作宽1086，plan hidden、chart220/body380.7。全过程双截止未变、无页面横纵溢出。这些行为归root实测，截图由本代理独立查看，不能混称本代理亲自操作。

当前没有发现该指定布局的新增确定规格违例。**自动化仍待收口**：root在最终84项受影响测试发现2个旧交互假设（窄More已收起计划却继续找隐藏输入），Luna正在按真实打开计划步骤修正测试；不能因前次128/128或此处视觉通过宣称当前最终全绿。真实手机软件键盘与报告中其他精确unverified边界仍独立保留，整功能未签署accepted。
