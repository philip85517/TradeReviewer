# 历史四模式图表受控叶子 — 首候选派发契约

2026-10-23，原P4未实施历史图表，叶子0/3；不重置当前表现PerformanceChart旧FAIL。2026-10-23 10:40 CST正式派发 /root/contribution_bars，沿用实际 gpt-6.1-sol/ultra；旧贡献图候选3保持冻结。实际模型gpt-6.1-sol/ultra；root整页视觉、完整数据流、独立功能及真实浏览器/原图视觉接受。用户已批V2.5设计与范围，无设计差异。禁止再派代理。

读取当前AGENTS、项目工作流、task-decomposition、frontend-control-audit、ui-task-templates、issue-tracker及适用TDD/verification技能。准确原稿 docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md HP05:349–394及HP09:467–515；HV25-33/34/35/47–51；原稿无稳定elementID，HOME-HP05-B001/HOME-HP09-B001/B031。参考同目录images/history.svg、history-stats-cumulative.svg、history-stats-win.svg、history-stats-rounds.svg、history-stats-empty.svg、history-stats-error.svg、history-stats-source-missing.svg、history-stats-extreme.svg、journeys-year.svg，以及prototypes/round5/history.html完整交互。root已直接看8原图派生PNG与年度loading，仍要求实现者自己读原依据。

只新增 app/components/homepage-v25/history-chart.tsx、history-chart.css、history-chart.test.tsx、本history-chart证据。不得改PerformanceChart、HistoryControls、财务/A/B、state、host、Workspace、其它产品/旧证据/sharedtracker；不接页面，不启停服务、不写DB。

接口：受控HistoryChart，mode用既有HomepageHistoryChartMode四值；data为完整不可变提交对象|null，含sourceId/requestGeneration、grain month/year、业务范围label/timeZone和ordered points；point有stable key、业务start/end、语义label（1月/2024）、明确 state=value/no-rounds/source-missing/future/loading/error及reasons，各字段独立：periodNet/cumulativeNet（只读HomepageV25Metric原币/FX/覆盖）、roundCount/winningRounds/winRate（readonly value:string|null、available、reasons，rate是百分比0..100）。数值/FX/已关闭回合归属及累计由调用方提供，本叶子只选字段/格式化/绘图；不求和、不累计、不算winrate、不用0填缺口、不从任何known子集造总额。status同ready/pending/error/empty+reason；pending/error时父传旧完整data，组件不保存金融快照。不增加全局修复入口；range失败retry由既有HistoryControls/host负责。

所有四模式绘图区/外容器位置尺寸固定，给金额/百分比/回合单位预留同一轴宽；以全四字段display extent约束稳定轴槽，不做不同单位路径形变。money currency mismatch failclosed明确原因；rate固定0..100%，round整数ticks覆盖范围；金额万/亿缩写而完整source字符串+原币/FX/coverage在读数保留。period-pnl标题单年每月/多年每年净盈亏，cumulative累计净盈亏，win各期胜率，round各期回合数。不能使用01/02无单位序号。

原稿1440×1000：history模块x56内容1328，chart x56y214w1328h320，标题16/600x80y240；plot x140到约1380 y280..490，labels y522，基本8?由原SVG核对，默认line约2px+小点、留白/边框/底色遵原图，不照当前表现chart的MM-DD日期格式替代。宿主沿用公共起点，不新增外层margin。比较1440×1000、1280×800、390×1000，参考缩放推定100%（SVG无DPR），root浏览器DPR1。小屏不删状态/读数；主要曲线不被提示遮挡，不溢出遮下模块，极长读数允许已记录的正常文档流安全槽而不能绝对overflow。响应式如需偏离原稿先说明证据，不自行降密度。

HC01月/年四模式与semanticlabels；HC02四模式sameplot geometry；HC03 0%/100%/整数count/truezero；HC04 no-rounds按字段独立knownness与原图：period/rate/count未知时留缺口并有低干扰背景与准确原因；累计若caller明确给出available cumulativeNet则可绘制该值（原图2/5/8月），仍保留无回合读数；叶子不得计算/承接/填零；HC05 missing断线/reasons；HC06 future中性灰且无伪值；HC07 perpointloading/error与global initialpending/error/旧完整pending/error分别；HC08空范围无假曲线；HC09极长money/source/negative与thinindividualpoint；HC10相邻gap不同语义不合并/跨gap不连；HC11 mousehover/leave+Esc临时读数/十字线无导航；HC12 keyboard Tab聚焦/左右HomeEnd可达有效点及可解释缺口、与鼠标同读数；HC13 context/mode/currency改变清除旧读数且往返不复活；HC14 150ms datafade/hover120+reduced直接终态，不跨单位morph；HC15无次级修复/详情页面入口、下游可访问、不遮挡。先最小真实受控图完整journey再扩展矩阵；不是chart/replay，不涉及回放截止。

核心链受控data→四模式→真实point/gap读数→Esc返回默认曲线，适用端到端交互仍要root真实浏览器。DB写NA因为纯受控无IO，真实历史计算、年份三部分原子替换、详情返回及持久化保持NV后续集成验收。

有意义TDD RED/GREEN、精确include单文件测试、strict依赖tsc/lint，提供版本hash/完整diff/log与逐项矩阵。不要运行完整Workspace或重benchmark。冻结IMPLEMENTATION-READY后停止改源，root独立看原图+render和实际操作，workerPASS不能接受；第三formal FAIL/required NV暂停，保留失败原因，不能绕上限。当前P4整票仍0/3。

2026-10-23 10:50 CST澄清：原图320px为尺寸准据，旧round5 438px不替代批准参考。窄屏语义标签与固定轴槽、长读数正常流方案待root实际比较，不预先视觉接受。累计no-rounds显示规则已在HC04纠正为原图及调用方独立字段已知性，不授权任何金融计算。

## Root补充裁定：独立字段coverage

source-missing表示部分来源缺失，不可抹掉caller明确available的roundCount/winRate等独立字段；各模式可绘制本字段合法已知值，缺失金额本身断线并解释原因。future/loading/error整点及读数中的隐藏金融数值都屏蔽。no-rounds累计可绘制明确提交累计，其它模式沿原图缺口；可以说明明确给定的独立count，不推算或补0。

## Root明确批准的局部响应裁定（2026-10-23，candidate1冻结前）

以下三项由root通过本任务消息批准，并明确授权实现者追加本派发与candidate1 DESIGN-COVERAGE/偏差记录。它们是有界响应适配；不能声称原图已直接证明其窄屏视觉效果，root仍须在390/1440及临界宽度独立实测比较。

1. 旧完整数据的pending/error原因放在卡内y44–62的18px状态安全带，绘图区仍从y66开始，卡外高仍320px。常规原因完整显示；过长原因单行视觉省略，保留完整可访问文本与原生title，并保留等待蓝/失败红的区别。不得让状态提示把曲线、列表或下模块向下推移。
2. 月份/年份语义标签仅当单行实际放不下时交错为两行y298/312，保留11px字号、全部12个月标签、同一绘图区/轴槽和320px外高；能容纳时维持参考单行。最初实现的卡宽<760硬门在边界会反向制造拥挤，root已进一步明确批准移除：按实际可用宽度及真实标签文字宽度依次判断单行→双行，不设置该硬断点。常规12期1440/1280及能容纳全部40年的1328px卡保持单行全显。
3. 超密“全部”跨年包含30/40年等输入；两行仍放不下时，仅年度模式可减少视觉轴刻度标签，以能无重叠的固定索引步长选取，强制保留首末年，内部规则确定，末段允许短于内部间隔。全部数据点、完整YYYY语义/AX、左右/Home/End键盘遍历与完整读数保留；四模式共用同一刻度选择。不删数据、不改plot/320px高/字号、不增加横向滚动。必须保留30/40年与759/760/761临界宽度RED→GREEN证据；实际浏览器可读性仍由root验收。
