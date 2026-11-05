# 修订07独立视觉审查

日期：2026-10-06。审查者：visual_review；未参与两个原型实现，未修改原型、生成器或生产代码，未操作 root 正在验收的浏览器。本报告仅记录直接打开原图与渲染截图后的视觉判断；DOM、尺寸断言、静态检查与 worker PASS 均未替代比图。

**结论：Scoped PASS — 本轮两个独立桌面视觉原型的已列明画面。当前未留存未修复的重大视觉阻断。** 历史 FAIL 及其修复证据如下保留；此结论不接受真实策略功能、持久化或统一创建→运行链，也不关闭设计决策票09/11。

## 范围、冻结与证据来源

审查依据为[当前视觉契约](../visual-contract.md)、[覆盖表](../DESIGN-COVERAGE.md)、[DR01–08正式规格](../../../../docs/specs/2026-10-06-strategy-workbench-review-functional-design.md)及[融合契约](../../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)。比较1440×900、1280×800、DPR1/100%；A另比较1299×800、1301×800。创建导航200px、A导航54px分别接受，二者不是融合导航证据。

独立读取当前文件计算 SHA-256，与 root 最终冻结通知相符：

| 文件 | SHA-256 |
| --- | --- |
| strategy-library-wireframes/build.py | `aa66c44dae6441af3e2a8f9b63b45fb40948e7392bc85d9203c8d67f4dd2edf1` |
| strategy-library-wireframes/index.html | `ce278f9022cfd396bc7037bf627dae3375b343528edbfe8886e295d19e1ddc09` |
| workbench-design/index.html | `d12096e92a19cc944205a445ba366dec9634ee16a961b263bcc0827e42a8acea` |

已核对[最终冻结清单](../freeze.json)：3个当前源码SHA、72个截图SHA及像素尺寸均与文件相符。此核对只证明证据身份，不替代视觉判断。最终创建源仅在118b版本后修复嵌套 overlay 按钮样式；final11详情/历史、正常两组合1280/1440及单组合F18首屏均直接查看。final10缺失披露继承118b中未变的区域；final8的F14/F15/F18检查和名称图从570a继承，final9的F10/F12元信息从78cb继承，后续变化仅涉及F17缺失披露和F16嵌套按钮，不冒称这些继承帧全部是在ce278源重拍。新增final12的F10/F12首屏及F12滚底1280帧则实际捕获于ce278，已直接与resume06同尺寸状态补验，详见下方补验记录。A当前final8、final9同高度断点与播放、final10嵌套/来源恢复画面及final11稳定关闭帧均列于d120冻结系列并逐帧直接查看。交付URL的新鲜截图仅为补充，不扩大独立审查范围。

原始参考直接查看：

- 创建：[resume06截图目录](../../resume06/screenshots/)的F14、F15、F16、F17、F18两档首屏及已有下段图；F10/F12两档与F12下段。特别使用[f16-1280.png](../../resume06/screenshots/f16-1280.png)、[f18-1280.png](../../resume06/screenshots/f18-1280.png)、[f18-1280-scrolled.png](../../resume06/screenshots/f18-1280-scrolled.png)核对首屏重心和检查顺序。
- A：[style04截图目录](../../workbench-design/style-04-evidence/)的t0/review-t0、result、compare、event、pressure、failure、complete两档可用参考，以及[boundary-1299.png](../../workbench-design/style-04-evidence/boundary-1299.png)、[boundary-1301.png](../../workbench-design/style-04-evidence/boundary-1301.png)。

历史截图名称中的final/frozen并不自动代表最终接受。`intermediate-final10-f17-two-no-signal-1280.jpg`不是正常双组合状态；`intermediate-final10-f17-one-normal-1280.jpg`也不替代双组合证据。曾标为F18首屏而实际滚到底的旧帧不参与首屏接受。1299/1301高度900的旧压力帧不替代800高度参考。

## 保留布局与授权变化

创建页保留200px导航、40px设计工具栏、48px身份区、40px业务页签及原主内容宽度。F15–18新增的62px固定操作栏是用户已授权变化；在1280高800时正文终点738，1440高900时838，栏位占据自己的空间。F15起点、时区、研究集合、本金、五档期限与最后的揭示说明均保留；[final8-f15-top-1280.jpg](../screenshots/final8-f15-top-1280.jpg)/[bottom](../screenshots/final8-f15-bottom-1280.jpg)及1440对应图中，末项可以在栏上方完整阅读。

F16没有继续使用前置两张大概念卡。1280首屏仍在约402px开始选择卡，策略定义与组合预设在原选择卡中分开显示，底栏给出2策略/2独立组合/各¥100,000；[final11-f16-two-1280.jpg](../screenshots/final11-f16-two-1280.jpg)、[final11-f16-two-1440.jpg](../screenshots/final11-f16-two-1440.jpg)保留原来先看选择对象的重心。新增第二条完整策略是DR07的授权演示状态。

F18恢复原摘要两列。单组合[final11-f18-one-top-1280.jpg](../screenshots/final11-f18-one-top-1280.jpg)为移动退出单组合样例，摘要约344–638px，实际必需检查从649px开始；不把它称为默认趋势回撤单组合。两组合[final11-f18-two-top-1280.jpg](../screenshots/final11-f18-two-top-1280.jpg)保留两列，右栏因两个完整定义合法增高；1440的[final11-f18-two-top-1440.jpg](../screenshots/final11-f18-two-top-1440.jpg)首屏可见实际检查标题。该增高来自DR07要求显示两份身份，不是全宽纵向堆叠。

A与style04保留同一框架：54px导航、48px全局栏、48px身份、48px摘要、38px时间、44px图头、44px回放、28px状态、320px详情列。1440主图约x64–1102/详情1110–1430，1280主图约x64–942/详情950–1270；图头和回放栏没有因长名字挤入详情列。1280绘图区从约234至720，1440至820，主图高度超过320/360最低预算。所见深色层级、边框、字体及数字对齐延续参考；未用压小关键字或另添状态行换空间。这里是截图比对，不以其代替精确尺寸测试。

## 分项视觉门槛

| 需求/元素 | 判断 | 直接视觉证据与理由 |
| --- | --- | --- |
| DR01/RD01/WB02–05 | Scoped PASS | [final8-a-t0-1280](../screenshots/final8-a-t0-1280.jpg)、[t0-1440](../screenshots/final8-a-t0-1440.jpg)、[result-1280](../screenshots/final8-a-result-1280.jpg)、[compare-1440](../screenshots/final8-a-compare-1440.jpg)：38px内V/M/R固定次序，V字重更高；T0为“尚未查看结果”；C在图头另列，未与上下文R合并。日期/曲线本身的正确计算归状态安全门槛。 |
| DR02/RD02/LIB09 | Scoped PASS | F15上/下段、[final11-f16-two-1280](../screenshots/final11-f16-two-1280.jpg)、[final11-f17-two-1280](../screenshots/final11-f17-two-1280.jpg)、[final11-f18-two-top-1280](../screenshots/final11-f18-two-top-1280.jpg)及1440图：62px栏常驻，正常态唯一蓝色主动作；阻断态有短原因、详情入口和禁用确认，正文末项不受覆盖。键盘到达及点击定位由root另验。 |
| DR03/RD03/LIB09 · F17 | Scoped PASS | [final11-f17-two-1280](../screenshots/final11-f17-two-1280.jpg)/[final11-f17-two-1440](../screenshots/final11-f17-two-1440.jpg)首屏两组均见“尚未成交、持仓0、现金¥100,000”，目标权重与实际行分开。候选/信号分区；[no-candidate-bottom](../screenshots/final10-f17-no-candidate-bottom-1280.jpg)与[no-signal-bottom](../screenshots/final10-f17-no-signal-bottom-1280.jpg)分别显示无候选/无买入信号，保留现金并明确样本非数据故障。 |
| DR03/RD03/LIB09 · 缺失披露 | Scoped PASS | [final10-f17-missing-data-1280](../screenshots/final10-f17-missing-data-1280.jpg)、[missing-details-1280](../screenshots/final10-f17-missing-details-1280.jpg)、[missing-details-1440](../screenshots/final10-f17-missing-details-1440.jpg)：footer短原因和详情可读；正文按两策略列三类包v1、市场覆盖未接入、缺失区间无法确认(未知)、返回选择调整及实际接入后重查。详情不以无候选或0替换未知。 |
| DR03/RD03/LIB09 · F18 | Scoped PASS | [final8-f18-checks-1280](../screenshots/final8-f18-checks-1280.jpg)、[bottom-1280](../screenshots/final8-f18-bottom-1280.jpg)、[bottom-1440](../screenshots/final8-f18-bottom-1440.jpg)：实际必需检查→执行限制→合成示例按顺序跨列，未知/未接入为黄色阻断；日历、数据覆盖、历史可知、宿主费用能力保留，无绿色总体通过。底栏确认始终禁用。 |
| DR04/RD04/WB04–05 | Scoped PASS | 当前[final8-a-result-1280](../screenshots/final8-a-result-1280.jpg)/[compare-1280](../screenshots/final8-a-compare-1280.jpg)完整两行显示“只读／返回观察后推进”，仍在44px内；1440单行可读。 [backlook](../screenshots/final8-a-backlook-1280.jpg)、[failure](../screenshots/final8-a-failure-1280.jpg)、[complete](../screenshots/final8-a-complete-1280.jpg)原因分别准确可见。返回观察和速度槽不被挤掉。 |
| DR05/RD05/WB06–08 | Scoped PASS | [final8-a-event-result-1280](../screenshots/final8-a-event-result-1280.jpg)与[final10-a-event-compare-1280](../screenshots/final10-a-event-compare-1280.jpg)的320px标题按来源分别命名；[long-event-bottom](../screenshots/final8-a-long-event-bottom-1280.jpg)尾部关闭说明停在事件日。 [final11-a-close-event-stable-1280](../screenshots/final11-a-close-event-stable-1280.jpg)已无瞬态toast，仍见事件日和返回组合对比。 [config](../screenshots/final10-a-config-1280.jpg)/[package-history](../screenshots/final10-a-package-history-1280.jpg)显示当前只读锁定与历史版本，按钮及返回层级名称可读；动作是否真正恢复来源由root另验。 |
| DR06/RD06/LIB08 | Scoped PASS | [final8-f14-1280](../screenshots/final8-f14-1280.jpg)/[lower](../screenshots/final8-f14-lower-1280.jpg)及1440对应图，与resume06保留卡外尺寸、四槽、查询、版本/组合数、更新时间及时区。状态只在badge表达；计划研究终点带说明，实际未提供截止明确未知；失败卡保留必需市场数据缺失。 |
| DR07/RD07/LIB09 | Scoped PASS | F16两选择卡分列定义/预设，F17两实际行，F18两策略定义及每组合独立本金一致可读；[final11-f16-detail](../screenshots/final11-f16-detail-1280.jpg)/[history](../screenshots/final11-f16-history-1280.jpg)区分完整策略v1和只读包历史v3。只接受画面身份；选择/取消/再选保留的功能链由root另验。 |
| DR08/RD08/LIB07–09/WB01 · 名称 | Scoped PASS（所见入口） | [final8-a-name-focus](../screenshots/final8-a-name-focus-1280.jpg)/[hover](../screenshots/final8-a-name-hover-1280.jpg)显示实际长实验名的自定义完整层；[creation-name-focus](../screenshots/final8-creation-name-focus-1280.jpg)显示F10包名入口，[creation-name-hover](../screenshots/final8-creation-name-hover-1280.jpg)/[pressure](../screenshots/final8-creation-name-pressure-1280.jpg)显示明示设计工具压力fixture，均未被祖先裁切。后者不冒称产品F14/F16长名称的实拍。未外推任意未来名称；hover/focus触发、Escape及焦点恢复由root独立鼠标/键盘证据判断。 |
| DR08/RD08/WB06/08 · 连续性 | Scoped PASS | [final8-a-long-event-top](../screenshots/final8-a-long-event-top-1280.jpg)提示仅在320px详情内部；[bottom](../screenshots/final8-a-long-event-bottom-1280.jpg)完整尾部、关闭和配置入口可读，提示消失，主图状态栏未被覆盖。加载[final8-a-loading](../screenshots/final8-a-loading-1280.jpg)为中性同框架说明；[mi](../screenshots/final8-a-mi-1280.jpg)明确缺失组合最后完整日，不闪为虚假收益。状态切换/滚动恢复仍归功能门槛。 |
| DR08/RD08/LIB07 · 元信息 | Scoped PASS（冻结1440与final12补验1280） | [final9-f10-1440](../screenshots/final9-f10-1440.jpg)、[final9-f12-1440](../screenshots/final9-f12-1440.jpg)保留所看版本、生命周期、四统计项与口径层级，未知说明不写成0。二者捕获于78cb，按冻结清单继承到ce278未改区域。补验实际ce278的[final12-f10-1280](../screenshots/final12-f10-1280.jpg)、[final12-f12-1280](../screenshots/final12-f12-1280.jpg)、[final12-f12-bottom-1280](../screenshots/final12-f12-bottom-1280.jpg)，直接比较resume06对应首屏/滚底，元信息密度与层级保留，详见补验记录。此前[frozen-f10-1280](../screenshots/frozen-f10-1280.jpg)、[frozen-f12-1280](../screenshots/frozen-f12-1280.jpg)、[frozen-f12-bottom-1280](../screenshots/frozen-f12-bottom-1280.jpg)仍仅为历史参考。未新增排序。F10首行蓝色链接样式与其他白色包名略异，是非阻断一致性细节。 |
| IF05/06 + 全页预算 | Scoped PASS（两独立样例） | 1440/1280正常、异常、长名、长详情直接比图；[final9-a-pressure-1299-800](../screenshots/final9-a-pressure-1299-800.jpg)/[1301-800](../screenshots/final9-a-pressure-1301-800.jpg)与style04同高断点比较，长身份、完整轴、44px回放、28px状态和320px详情均可见。没有用总体分数抵消重大差异。 |

## 失败历史与修复复核

下列原FAIL不被改写为“从未失败”。修复判定仅对应已看到的替代帧与上述冻结范围。

| ID / 严重性 | 原FAIL与影响 | 替代证据 / 当前状态 |
| --- | --- | --- |
| VIS07-01 · major | [intermediate-f18-1280](../screenshots/intermediate-f18-1280.jpg)将原两列摘要全部纵排，实际检查被摘要挤出首屏，违反DR03/IF06层级与密度。 | [final11-f18-one-top-1280](../screenshots/final11-f18-one-top-1280.jpg)、[final11-f18-two-top-1280](../screenshots/final11-f18-two-top-1280.jpg)、[final11-f18-two-top-1440](../screenshots/final11-f18-two-top-1440.jpg)恢复两列；单组合实际检查标题首屏可见。已修复，Scoped PASS。 |
| VIS07-02 · major | [intermediate-f16-one-1280](../screenshots/intermediate-f16-one-1280.jpg)两张前置大概念卡将首个选择对象推至约710px、贴近738pxfooter，违反DR07/IF06原选择重心。 | [final11-f16-two-1280](../screenshots/final11-f16-two-1280.jpg)首卡回到约402px；定义/预设在选择卡内表达。已修复，Scoped PASS。 |
| VIS07-03 · major | [intermediate-f16-two-1280](../screenshots/intermediate-f16-two-1280.jpg)选择/详情按钮浅底浅字；较早F18检查按钮也同类不可读。 | 最终F16与F18按钮为深色可读；嵌套历史复发另记VIS07-09。原范围已修复，Scoped PASS。 |
| VIS07-04 · major | [final-a-event-top-1280](../screenshots/final-a-event-top-1280.jpg)长详情提示跨全工作区，盖住28px主图状态位，不属于320px详情内部。 | [final8-a-long-event-top/bottom](../screenshots/final8-a-long-event-top-1280.jpg)两帧限定于详情内部并随尾部消失。已修复，Scoped PASS。 |
| VIS07-05 · major | [frozen2-a-event-compare-1280](../screenshots/frozen2-a-event-compare-1280.jpg)及旧1440事件对比绘图区稳定空白，仅有legend，轴/网格/净值线消失。 | [final8-a-event-compare-1440](../screenshots/final8-a-event-compare-1440.jpg)、[final10-a-event-compare-1280](../screenshots/final10-a-event-compare-1280.jpg)有完整轴、网格、净值线与事件点。已修复，Scoped PASS；不以“DOM存在chart”判定修复。 |
| VIS07-06 · major | [accepted-a-name-focus-1280](../screenshots/accepted-a-name-focus-1280.jpg)压力态主图子布局伸入详情列，图头/轴/回放返回/状态被裁切；相应失败/回看也受影响。 | 当前final8名称/回看/失败/完成及final9同高两断点均直接看到完整主图边缘和控件。已修复，Scoped PASS。 |
| VIS07-07 · required text | 旧只读原因被省略至“返回观察后推…”，不用hover也无法读全DR04要求。 [frozen2-a-compare-1280](../screenshots/frozen2-a-compare-1280.jpg)/[result](../screenshots/frozen2-a-result-1280.jpg)保留同问题。 | 当前[final8-a-compare-1280](../screenshots/final8-a-compare-1280.jpg)/[result](../screenshots/final8-a-result-1280.jpg)两行完整显示，仍44px/可读字号，末字不孤立。已修复，Scoped PASS。 |
| VIS07-08 · required disclosure | [final8-f17-missing-data-1280](../screenshots/final8-f17-missing-data-1280.jpg)只有禁用主动作而footer仍为通用预览说明；cfa后虽有原因入口，[intermediate-cfa83fc-f17-incomplete-missing-details-1280](../screenshots/intermediate-cfa83fc-f17-incomplete-missing-details-1280.jpg)仍缺所属版本、能力/范围及处理信息。 | [final10-f17-missing-details-1280](../screenshots/final10-f17-missing-details-1280.jpg)/[1440](../screenshots/final10-f17-missing-details-1440.jpg)完整披露与短footer共存。已修复，Scoped PASS。按钮实际定位归root功能验收。 |
| VIS07-09 · major / VIS07-03复发 | [final10-f16-history-1280](../screenshots/final10-f16-history-1280.jpg)“返回完整策略”近白底近白字，嵌套返回动作无法清楚辨认。 | [final11-f16-history-1280](../screenshots/final11-f16-history-1280.jpg)及[detail](../screenshots/final11-f16-detail-1280.jpg)均改深色、文字可读。已在最终ce278源复核，Scoped PASS。 |

另保留root首次复核[gate-a-compare-1440](../screenshots/gate-a-compare-1440.jpg)的R仍为“尚未查看结果”FAIL；本审查最终看到R/C各自标明的替代帧，不将初始状态当通过。F18错误滚动位置、F17错误状态标签和cfa缺失披露旧图亦保留，不作匹配状态证据。

证据保留限制：root已明确原final8只读截断图在覆写时未保留原字节。因此VIS07-07采用审查者实际直接看过的frozen2同缺陷截图，属于另一轮同问题证据；不能声称那个原final8捕获已完整保留。resume06/style04原参考未覆盖。

## final12限定补验：F10/F12的1280元信息

补验前该档为NOT VERIFIED：当时只有未列最终freeze的frozen历史帧，因此只接受final9的1440元信息及明确继承区域。这条历史范围保留；没有将原NOT VERIFIED改写成已验。

本次直接打开三张新增最终图及resume06对应原图，均为1280×800。root捕获记录注明F10/F12首屏scrollTop0，F12滚底1242/1242；审查判断来自实际画面比对。三帧SHA/像素与更新后的freeze一致，捕获源为当前ce278且无继承声明；当前HTML SHA亦复核未变。

| 新证据 / 原参考 | 补验结果 |
| --- | --- |
| [final12-f10-1280](../screenshots/final12-f10-1280.jpg) / [resume06 f10-1280](../../resume06/screenshots/f10-1280.png) | Scoped PASS。200px导航、身份页签、筛选两行、计数/置顶、最新版本发布时间排序和表格位置/密度保留；包名与v3、策略使用数、首次开发、版本更新时间、开发者/来源及详情操作可读。首行蓝色名称的既有非阻断差异仍记录。 |
| [final12-f12-1280](../screenshots/final12-f12-1280.jpg) / [resume06 f12-1280](../../resume06/screenshots/f12-1280.png) | Scoped PASS。v3与未归档状态、说明条、四统计卡12/8/21/7和右侧管理栏保留，标题及操作可读。新增“统计口径按策略引用去重”在原版本副说明同一行，未改变首屏层级；统计口径与所看版本区分符合DR08。 |
| [final12-f12-bottom-1280](../screenshots/final12-f12-bottom-1280.jpg) / [resume06 f12-1280-scrolled](../../resume06/screenshots/f12-1280-scrolled.png) | Scoped PASS。底部实际呈现首次开发、三代发布、导入与来源、引用明细12/8、其他9分页、历史21、锁定7及引用/归档说明，右侧归档确认与返回目录入口完整可读。正文没有使用旧frozen底图的大面积空白替代实际滚底；顺序、密度和末项位置与原图匹配。 |

限定结果：此前F10/F12最终1280元信息的证据缺口已由直接比图补齐，无新增重大视觉差异；不扩大至排序行为、归档写入、其他视口或其他功能门槛。

## 独立门槛边界

- F10/F12最终1280元信息在final12补验前为NOT VERIFIED；现仅新增三帧所示首屏/滚底的Scoped PASS，历史范围和其他边界保留。
- 本报告只给视觉Scoped PASS；鼠标功能、键盘/Escape/IME、播放可见推进、V/M/Mᵢ/R/C安全、滚动/视野/来源恢复均不是静帧可证明的行为，审查者在此记为NOT VERIFIED，须使用root独立功能证据，不能由本表抵消FAIL。
- 创建与A是两个独立样例，F18回撤与A动量身份不同。真实创建→待开始→运行、54/200融合导航及完整数据/持久化链仍NOT VERIFIED；本次没有通过跳固定样例伪造该链。
- 实际API/数据库/执行引擎、生产代码和远端集成不在用户本轮视觉原型授权中，当前操作门槛NOT APPLICABLE；未来产品覆盖仍NOT VERIFIED。移动、模拟触控、物理触控按桌面范围NOT APPLICABLE，未与鼠标证据合并。
- 09/11需要用户设计反馈与未来门槛，本报告不关闭它们、不代答设计决策。若上述冻结源继续改动，重新打开受影响状态，不能沿用本结论接受未审画面。
