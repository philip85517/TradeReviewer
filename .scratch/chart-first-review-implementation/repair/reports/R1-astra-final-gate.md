# R1 Astra 独立最终门禁

2026-09-26；独立协调审查代理。最新结论：**首次真实集成门槛通过，可放行依赖契约的R2–R4；R1整票与整功能仍未接受。** 最后末根/回早期真实复验已闭合；R5扩展未验证项保留；原自动化时序失败已独立复核44项重跑解决。各轮失败与修复证据不删除。本报告只审 R1 最小真实图表链路，不代表整个功能接受。未改产品、未运行全量测试或写业务数据库。

## 冻结代码复核

- C1：旧 autoscale 缺口已在 `replay-chart.tsx` primitive `autoscaleInfo` 修复，仅纳入当前可见已揭示 marker price；主动 reveal 的手动价格窗合并目标已知 candle 高低与截至目标最新执行 marker price。普通刷新不消费新 reveal，设置关闭时 marker/timeline 均不引入执行。canonical capture 使用 live 冻结的价格范围。上述原缺陷源码局部解除；真实高/低成交与 auto/manual 可见性仍需浏览器证据。
- C2：执行事实按真实时间、输入稳定次序逐笔推导库存，每 marker 单独 `executionIds:[id]`，highlight/hit-test 同一 id，600/400 不再合成清仓×2，买卖买不再按 side 乱序。**但18px横向间距不够**：两个同K同侧marker中心相差18px，第一个标签从中心+10开始，12px两中文字约24px宽；第二个菱形占中心+12至+24，穿过第一个标签，第二标签从+28开始又与第一个文字末端+34重叠。不是点击身份问题，而是实际语义文字被盖。需按文字尺寸分槽或垂直错层，并验证600/400两笔可读可点。已向root及owner反馈；未经重冻结不得标通过。
- C3：live将未映射、可信真实成交时间注册 `{time}` whitespace，capture同样注册执行marker时间；共用 `markerTimelineTimes`/`markerLogicalPosition`，没有末端cadence外推。marker painter使用timeToX，不走drawing containing-candle回退，单K也不凭1秒外推。旧周末gap和单K别名问题源码局部解除。零K仍没有可接受图表范围，reveal早退且capture明确报行情未就绪，本轮不将零K算通过；单K真实点及截图一致性待root。
- legacy 首笔holding返回pre-entry：`switchPhase`使用当前/目标双截止比较，并与已有hasSeenFuture单调OR，删除首笔例外。新增测试只验证回早期及持久化，不等于真实保存重开。源码局部通过，root需提供新证据。
- 48px主条：holding已恢复持仓摘要，pre-entry有计划风险/预期R；统一ellipsis仍需1440/1280实测关键摘要实际可读。post-review目前只有已揭示/持仓，root明确将完整结果主条列R3/R4必验，本报告保留该缺口，不扩大本次R1接受范围。

## 验证边界

root报告冻结后独立执行4文件41测试通过；本代理读取了真实代码及测试反例，不重复争抢全套测试。mock图表测试只作源码回归，不能证明真实坐标、标签可读性或capture一致。等待root本轮真实截图、点击序列、双截止、保存重开及尺寸证据后追加判定；旧报告和旧截图没有被当作本次接受证据。

## 重新冻结后的 C2 几何复核

root通知owner已重新冻结后，本代理重新读取真实源码。现在同一时间、同侧成交按独立lane累加22px垂直偏移，buy向下/sell向上；共享painter与primitive hitTest均应用offsetY。600/400两笔的12px文字和菱形不再处在同一行，前述18px横向重叠反例**源码局部解除**。测试新增offsetY `[0,0,-22]`断言。该追加更新前文当前C2代码fail为**代码局部通过、真实浏览器pending**，不抹除原失败证据。

仍需root真实检查第二笔卖出标签（中心在价格锚点上方32px）没有裁出pane且两筆点击正确；autoscale目前返回价格padding，没有单独按lane数扩展像素margin，不能从源码推断任意多笔都可见。当前R1整体仍未接受，等待本次冻结后证据。

## 本轮真实浏览器证据：连续播放重新失败

本代理实际view_image读取root新保存的 `R1-first-buy-1440.png`、`R1-next-bar-1440.png`、`R1-playback-advanced-1440.png`，没有仅依据root口述。

首买图：真实主图最后完成K之后右侧whitespace出现买入菱形，成交价56附近可见，没有伪造当日OHLC；下一根图：新增当日K可见，marker映射至该K。这两张支持首买/一次推进的局部真实显示。

连续播放图：顶部当前K收62.67，底部截止2026-09-04，真实canvas最后可见仍约08/20且价格标签61.00。**R1连续推进目标未进入视野，明确 acceptance-failed**。不能用首买通过覆盖它。

源码定位交owner：revealRequest为knowledgeAt收盘，时间轴最后K常为开盘时间，因此requestedLogical在轴末端之后返回null；当前fallback取latestKnownExecutionTime（此例08/20），未使用已经找到的targetIndex所指目标K的timeline位置。建议主动reveal按实际目标K和已知执行事实的timeline位置并集/最晚者导航，保持helper不外推、不伪造OHLC。需重冻结后重走跨初始窗口连续播放，保留本次失败截图。

同时首买图主条持仓摘要显示为“持仓1…”；48px高度已收敛，但截图不能证明完整关键数值可读。root继续1440/1280侧栏关状态测量；该可见性项维持pending。

## 状态与1280证据追加

已读取root `R1-browser-journey.md` 第二轮记录，并实际查看 `R1-sidebar-closed-1280.png`：持仓数量确被省略、header两层、右侧买入文字被轴标签覆盖，不能称完整布局通过。root将这些列入R3必修；14px蓝色Text可读性/短卡列R2，保留跨轮验收义务。

root真实回9月4日→买入前时重新隐藏结果且保留“已看后续补记”，再下一笔回首买1000@56与8月10日截止，不恢复9月4日。只读隔离SQLite revision9记录hasSeenFuture=true、首买editingContext、完整Text及创建时来源。结合源码单调OR和根浏览器记录，可接受这一状态路径局部修复；本代理未亲自点击浏览器，不将该来源写成自己的操作。初次计划/Text创建时未看后续=false被保留是正确历史事实，与当前working=true不矛盾。

连续播放真实失败仍阻止R1接受；同K真实逐笔点击、单K/auto/manual/canonical真实图一致性仍没有全部闭合，不以源码局部解除替代它们。

## 连续播放返修后：真实局部通过

重新读取最终source：真实targetCandle在timeline上的logical、精确注册的request时间、已知执行logical取最晚可知目标，不再将收盘cutoff回退为旧成交。root独立43项自动化通过，新增逐日收盘cutoff超越旧last-fill测试与根因匹配。

本代理view_image检查新 `R1-continuous-follow-fixed-1440.png`：顶部收64.89与最右新K/轴标签64.89一致，时间轴已推进至9月23日后、底部截止9月24日；此前停在8月20日61的问题确已消失。root从首买连续播放至自动末尾，无手动fit/zoom；新图播放/推进末尾禁用且解释可见。**连续跨窗口跟随局部pass**，解除此前真实失败，旧失败图保留。

新图底栏“持仓 0”完整可读，支持B专属summary不收缩的1440持仓局部修复。1280及大数仍等待root；同K点击/canonical/单K价窗仍待证据，R1整体尚未签署。

## 新回退视野失败（不撤销连续向前局部pass）

view_image独立读取 `R1-return-pre-entry-collapsed-window.png`：返回买入前后只有8月6/7两根巨宽K，原多K视野及原Text不在画面。root报告从末尾切pre-entry后留存触发Text裁切取消；当前不能证明canonical capture修改了live，必须拆分阶段切换与capture复现。**回早期保留有效阶段视野/留存链仍失败，R1未接受。**

给owner的源码诊断线索：`logicalRangeForUpdatedCandles`将已删除的后期时间两端都按nearest映射到早期末K，可能压缩span；`switchPhase`的rAF restore与phaseContexts effect读取viewport存在时序敏感点。capture的live takeScreenshot只flush挂起失效，可能是暴露早已排队的缩窗，不能在证据不足时断言其为根因。需要拆分复现、记录保存viewport与应用顺序，再作定向修复。

## 正常早期构图 canonical 留存局部

本代理view_image查看root从已保存snapshot.imageDataUrl只读提取的真实 `R1-retained-pre-entry.png`（原始2560×1440）。图中28根已知K、完整多行中文原文、计划入场56/初始止损52、最后已知收55.63可见，无买入/退出未来marker；Text没有被裁切。root提供冻结logicalRange -6..27与保存记录。该正常构图的canonical基本冻结局部pass。目标68在冻结价窗外，不为包含它强制扩轴；root已记录预先说明。这个产物不证明回早期视野修复，也不覆盖包含whitespace执行marker的live/capture一致性，后者仍需边界样本。

## C2真实集成失败重新打开

view_image读取 `R1-same-K-confirmed-1440.png`：同K“减仓/清仓”文字虽分层，但最右清仓菱形因+18px偏移超出pane边缘。root点击减仓实际无导航；本代理读取 `recall-workspace.tsx` 的 ReplayChartWithHandle props，确定没有传 `onExecutionSelect`，故单体primitive点击正确并未接通workspace决策。**C2集成 acceptance-failed**；此前单体身份/分层源码局部pass不覆盖此遗漏。本代理此前未检查到接线缺口，本次补查收紧范围。

A负责绘制/命中/边缘几何一致修复，B负责回调→当前可见执行所属决策→已有安全选择路径。重新冻结后必须真实逐笔点击，核对600减仓与400清仓分别定位和边界；不能用chart mock点击测试替代集成。

## 最后冻结代码复核（等待真实回退/C2闭环）

- A收缩数据修复：nearest映射压缩span时按mappedTo保留原logical跨度；10→4已知K的回归验证6.25..9.25变0.25..3.25，再向前6..9，覆盖缩窗根因，未引入未来OHLC。
- A边缘几何修复：live/capture painter与hitTest共用markerDisplayGeometry，只有原始anchor在pane内时，offset后的菱形按半径clamp到pane内；原在窗外的anchor不吸边。同侧22px垂直lane保留。原清仓+18px超边的源码原因解除；48项报告不能替代真实点击。
- B阶段恢复：仅saved目标阶段viewport排队恢复；新requestReveal取消pending且推进generation，rAF校验generation/phase/timeframe/cursor，旧回调不会清掉新请求。阶段context同步优先待恢复阶段viewport，不读取过渡中间窗。原无saved继承未来窗、旧restore覆盖新推进两反例源码解除。
- B marker接线：workspace确已传handleExecutionSelect，且仅接受当前chartExecutions；显式boundaryExecutionId验证属于目标decision后强制该执行截止，保留该decision图文草稿，避免旧draft晚期游标覆盖成交定位；快照编辑直接拒绝；完整历史点击退出history并清backup，hasSeenFuture保留。定向测试覆盖晚期fill3草稿点击fill2、快照ignore、退出完整历史。

以上为最终冻结源码局部pass。本代理未重复全套测试；root报告A48项/B79项以及类型/lint通过。仍需新真实回早期正常构图、同K两笔可点、单K价窗/capture一致性与1280摘要证据，不能将本段写成R1整体接受。

## C1/C3单K真实证据局部通过

独立view_image读取 `R1-single-K-first-buy-1440.png`、`R1-single-K-partial-1440.png`。原始已知只有8月7日一根K；首买56在右侧独立whitespace点，后续减仓600@64又在更右真实时间点，价格轴扩至65，原K和两个事实同时可见，没有新增OHLC。持仓1000→400与控制条一致；缺行情说明、下一K/播放禁用、下一决策仍可用符合事实推进与行情推进分离。

**C1自动高价窗、C3单K真实时间点局部pass**。未以此推断手动价窗/低价反例或canonical包含marker一致性通过；此缺K样本明确不可留存该决策快照，未制造不存在的截图。

## C2真实点击/晚草稿/重开局部通过

本代理实际view `R1-same-K-fixed-1440.png`、`R1-same-K-click-600-1440.png`、`R1-same-K-late-return-600.png`、`R1-same-K-click-400-1440.png`。三个菱形均完整可见；600点击后当前持仓400/已实现4776，清仓marker与8月10日完整K隐藏；600所属草稿播放到晚期后再点600，仍回400/4776与早期可知K；下一决策400后再点击清仓，持仓0/已实现6760，当前完整K仍截至8月7日。root另确认返回库重开400观察点不泄露8月10日OHLC且来源保留。**本次同K600/400的语义、独立点击与晚草稿边界局部pass**，解除此前C2真实接线/越缘失败。

同时view `R1-same-K-late-600-owner.png` 确认另一连续终点图header收63.78、底部9月14日，而pane最右63.44。此新反例交A只读诊断，尚未排除数据/时序原因，不将999991连续通过扩张到该样本；跟随完整门禁仍有未解反例。

## fresh阶段链追加：不再坍缩，但末根/阶段构图仍未通过

本代理view `R1-fresh-pre-before-1440.png`、`R1-fresh-end-1440.png`、`R1-fresh-return-pre-1440.png`。fresh999992初始多K和Text正常；末尾header64.89但pane最新标签64.78，目标末根仍未见；返回pre虽保留多K不再两根巨K，但整体右移约3bar、Text x338→414，与保存原构图不一致。因此A缩span局部修复有效，但**连续末根和阶段viewport仍acceptance-failed**，旧999991某次通过不覆盖本反例。

独立本地LWC源码证据支持root提出的ResizeObserver竞态：`lightweight-charts.development.mjs:7184` setTargetLogicalRange只排InvalidateMask，12900公开setter走此路径；12890 getter只读已应用timeScale，11096渲染时才应用目标range。当前observer在height-only变化也先get旧range，再set该range，存在覆盖尚未应用reveal/phase restore的确定竞态窗口。已交A以延迟setter而非同步mock建立反例；此为根因候选的源码支持，未经返修真实复验不提升为通过。

## 1280关键值与第二份canonical证据

独立view `R1-summary-stable-1280.png`：底条“计划·3R / 风险4000 CNY”完整可见；结合root稳定DOM测量1280×800、workspace1200、chart1172×623、bar1172×48、summary166×21，**1280关键数值不吞/48px局部pass**。header88px、导出折行和标题/时间摘要截断仍归R3明确必修，不称全布局接受。

独立view `R1-fresh-retained-pre-1.png`：28K、完整Text（虽断行）、56/52计划线及最后55.63，未有未来事实。root记录留存时range -6..27，图片忠实该冻结窗，canonical此正常构图再次局部pass；不是早先-3..30原阶段viewport已恢复的证据。Text视觉保持R2待修。

## 门禁范围澄清（协调者确认）

首次集成放行只针对真实遮未来→逐K/连续/下一决策→Text→回早期→保存重开以及首帧。当前末根不见/阶段构图移位是已知核心真实失败，必须闭合后才能放行依赖该状态契约的R2–R4。

手动价窗、低于已知价区、包含marker的canonical一致性等扩展边界目前为 **unverified**，保留在R5扩展验收，由root协调独立实测；它们不是已证明的新代码fail，不将所有SDK边界自动扩大为R2–R4前置。首次门槛通过只允许继续实施，不等于R1整票或整功能接受，也不删除R5后续必验证据。

## RO冻结后仍未解除末根失败

独立审查RO新源码：height-only不再重排旧range，width优先pending目标，内部range请求经统一authority；异步队列测试覆盖height/reveal、width/restore及稳定width，源码对该竞态局部修复合理。root独立51项通过。

但本代理view `R1-ro-end-1440.png` 仍确认header当前64.89/9月24日而pane最右64.78/9月23日。**首次集成门槛继续fail**；不能把合理源码修复和51项通过当真实问题已消除。需记录真实series末data、目标logical及已应用range，区分数据少一根与视野少一格后再修。回早期新证据待root，原失败保留。

## RO后阶段恢复/宽度局部通过

独立view `R1-ro-baseline-1440.png`、`R1-ro-return-1440.png`、`R1-ro-width-1280.png`：baseline与return的首K/末K/Text几何一致（root测first265、last1216、Text412），此前3bar右移不再出现；1280保留同28根已知K、时间跨度与相对锚点，未显示未来。**阶段构图恢复及该宽度切换局部pass**，解除此已知失败。末根少一根仍为独立核心fail，继续阻止首次门槛放行。


## 最终首次集成门槛签署（2026-09-26，18:58后）

最后minimalfix以pending preservation range优先作为reveal当前范围，精确解决真实诊断的setData即时getter 28..61、但已排队preserve27..60导致不发reveal的问题。新异步回归模拟该顺序；root独立受影响17项通过，已读取 `R1-final-bar-coordinator.txt`。本代理独立复核最终源码与测试，没有重复全量运行。

独立view以下最新真实截图：

- `R1-final-pre-1440.png`：28根已知K正常窄窗，Text/计划完整，尚未展示买入事实。
- `R1-final-continuous-end-1440.png`：由上述窄窗连续播放至9月24日自动停止，header当前收64.89与主图最右末K/轴64.89一致，目标末根实际可见；不是重开后fit宽窗替代证明。
- `R1-final-return-1440.png`：返回pre后首K265/末K1216/Text412与pre基准一致，事实重新隐藏，已看后续来源保留。

结合本报告此前真实逐根/下一决策、600/400分别可点、Text不推进、计划与来源保存重开、正常canonical留存、1440/1280关键值主条证据，**首次真实集成门槛 scoped pass，允许R2–R4依赖实现继续**。这只接受最小真实用户旅程与共享状态契约，不宣称全UI、R1整票或功能完成。

剩余明确归属：R2处理Text可读性/短卡/断行；R3处理header/标题/截止摘要布局与完整阶段指标；R5由root协调完成manual/低价/marker-capture一致性、其余扩展与真机键盘等unverified项。root 79项状态复验曾78通过/1留存并发失败，原始日志 `R1-state-coordinator-final.txt` 已记录并交B定位，本报告不将worker79通过冒充root全过；该自动化复验缺口须在整票最终接受前解决/核验，不能删除。后续改动触及共享图表/状态需重走受影响链路。

### 协调者补充的自动化证据（19时）

上述状态套件缺口已有后续处理：B修复了测试启动capture前未等待初始chart稳定、未显式控制capture promise的问题，产品代码不因这一测试修改。root 于18:34独立运行受影响workspace全部44项通过，见 `R1-state-coordinator-recheck.txt`；原integration35项未受该测试修改影响。保留78/79原失败，不把旧日志改写全绿。此补充由root记录，待后续Astra验收时核对。


## 已解决：状态套件历史失败复核（R2审查时追加）

本代理读取 `R1-state-coordinator-recheck.txt`：root于18:34:25独立运行workspace文件 **44 passed**。检查测试 `keeps a server-stamped capture when Text changes during its save`：现在先等待初始fill-1图表加载，使用可控pendingCapture，并在act内resolve/await后才展开快照记录；后续仍保留保存期间新增Text、服务端revision1回执、queued save与retainedBundle.documentRevision断言，没有删掉并发行为或放松核心断言。修复仅测试同步，不改产品。

因此前文79套件78+1失败保留为历史事实，但该具体自动化缺口**已解决**，不再列为当前R1未决项。此前首次集成门槛pass继续有效；R5扩展未验证、R2/R3视觉及功能验收仍独立保留。
