# 独立验收记录

审查者：acceptance代理（gpt-6-astra / low），未参与产品实施。2026-09-27，工作区 `/Users/zhoulin/.codex/worktrees/c414/TradeReview`。当前为**图表阶段检查，非整页最终接受**；控件仍收尾，后续需最终稳定版本复核。

环境：http://127.0.0.1:3044/，Playwright真实Chromium，DPR1/100%，conf/runtime.json真实部署SQLite。全部账户/CNY，持仓观察全部，总市值/日；历史统计全部。无fixture/mock/新库/主动行情刷新或手动业务写入。原始成交与批次指纹由root核对；instruments自动元数据变化见db-observation.md，不声称整库零变化。

依据：本轮visual-contract.md与DESIGN-COVERAGE.md；四张用户原图均直接查看，图表以图2/4和真实before-room/history基线对照。原图CSS视口未知，不做逐像素等同声明。

## 第一轮图表发现（保留失败证据）

| 项 | 实际步骤与观察 | 证据 | 状态/负责人 |
| --- | --- | --- | --- |
| C03 有数据历史曲线 | 全部账户/CNY/观察全部自然显示2015起真实曲线；无需合成数据 | independent-chart-holdings-1440.png | 本状态读取PASS |
| C03 鼠标/键盘读数 | 鼠标显示tooltip、离开关闭；Home→右箭头日期2015-04-15→16，End到末日，Esc关闭；日周月的日期选项数量改变，指标标签改变 | independent-chart-results.json、holding-mouse/holding-keyboard截图 | 初始状态交互PASS，但resize失败影响整体验收 |
| **C03-R1：resize后曲线仍旧坐标** | 1440→1920→1055→821→820→390，SVG viewBox尺寸更新且CTM ratio始终1，但path长度始终36187、日期轴仍在原758px坐标。1920右边大片空白；390裁掉历史后段/末日标签。鼠标截图还显示highlight与crosshair横向不一致 | independent-chart-holdings-1440/1920/390.png、independent-chart-results.json；代码room-holdings-history.tsx plot useMemo依赖缺geometry | **FAIL，charts/root已接收** |
| **C06-R2：密集点鼠标命中错误月份** | 1440，全账户/CNY，历史全部/月。真实鼠标移动并点击首紫点圆心cx72/cy56.035，本应2015-04/+269.75，详情却为2015-11/本期+3673.36/累计-1281.75；同一点keyboard focus+Enter得到正确2015-04 | independent-chart-point-probe.json/.mjs；基础脚本first().hover亦因后第7点透明圆截获而FAIL | **FAIL，charts/root已接收** |
| C06 几何 | 六视口盈亏SVG与坐标宽高一致，CTM ratio1；点肉眼为圆，图高220px（390为240），没有旧154/138压扁 | 六张independent-chart-performance-*及JSON | 几何子项PASS；鼠标命中阻断功能PASS |
| C07 日历内容高度 | 月/年/全部年份均切换到对应真实内容；年/全部年份12格，月31日底格在卡片内；1440/1920/1055三列、821转纵排，阅读顺序保持 | independent-chart-calendar-月/年/全部年份.png、performance-1440/1920/1055/821 | 已看状态PASS；820截图有长元素截屏/固定壳干扰，最终重拍分段视口截图 |
| C07 窄屏表现 | 390趋势/贡献/日历纵排，底月日格可见；数字标签仍较密但无本轮新增明显卡片裁切。820长元素截图出现固定页面壳遮挡，不能把截图伪影视为产品缺陷，也不能作为通过证据 | independent-chart-performance-390/820.png | 820视觉需新鲜复核 |

已直接view_image打开：holdings及performance六视口截图共12张、holding-mouse/keyboard、calendar三状态，及四张原图。图表轴宽度失配由直接看图发现，证明ratio/测试通过不能替代视觉门槛。

代码审查范围：room-holdings-history.tsx/.module.css、room-performance.tsx/.module.css、use-observed-chart-size.ts。共享observer读取实际宽高并在ref卸载时disconnect；主要发现为遗漏派生plot的geometry依赖。透明点r22机制早于本轮，但真实用户读数与可见点不一致，是本轮要求的图表交互阻断。

## 当前门槛

| 门槛 | 结论 | 边界 |
| --- | --- | --- |
| 功能正确性 | FAIL | C03-R1、C06-R2待修复复验；未签发控件PASS |
| 端到端行为 | NOT VERIFIED | 图表真实读取/局部交互已做，跨页返回/刷新/共享筛选最终链待stable；无业务保存流程变更，保存闭环NOT APPLICABLE |
| 视觉还原 | FAIL | C03-R1实质性裁切/留白；820图表及最终控件整页须补验 |

鼠标、键盘已独立操作；本轮脚本未执行模拟触控或物理触屏，均不以窄屏冒充。root的触控证据应单列来源，物理触摸仍无证据。完整资产圆环在真实探索范围未发现，保留NOT VERIFIED，不伪造或将正常不可用状态视为缺陷。浏览器pageerror为空且最终无vite-error-overlay，但不替代最终稳定版本新鲜检查。

输出脚本/原始日志位于evidence/independent-chart-*。后续修复必须保留上述失败记录并追加复核，不覆盖失败历史；最终预览服务/URL和所有门槛由root集成后放行。

## 第二轮：控件/分布/表格真实旅程（最终冻结前后衔接）

`independent-controls-results.json` 已完成并通过的真实操作：

- C01交易室实盘→模拟盘出现模拟运行select→实盘移除；真实账户切换后持仓内容改变；HKD/CNY切换后曲线单位改变。账户select实测34px高、13px字号。
- C02持仓观察全部→展开自定义→改起始日但不应用→收起→1055 resize→1440，全部仍选中。期间tab实测28px高、11px字号。
- C04市场/资产类型切换改变分类内容；默认分布卡片321.28px，展开现金完整解释含77422字符，收起恢复321.28px；局部维度按钮28px/11px。未知值仍为不可用，未当0；单独今日无卖出回款为0有原语义。
- C05表格11列保留；第一行83.14→136.30px展开，其他行保持紧凑；搜索无匹配、清空恢复5行；下一页首行变化，上一页恢复。迷你图88×32px。真实缺价状态较原样例文本更长，未隐藏字段换空间。
- 六视口1440/1920/1055/821/820/390 room与table截图已直接查看；全部无整页横向溢出，390表格保留局部横向滚动。与图1/2/3对照，标准控件字体层级统一、持仓/分布/表格顺序保持，分布长说明不再撑多屏。
- 库的来源未知/模拟盘/实盘均可真实选择，模拟盘保留运行输入框。

注意：第一轮跨页check已通过“库选账户与HKD→room→reload保留”断言，但随后回库click在performing click阶段超时，未产生pageerror；不能把整个check标PASS。root同时确认实施HMR可能损坏CSS而不产生pageerror。因此冻结后的新鲜子链记录 `independent-controls-final.json` 优先，先前截图只证明当时明确可见状态，不替代最终新鲜截图。

直接看图记录新增：independent-controls-room六宽度、table-1440/1055/390、allocation-default/expanded、holdings-expanded。代码审查确认共享primitive被room和library两真实调用方使用，表格精确时间仍保留在time/title/隐藏文本并由局部定位限制，完整分布圆环与部分多空分支未被移除；现有allocation unit案例包含完整圆环、原币部分覆盖和多空小计，但这些不替代真实完整圆环的NOT VERIFIED。

## 第三轮：冻结版本修复复核与最终独立结论

版本：base `1e4921fa16a90fc49dbe9da92f5ea54ca330f6ab`，branch `codex/control-visual-fix-20260927`，产品指纹 `91321f525cdf2cb58b7ddb5fa913235194cbf2d7e6495aab7a383d24fb91fdd3`（evidence/final-version.json）。产品全部冻结后重新启动浏览器；图表最终记录时间为2026-09-27T15:11:37Z，随后补充真实滚动、末点详情和窄屏分段截图。未修改产品代码。

### 修复复核

| 差距/项目 | 新鲜实际观察 | 最终证据 | 结论 |
| --- | --- | --- | --- |
| C03-R1 | 六宽度实际SVG/viewBox一致；末日日期坐标始终等于宽度−14；Home高亮cx与crosshair x1一致；1920曲线随宽度展开，390全时间轴保留，原旧坐标裁切消失 | independent-chart-final-results.json；independent-chart-final-holdings六宽截图 | **修复后PASS**，保留第一轮FAIL |
| C06-R2 | 鼠标点首紫点与键盘首点均显示2015年4月/+269.75；连续hover移至第二点显示2015年5月/本期+431.19/累计+700.94，与键盘第二点一致。无force或DOM dispatch | independent-chart-final-results.json、performance-selected截图 | **修复后PASS**，保留第一轮FAIL |
| C01跨页/刷新 | 冻结后的fresh库选真实账户/HKD→room对应账户/HKD→reload保留→room全部账户/CNY→库对应状态，全链实际操作通过；市场筛选、搜索无匹配再清空通过 | independent-controls-final.json | **PASS**；取代前次超时check |
| C01尺寸/同行 | library六宽截图直接查看；桌面至820账户select34px/13px，caption/radio垂直中心delta0；窄屏整组换行且账户44px/13px，按既有窄屏规则保留。不是标准档退化 | independent-controls-final-library六宽截图；independent-final-supplement.json、mobile-library.png | **PASS**。原390一律34px断言FAIL属于验收脚本过严，保留原记录并以44px实测解释，不改成产品缺陷 |
| C02期间 | 未应用自定义日期保持已选preset；resize保持preset；compact实测28px/11px，未回退旧23/30.5混用 | independent-controls-results.json、最终holding六宽图 | **PASS** |
| C04分布说明 | 真实不可用状态正确保留，按市场/资产类型有可见内容变化；默认约321px，完整说明展开/收起正常；实际鼠标wheel滚动到完整原因末尾，scrollTop26726+client176=scrollHeight26902 | independent-final-supplement.json；allocation-default/expanded | **PASS：实际不可用状态及披露行为** |
| C04完整圆环 | 实际初始实盘8账户×4预设期间未找到完整估值；未用fixture补图。代码仍保留完整圆环/多空/部分覆盖分支，既有unit覆盖有佐证，但不能替代真实页面该状态 | independent-data-state.md/json；代码审查 | **NOT VERIFIED：真实完整圆环状态**，非已观察到的产品FAIL |
| C05表格 | 11列、真实金额精度/未知值、详情撑高、搜索/分页恢复均通过；390真实鼠标横向wheel使局部scrollLeft610，最后操作列进入屏幕，整页不横向溢出 | independent-final-supplement.json、independent-final-mobile-table-scroll.png | **PASS** |
| C07图表/日历比例 | 1440/1920/1055趋势/贡献/月历同排随内容协调；821及以下纵排；月/年/全部年份真实内容可读；820、390追加真实viewport分段截图，31日底格位于日历卡片内，无旧固定高度裁切 | independent-chart-final-performance六宽；independent-detail-repro-top/bottom-820/390；calendar三状态 | **PASS** |
| 根截图详情框偶现空白 | root的history-1440.png确有空白矩形。独立按“末点→1920→1440→表格展开/搜索/分页→回历史”fresh重做，即时和等待1.2s均能读到2026年8月与两金额；scrollTop0、子元素visible。未复现且无法仅据截图确认机制，不伪称根因已查明 | independent-detail-repro.json、immediate/settled.png | **本次重验PASS；原观察保留供root最终复核** |

直接看图最终记录：

- 用户原图1–4与真实基线均在预检直接查看；冻结后再次直接查看library六宽、holding六宽、performance六宽、mobile table scroll、mobile library、final preview，按图1控件视觉语言、图2布局/曲线、图3表格字段密度、图4趋势/贡献/日历层级逐项比较。
- `independent-chart-final-performance-820.png` 是长元素截图受固定页面壳影响的伪影，**不用它作820视觉PASS**；替代证据为 `independent-detail-repro-top-820.png` 与 `bottom-820.png` 两张真实viewport截图，均已直接查看。
- 表格真实缺价说明比示例密集，但字段/11列未删除；默认行未无节制放大。参考图CSS视口/DPR未知，因此本报告证明契约中的布局、尺寸和交互，不声称像素级复制。

### 门槛与边界

| 门槛 | 最终独立结论 | 未验证边界 |
| --- | --- | --- |
| 功能正确性 | **PASS（已实际执行的C01–C07旅程）**，两项明确缺陷修复复验通过 | 真实完整分布圆环状态仍NOT VERIFIED，不可将unit/代码保留当浏览器通过 |
| 端到端行为 | **PASS（真实读取、选择、可见联动、跨页返回、刷新恢复）** | 本轮无交易/复盘保存变更，业务保存闭环NOT APPLICABLE；D01验收后指纹由root最终补齐 |
| 视觉还原 | **PASS（实际可达状态、六视口及已列参考比较）**，未发现剩余重大视觉差距 | 完整圆环真实状态NOT VERIFIED；原图CSS/DPR未知限制精确像素比较；root原空白框截图未在本轮复现，保留原证据 |

这些是有边界的独立门槛结论，**不是所有数据状态/所有输入设备的无条件全覆盖通过**。根代理仍负责整体验收、最终数据指纹、服务存活与聊天交付，不得把上述NOT VERIFIED抹掉。

输入证据：本代理亲自执行鼠标、键盘与鼠标滚轮；模拟触控由root另行记录于touch-real.json/touch-holdings.png（未冒充本代理执行或真实设备）。物理触摸 **NOT VERIFIED**。本轮不要求伪造数据以补齐状态。

最后独立预览检查：http://127.0.0.1:3044/，`independent-final-preview.png`，随后末点fresh探查仍成功访问服务。root需在最终聊天提供可点击URL与实际启动指令，并核对正式数据库原始成交/导入批次摘要；不要声称整库零变化。
