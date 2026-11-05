# root 真实浏览器旅程

日期2026-10-07；Codex in-app browser，CUA原生点击/键盘与受支持locator；真实 Lightweight Charts。以下不以单元测试或静态mock代替。

## 最小链路（推荐CSS之前独立接受）

- S0：41根已知日K，截止2024-02-11 15:00 Asia/Shanghai；成交尚未揭示；完整原判断与56/52/68、1000股/200000元计划。`sample-base-calibrated-s0.jpg`。
- 点击下一根：真实新增2024-02-12日K，收盘56.00；买入1000@56 marker、成本56和持仓1000可见。行情截止15:00，成交截止09:35不同。`sample-base-calibrated-s1.jpg`。
- Text工具→真实画布→多行中文→Control+Enter：原生Text图层新增；撤销恢复可用；原判断保留。`sample-minimal-text-created.jpg`。

## 基线诊断中的状态问题

- S0统计显示 `0 / 3` 已揭示成交；侧导航显示三笔未来决策占位。`baseline-s0-statistics-leak.jpg`、`baseline-s0-nav-leak.jpg`。这属于本轮推荐预览需修的摘要/列表未来数量泄漏，不是空图截图推断。
- 留存S0快照后，当前原始留存标只读；主动“完整历史”可见后续价格/成交，播放disabled，来源“已看后续补记”。`baseline-full-history.jpg`。
- 返回回放恢复早期行情截止与成交尚未揭示；“已看后续补记”仍保留。创建Text、Control+Enter完成，多行补记内容/原判断均留在图层。`baseline-history-return-s0-text.jpg`。
- 单独两次原生返回回放点击未更新；重新观察后用顶部同名可见按钮semantic locator成功。此观察不作为最终候选故障关闭或通过证明，最终需冷刷新重走。

## 推荐校准中候选（历史记录）

推荐首次下一根与下一决策实操已经显示买入及减仓：减仓后持仓400、已实现4800 CNY、持仓浮盈3200 CNY，market cutoff2024-02-29 15:00、execution cutoff09:35。长Text在图中边缘裁切，原生只读图层点选没有全文阅读入口，因此新增opt-in图上同源全文证据区。最终证据必须在该校准后冷刷新采集。

热更新期间会话曾重置；“关闭统计”locator无匹配经AX确认是面板已因更新关闭。保留该观察，不用它认定稳定冷启动保存失败。最终截图不采用正在修改中的会话。

## 范围限制

本样板未实现SQLite保存/返回重载、真实行情源、真实交易日历、同K多成交fixture、物理触摸或软键盘。正式功能门槛保留；本报告不能证明这些范围通过。

## 冷启动推荐实际链路与代表状态

root在externalOHLC、全文入口、输入边界/头部分行和Space修复落地后冷刷新操作；后续仅自然高度CSS修复另行复核受影响布局。

1. S0下一根：Feb12真实bar/买入marker、1000股@56可见，market15:00 / execution09:35分别显示；`recommended-s1-first-fill-final.jpg`。
2. 下一决策：Feb29减仓600@64，剩400、已实现4800、浮盈3200；market15:00 / execution09:35。原文五段/当前补充三段从真实visibleDrawings读出。
3. 全文summary真实Space打开、Enter关闭，播放仍“播放”，阶段/双截止不变；未把summary Space冒泡成全局播放。
4. 展开全文、点原判断选择、Tab至当前补充：原判断按钮pressed=true，当前补充pressed=false且outline2px #8cbdff offset2。`recommended-s1-original-current.jpg`与`recommended-s1-selected-focus.jpg`为原生1440×900下滚viewport，全部原文/补充可读；不是fullPage工具折叠后的图。
5. body限定auto后，真实wheel到scrollY516、document1416，全文open=true，失效条件/来源/补充与回放可达。鼠标与键盘证据分开。
6. 下一决策退出400@70，持仓0、已实现10400；market Mar26 15:00、execution09:35。主动S2完整历史至Apr6 15:00，执行截止Mar26，播放禁用；`recommended-s2.jpg`。
7. 返回S0恢复Feb11 15:00、成交尚未揭示；已看后续标志保留。原判断仍未看后续来源，不覆盖原文。
8. 已知统计没有未来全量分母，未知数量/均价/净额/费用“待揭示”；导航S0仅当前首笔计划入口。`recommended-s0-known-statistics.jpg`、`recommended-s0-known-nav.jpg`。
9. fitAll/1W只使用截止内投影，OHLC55.33/56.19/54.75/55.57，没有未来56.8；`recommended-s0-week-fit-known.jpg`。同K多笔、所有聚合区间仍NOT VERIFIED。
10. 回S0真实点未来空白：外置OHLC仍回退已知末根，无未来价；`recommended-s0-future-blank-readout.jpg`。
11. 真实Text工具/画布/两段中文/Control+Return产生新图形，全文新条标“已看后续 · 复盘补记”，原判断五段未改；`recommended-s0-retrospective-text.jpg`。早期双截止保持。

## 响应式故障与修复范围

901旧头部覆盖、普通图壳220裁切、bodywheel锁已单独保留FAIL证据；修复记录见诊断与独立视觉报告。root final901/1100/1101壳454、stage360，1199壳454、1201壳469/stage440，时间轴/量柱已独立看图恢复。

More901原生展开可复现D14：按原状态关闭计划，壳/stage220、OHLC27、回放只露摘要。`recommended-boundary-901-more-pre-fix.jpg`不是最终推荐图；该状态随后修复/最终实测单独记载，不以普通状态通过替代。

## 冻结CSS后的组合状态复验

- D12回开：1201×900、导航展开，主内容宽981，More关闭/计划打开，旧shell220/scroll467裁切证据保留为`recommended-boundary-1201-plan-nav-fail.jpg`。最终真实关闭More后，计划按原行为重开：stage440、shell469，图壳y274–743，fitAll y698–734包含于壳。原生滚轮回到scrollY0后图`recommended-boundary-1201-plan-nav.jpg`显示完整量柱、时间轴及计划起始内容。计划堆叠由实际容器宽度决定，并未固定复盘列数。
- 同组合原生再次打开More：计划折叠，stage440、shell469；market仍Feb11 15:00，execution仍未揭示，全部动作和记录标题可达。`recommended-boundary-1201-more-nav-final.jpg`。`1201-more-nav-stable.jpg`为冷刷新再开More的稳定画面：左右56/52标签与线同基线；此前HMR截图错位保留，触发规律/所有resize同步仍NOT VERIFIED。
- 最终901×900冷刷新再原生开More：stage360、shell454、文档1206；fitAll在壳内，全部More动作和记录标题可见。`recommended-boundary-901-more-final.jpg`及JSON。此前1440/1280/390开合证据保留；更多未改handler或阶段状态。
- D15相对定位修后390×844：shell y496–765/h269，stage240，fitAll y720–756在壳内；原生边缘滚轮从0→1194到文档2038的下部，More无遮挡。`recommended-s0-390.jpg`、`recommended-390-native-scroll.jpg`。More开时文档1676，下滚至832，全部动作/记录可达；`recommended-boundary-390-more.jpg`/`-more-top.jpg`。真实点fitAll仍读55.33/56.19/54.75/55.57，早期双截止未变。只把实际成功的边缘wheel作为证据；不宣称所有图表/面板位置都转交页面滚轮。
- 最后≥901布局补丁不改变390规则。冻结CSS后1440×900、1280×800均冷刷新从S0拍摄最新`recommended-s0-1440.jpg`/`recommended-s0-1280.jpg`；同fixture/range与baseline对照。1440壳469/stage440；1280壳454/stage360、文档947。

以上是视觉样板的真实代表旅程；不签正式SQLite写入、全键盘矩阵、同K多成交或物理触摸。
