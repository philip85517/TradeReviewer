# 补充诊断：完整内容和未来信息

2026-10-07，root 实际浏览器操作；固定完整 fixture。事实和原因判断分开。

## D09 · S0 摘要与列表泄露未来成交数量

- **位置**：复盘统计的“已揭示成交”、左侧决策导航。
- **截图证据**：`../screenshots/baseline-s0-statistics-leak.jpg`、`baseline-s0-nav-leak.jpg`；S0 行情截止2024-02-11 15:00，成交尚未揭示。
- **来源**：`app/components/recall/recall-workspace.tsx` 的 `currentExecutions`、导航 `decisions` 和统计分母；这些原生路径使用完整交易组。
- **实测**：统计显示 `0 / 3`，导航同时列出三笔决策占位。未显示未来成交价仍透露未来发生几次执行。
- **任务影响**：用户在形成入场判断之前已知道未来交易次数，复盘受事后信息影响。
- **原因判断**：可见行情与成交使用截止投影，但导航和摘要继续使用完整集合，入口之间契约不一致。
- **修改规则**：推荐预览只用当前已知执行ID投影导航；S0仅保留当前首笔计划入口；统计不给未来全量分母，未知数量/均价/净额/费用显示“待揭示”。保留完整三笔fixture，不能删数据规避问题。本轮opt-in预览不修正式默认业务路径。
- **验收方法**：冷刷新S0展开统计与导航，无未来次数和价格；下一根/下一决策后仅增加实际已揭示内容；扩大视野与阶段回退后再次检查。正式全矩阵（尤其同K多笔）仍单独验收。

## D10 · 推进后的原判断缺少完整阅读入口

- **位置**：S1图上原判断与当前补充，尤其窄屏；Text原文卡片处于价格自动缩放或右边缘时。
- **截图证据**：`../screenshots/recommended-s1-first-fill.jpg` 为校准中画面；`recommended-checkpoint-fulltext-entry-fail.jpg` 为桌面全文入口被隐藏的失败证据，均保留，不冒充最终推荐。
- **来源**：`DrawingCanvas` 的真实Text坐标与既有卡片几何；`RecallWorkspace` 的 `visibleDrawings`，原生只读图层选中没有独立全文入口。
- **实测**：S0原文完整；推进后原判断下缘/补充右缘可超出绘图区。早期新增阅读区在桌面computed为display:none，高度0，因此DOM存在并不表示可用。
- **任务影响**：用户无法可靠对照原判断，容易把新的观察当作原判断，或漏读失效条件。
- **原因判断**：保留真实锚点与图表视野必然存在边缘裁切；仅调整字重或选中图层不能保证整段内容可达。隐藏辅助入口进一步失去全文路径。
- **修改规则**：在推荐预览中，从实际可见Text投影提供同源全文阅读区，按真实形成阶段分组，逐条显示已看后续/未看后续；选择条目联动真实图形ID。桌面入口可见并可展开，窄屏默认展开；不复制fixture文案、不改短、不修改锚点，不改变生产默认调用。
- **验收方法**：S1减仓后同时阅读原文全部五段与当前补充全部三段，点选联动图形；390窄屏全文自然换行且末段可达；S0不显示尚未形成的S1补充。最终匹配图与独立视觉审查另见验收记录。

## D11 · 901px断点附近的控件互相覆盖

- **位置**：工作区头部图表工具、阶段选择、样板标签。
- **截图证据**：`../screenshots/recommended-boundary-901-pre-fix-fail.jpg`，对应JSON同名；899图作为相邻对照。由未实现UI的theme_audit直接看图发现。
- **来源**：原生`recall.css`响应式头部规则与推荐scoped CSS的900px切换边界叠加。
- **实测**：901px时图层图标覆盖买入前判断、设置齿轮覆盖持仓过程，最右推荐样板逐字竖排；899px多行头部正常。页面scrollWidth没有超出仍然发生控件遮挡。
- **任务影响**：用户难以辨认和点选阶段，误操作风险；仅差2px便失去稳定布局。
- **原因判断**：图表工具和阶段的真实最小宽度没有纳入头部响应式切换，原生布局与局部覆盖之间存在空档。
- **修改规则**：在这一空档采用明确分行的头部，把标题/阶段/工具各放到能容纳的行；文字标签不逐字竖排，工具栏内部必要时横向滚动；保留控件与中文尺寸。
- **验收方法**：重新直接看899/901及新头部断点两侧截图，阶段与图标无交叠，文字不竖排；保留修复前FAIL图，不能只覆盖文件取消失败。

## D12 · 中等宽度真实图表被壳高度裁切

- **位置**：901–1200px堆叠布局的图表下半部。
- **截图证据**：`recommended-boundary-901-chart-clip-fail.jpg`、`recommended-boundary-1100-chart-clip-fail.jpg`、`recommended-boundary-1101-chart-clip-fail.jpg`；独立视觉审查直接发现。
- **来源**：原生1200px堆叠规则的220px chart shell，与推荐chart-stage 360px和独立OHLC行叠加。
- **实测**：shell220px，内部stage仍360px；49–51附近早期K、量柱、时间轴落在壳外并被裁切。899px壳269、stage240正常。
- **任务影响**：行情本身不完整，用户无法判断早期走势与时间；图外全文不能补偿图表主工作面损失。
- **原因判断**：响应式覆盖的选择器强度和容器高度不一致，不属于合法的220px密度取舍。
- **修改规则**：推荐样板的中等宽度堆叠图表壳按真实stage+读数自然高度；不改真实数据、不靠隐藏量柱或文本通过。桌面与<=900布局分别保留。
- **验收方法**：901/1100/1101与原生1200断点两侧真实截图和canvas高度，完整时间轴/量柱/早期K可见；独立审查再关闭。

## D13 · 全文展开后鼠标滚轮不能到达下部

- **位置**：推荐桌面全文与窄屏自然页面流。
- **截图证据**：S1冷启动打开全文后，root原生wheel两次，scrollY仍23；Tab聚焦下部后可跳到516。最终滚动证据另见browser-journeys。
- **来源**：`app/globals.css` 的body overflow:hidden；推荐局部容器已改自然流但外层未解除锁。
- **实测**：全文open=true、document scrollHeight1416，body computed overflow:hidden；DOM有全文不能证明鼠标可达。
- **任务影响**：鼠标用户读不到失效条件/来源及当前补充，完整页截图会掩盖真实可达性问题。
- **原因判断**：工作区原有一屏滚动模型与推荐页面自然流冲突；键盘自动滚动可达并不代表wheel已通过。
- **修改规则**：仅`body:has(.design-prototype[data-mode="recommended"])`设overflow:auto；不改变baseline/默认页面外层滚动。
- **验收方法**：冷启动、真实wheel到全文末段和回放；390实际下滚到原文与主动作；Tab、Enter、Space分别记录，不把截图或CSS当功能通过。

## D14 · More展开继续使用一屏固定预算

- **位置**：推荐样板901px的“更多 / 记录”展开状态，图表下缘和回放动作。
- **截图证据**：`../screenshots/recommended-boundary-901-more-pre-fix.jpg`，配套同名JSON；root原生点击可复现。
- **来源**：`recall.css` 1336起More grid/flex预算与1626起container220限制，选择器强于推荐普通状态自然流。
- **实测**：More data-open=true，计划按既有行为关闭；chart-and-plan/shell/stage均220，外置OHLC27；时间轴被裁，回放只露摘要，其余区域空白。
- **任务影响**：展开记录后无法继续使用回放动作、阅读记录，且图表损失日期与下部行情。
- **原因判断**：正式页面的一屏bounded布局被局部自然流样板继续继承，More独立状态未覆盖；并非数据或截断文案问题。
- **修改规则**：仅推荐样板More状态恢复外层、图壳与记录区自然高度，真实stage按各视口360/240/桌面clamp，OHLC计入壳层；回放/记录完整可滚到。保持More开合、阶段和关闭计划的真实状态契约。
- **验收方法**：1440/901/390真实开关More；图表量柱/时间轴与动作、记录标题完整可达；关闭恢复常规工作面；独立直看截图，不用DOM存在替代。

## D15 — 适应全部丢失定位锚点，窄屏叠在回放区

- **问题位置**：390px图表的“适应全部”按钮，实际出现在回放/更多记录底部。
- **截图证据**：recommended-390-native-scroll-fit-nav-fail.jpg、recommended-s0-390-fit-nav-fail.jpg、recommended-boundary-390-more-fit-nav-fail.jpg；独立theme_audit直接看图发现，root复看确认。
- **来源**：recall.css:430 `.recall-fit-all` absolute bottom8/left52；推荐CSS在窄屏/中宽/More将其chart-shell改position:static。
- **实测现象**：按钮出现在文档底部，普通态遮住More，展开态漂到记录卡内；归属图表的控制丢失就近定位锚点。
- **任务影响**：用户误判操作所属，More文字/命中范围被挡，滚动时仍不能正确找到图表视野操作。
- **原因判断**：解除sticky时使用static，同时移除了绝对定位子按钮的锚点；应保留relative布局锚点。
- **修改规则**：仅推荐chart-shell解除sticky使用relative+top:auto，不改变按钮handler；按钮必须位于图表壳内，不覆盖回放、原文或记录。
- **验收方法**：390普通/原文/More原生滚动及1440/901截图直接看按钮归属；DOM按钮矩形包含于壳；真实点击fitAll保持已知投影。

### D14 扩展边界的回开

1201×900、More打开且导航展开：root真实点击后main宽981、stage220、shell454；失败证据 recommended-boundary-1201-more-nav-fit-nav-fail.jpg/JSON。旧 container 的height/min-height220仍覆盖推荐基础规则。修复必须在More基础状态显式设置推荐stage高度与min-height（桌面clamp、901–1200为360、≤900为240），不能只解除max-height。该组合未关闭前，不签整体视觉完成。

### D12 导航＋普通计划组合回开

root真实1201×900打开导航，More关闭/计划打开：main981，stage440，shell220/scroll467；当前图壳裁切并非只有中宽窗口存在，导航将容器宽度送进旧1105规则。证据1201-plan-nav-fail.jpg/JSON。推荐plan-open壳与rail高度解限需要覆盖全部>=901窗口，stage仍独立遵循中宽360/桌面clamp；不可为修壳把桌面stage一律变360。与D15 relative锚点共同维持。修后复验同组合开关旅程。

### 最终关闭依据（不覆盖历史FAIL）

D12：冻结CSS后1201导航+计划真实开合复验，stage440/shell469，量柱与时间轴恢复；`recommended-boundary-1201-plan-nav.jpg`。D14：同组合More真实打开stage440/shell469；901冷启动More stage360/shell454，动作与记录完整；`recommended-boundary-1201-more-nav-final.jpg`、`recommended-boundary-901-more-final.jpg`。D15：390修后fitAll矩形包含于壳，实际下滚至原文/More无覆盖、真实点fitAll仍为已知投影；390修后图见browser-journeys。D13：S1与390真实wheel阅读路径分别有证据。源码审查独立PASS；整体视觉结论另见visual-review。捕获中一次计划标签错位不抹除；冷刷新稳定图左右52/56对齐，触发规律未确认，保留NOT VERIFIED，不扩称全部resize同步通过。
