# 策略台设计规范与原生复盘样板验收

- 日期：2026-10-07；worktree `/Users/zhoulin/.codex/worktrees/f42e/TradeReview`，分支 `codex/strategy-workbench-v1-design`，未提交/推送/合并。
- 范围：当前策略台/复盘诊断、规范0.1草案、一个development-only推荐原生样板。用户已授权可逆制作；真实业务实现/正式持久化/回测不在本轮交付范围。
- 实现：design_sample（gpt-5.6-luna），仅样板及可选preview接口。整页与状态链验收：root，未实现所审UI。独立视觉：theme_audit，直接打开参考与fresh匹配截图。独立默认路径源审：preview_seam_review。
- 依据：[覆盖表](DESIGN-COVERAGE.md)、[任务票](issues/01-native-design-sample.md)、[规范](../../docs/designs/2026-10-07-strategy-design-system/README.md)、批准参考02/04/05/07和现行规格；来源不得由旧handoff摘要替代。
- 环境：3064 / node PID37559 / exec会话49925；显式隔离DB `PROTOTYPE-isolated.sqlite`。样板repository为会话内存，刷新重置。
- 比较：合成示例科技TRD、完整原文/计划、S0 2024-02-11 15:00 Asia/Shanghai、成交未揭示、1D、固定起始范围；1440×900、1280×800、390×844、899/901、1100/1101、1199/1201、DPR1。整页图高度不同于浏览器viewport，不能当首屏同高。

## 分项门槛

|ID/门槛|root观察/证据|结果|范围与限制|
|---|---|---|---|
|现状证据|current-strategy/current-native fresh截图、computed与源码；diagnosis-source D01–08|PASS|字体栈不是逐glyph证据|
|实际图表最小旅程|S0→下一根真实bar/买入1000@56、独立双截止；sample-base-calibrated-s0/s1；先接受再扩大CSS|PASS|合成fixture，不代表真实行情/日历|
|阶段链|买入→减仓600@64/剩400→退出400@70/已实现10400，S2→回S0保留原判断/已看未来|PASS（样板）|正式持久化不由内存状态证明|
|完整内容与关联|visibleDrawings同源全文；S1原文5段+补充3段；真实ID选择；newText补记；S1原生截图|PASS（代表旅程）|图上长文保留真实锚点，仍可能覆盖行情/边缘裁切，有全文补偿|
|键盘|summary Space开/Enter关，不误播放；原判断selected与当前补充实际Tab焦点2px/offset2|PASS（代表操作）|全键盘矩阵、焦点返回/每菜单未全测|
|鼠标自然流|body仅推荐auto；S1wheel0→516；390边缘wheel0→1194到全文/主动作，More下滚832动作/记录可达|PASS（代表操作）|不宣称所有图表/面板坐标都转交页面滚轮|
|未来信息入口|S0统计未知、导航当前计划、futureblank OHLC末根、fitAll/1W已知投影、回退补记来源|PASS（已测fixture）|Tooltip/列表/摘要/缩放已测代表入口；同K多成交与所有聚合边界NOT VERIFIED|
|默认代码兼容|三个共享组件参数默认原行为，page仅dev query；源码独立审查；180项回归+OHLC相关43项重跑|PASS（源审/相关回归）|43为子集，不相加成223；生产bundle排除未构建验证|
|原成交保护|原库与隔离副本executions1866及3关联表0，before/after SHA256 MATCH|PASS（四表）|不宣称所有数据库表无变化|
|颜色/尺寸/字体|实际normal主动作5.344、边界3.423；H1/正文/输入/label/iconframe实测；真实focus|PASS（实测范围）|hover/active是源码计算；glyph、Windows/Linux字型、coarse/物理触控NOT VERIFIED|
|独立视觉|theme_audit直接匹配冻结S0三视口、真实S1全文/selected/focus、断点及1201导航+计划/More组合|PASS（已见样板）|图表缩小/长页/图上原文遮挡是明确取舍；全resize时序NOT VERIFIED|
|正式SQLite写入/重读/返回/刷新|无业务写入实现；样板明确内存|NOT APPLICABLE（本轮）|正式功能仍NOT VERIFIED，不能关闭历史功能票|
|启动包专项符合性|现有路径未找到新启动包|NOT VERIFIED|历史zip不替代；不妨碍按现行规格制作可评审草案|

命令日志：[verification](reports/verification.md)、`final-regression.log`（180PASS/44.20s）、`final-readout-regression.log`（43PASS/5.20s，为相关子集）。冻结CSS后root独立typecheck exit0（final-typecheck.log）、diff-check exit0；node37559 LISTEN3064。

## 失败历史与关闭依据

|问题|保留的失败证据|处理/复核|状态|
|---|---|---|---|
|D09未来数量|baseline-s0-statistics-leak/nav-leak|推荐已知投影，baseline/正式默认保留源证据|样板已关闭；正式修复未实施|
|D10全文不可达|checkpoint-fulltext-entry-fail|实际Text全文入口+原生S1全文截图/选择/焦点|已关闭阅读路径；图上遮挡为明确取舍|
|D11头部901重叠|901-pre-fix-fail|三行头部，独立复看899/901/1100/1101|已关闭|
|D12普通中宽/导航图壳220|901/1100/1101-chart-clip-fail；1201-plan-nav-fail|mid壳454/stage360；最终1201导航+计划壳469/stage440，真实开合及直接看图|已关闭代表状态|
|D13body滚轮锁|诊断中scrollY23/bodyhidden记录|限定推荐auto；S1实际wheel516、390边缘wheel1194|已关闭已测阅读路径|
|D14More预算|901-more-pre-fix；1201-more-nav-fit-nav-fail|More自然流；901最终stage360/shell454；1201导航stage440/shell469，动作/记录可达|已关闭代表状态|
|D15fitAll遮挡More|390-s0/scroll/more-fit-nav-fail|relative/topauto保留锚点；实际矩形在壳内、wheel/fitAll与独立看图|已关闭代表状态|
|1201计划标签捕获不一致|1201-more-nav旧HMR图|冷刷新真实More切换及最终plan/More图52/56名称与轴同基线|稳定代表图PASS；触发规律/全resize同步NOT VERIFIED|

## 用户需要评审的取舍

只有一个推荐方案，baseline是对照。推荐优先阶段与完整截止、中文阅读和唯一主动作；代价是1440图壳从625.7降至469px，1280主要动作在800px首屏外，390为约2038px长页。图上原文不改短/不改锚点；全文在图下可对照。可选择未来更偏图表首屏或更偏完整阅读密度，但不能靠缩字/删关键判断/隐重要价格换空间。

## 选定后的公共固化

范围已在规范第9节列明：globals语义token/文字/控件状态；chart-toolbar/drawing-toolbar/replay-chart字体与工具；recall.css及工作区/计划组件的上下文/全文/响应式；策略结果页统一语义配置；项目AGENTS与UI任务模板引用规范。另建正式改造覆盖表，独立验真实数据库闭环和图表状态。当前没有提前统一生产公共样式。

## 交付状态

本轮可评审视觉样板及规范草案完成；功能代表旅程、状态安全代表入口、独立视觉分别通过上述范围。没有未解决的已知适用主要视觉FAIL。未验证事项按表保留，不能据此关闭任何正式功能票。

- 推荐：[实际组件样板](http://127.0.0.1:3064/?prototype=review-design&mode=recommended)；对照：[同fixture现状基线](http://127.0.0.1:3064/?prototype=review-design&mode=baseline)。
- 末次真实浏览器：恢复正常1280×720窗口并冷刷新，示例科技TRD、stage360、S0 Feb11 15:00/成交尚未揭示、OHLC55.33/56.19/54.75/55.57与内存重置说明均可见；`reports/final-live-browser.json`与`screenshots/final-live-browser.jpg`。预览tab保留，node37559本地服务持续运行。重启命令见README。
- 同数据对比：`screenshots/baseline-s0-{1440,1280,390}.jpg` / `recommended-s0-{1440,1280,390}.jpg`；代表状态`recommended-s1-original-current.jpg`、`recommended-s1-selected-focus.jpg`、`recommended-390-native-scroll.jpg`、`recommended-boundary-1201-plan-nav.jpg`与`recommended-boundary-1201-more-nav-final.jpg`。所有FAIL原图仍保留。
- 生产bundle排除未构建验证；跨平台逐字形、真实hover/active computed、coarse/物理触摸/软键盘、全键盘矩阵、全resize时序、同K多成交、正式SQLite/真实回测/导出仍NOT VERIFIED。新启动包未找到，专项符合性NOT VERIFIED。

保持当前聊天所托管分支与既有修改，无提交/推送/合并；公共规范固化需以用户实际画面选择为输入，范围见规范第9节。
