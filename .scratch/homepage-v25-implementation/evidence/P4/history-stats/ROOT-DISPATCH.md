# 历史四指标受控叶子 — 首候选派发契约

2026-10-23，用户已批准 V2.5 首页+公共规范、GPT6.1 SOL Ultra 并行实施。本叶子为原P4未实施的历史四卡，0/3；不重置任何旧任务（指标卡当前是另一既有叶子的候选3）。实施 owner /root/metrics_candidate2，实际 gpt-6.1-sol / ultra；root 独立功能、浏览器、视觉接受，并负责整页视觉及完整跨层数据流。无授权设计差异。禁止再派代理。

## 准确依据与范围

必须读取当前 AGENTS、docs/agents/development-workflow.md、task-decomposition.md、frontend-control-audit.md、ui-task-templates.md、issue-tracker.md，及适用 brainstorming（原设计已批准无需再问范围）、test-driven-development、verification-before-completion。

批准规范 docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md HP05:349–394、HP09:467–515、HP08:516–549；追踪HV25-32/33/35/47–51，原稿无稳定elementID，文本HOME-HP05-B001/HOME-HP09-B001/B031。准确参考 source/images/history.svg、history-stats-win.svg、history-stats-rounds.svg、history-stats-empty.svg、history-stats-error.svg、history-stats-source-missing.svg、history-stats-extreme.svg；公共 visual-samples-board.svg/atoms.svg 胜率卡 A/B。P4/ROOT-FINANCIAL-DECISIONS.md 决定上游语义，本叶子仅显示调用方已提交结果。root已直接看8张历史参考派生PNG（evidence/continue-2026-10-23/history-references），实现者仍须读原图/准确manual。

仅新增 app/components/homepage-v25/history-stats-cards.tsx、history-stats-cards.css、history-stats-cards.test.tsx，以及本history-stats目录候选证据。不得改现有 MetricCards、chart、控制器、财务、host/session、Workspace、共享tracker、旧证据。不要提前接入页面或声称P4接受。可在本证据下新增隔离测试配置与合成受控调用方，不写数据库，不启动/停止服务。

## 输入输出接口与数据边界

导出受控 HistoryStatsCards 与 readonly Props/summary 类型。输入 summary:null或完整提交对象、reportCurrency、同现有叶子 ready/pending/error/empty 带原因状态、sourceId/requestGeneration上下文。summary独立含 closedNet 与 allocatedFees（沿用只读HomepageV25Metric含原币精度/coverage/reasons/FX）、closedRounds、winningRounds、winRate（各为readonly {value:string|null, available:boolean, reasons:readonly string[]}，百分比值使用0..100单位而非比例）。计数与胜率可另带coverage说明；如需增加只有展示证据字段，先清晰写类型与语义。

这里只格式化、检查币种与有效有限字符串，不从盈亏推导胜负、不算率/回合、不重建账本或换汇、不从known子集推总额。closedRounds已知而amount/rate未知必须独立保留。status pending/error时显示调用方原完整summary，不缓存金融数据。空范围由明确empty+summary给出：0回合、胜率—，不伪造净额或费用0（仅输入明确known0才显示0）。未知净额不抹除已知rounds；0%是真0，不能由falsy变—；持平是否入分母由调用方决定。

四卡固定顺序：已平仓净盈亏、已平仓回合数、胜率、已扣费用。正常无常驻完整性badge。提供四卡各自说明/精确读数（可由明确info按钮打开readonly浮层，参照公共控件），金额保留source原值、原币、覆盖/原因与FX来源，计数/rate说明不隐式计算。打开/关闭/Esc/外部点击/Tab可用；关闭焦点回原触发器，来源或币种失效永久清除，旧context回来不复活，外部focus不被误抢。退出视觉160ms时立即inert/aria-hidden；减弱动效直接终态。

## 视觉/控件与旅程矩阵（分母必须逐实例展开）

原历史SVG1440×1000，局部content x56..1384，四卡y94 h88，四等宽、约18gap。实际放入宿主沿用公共内容起点，无新增外层左边距。标题由父页面负责，本叶子不重复历史标题/年份/图。文本标签14/次色，主值28/600，正负与历史参考/公共norm对齐，card约10radius、边框/背景准确读图。

A常规321×88：胜率主值与盈利回合/总回合共基线；B压力278×104：说明在计数上方4px且右对齐。容器感知实际卡宽，不能只靠window；完整信息在窄屏可读、不遮邻卡/下游。root比较1440×1000、1280×800、390×1000、A/B两侧、超长数据。缩放100%、DPR1；SVG原DPR未注明，比较按CSS原布局推定，不能声称像素来源已知。

HS01完整9/14及64.3%；HS02真正0%且rounds5；HS03 100%；HS04没有回合0/—；HS05 amount/fee未知但rounds已知；HS06 round未知且其他独立已知；HS07初始pending骨架保四卡最终几何；HS08已有数据pending旧值+更新蓝#6CA8FF；HS09更新失败旧值+红#FF8592且原因；HS10初始失败不伪0；HS11极长全精度金额/大计数/FX来源；HS12 reportCurrency失配；HS13来源/币种往返不复活；HS14四个trigger鼠标/键盘/Esc/Tab/外部；HS15主值150ms整组淡入、hover120ms不改size、浮层160ms opacity+4px且减弱终态。静态正常样例里的无语义数字不能替代输入knownness。

核心链：受控读取→四卡独立已知性→准确卡读数→退出与上下文更新；本叶子无IO/写入，DB写NA有范围依据，真实历史金融计算/年份原子更新/持久化/整页功能仍NOT VERIFIED，由root后续集成验收。鼠标/键盘/模拟触控/真实触控分列，不能用合成事件代替真实浏览器。

## 验证与交付

先有有意义行为RED（缺失组件也是有效编译前置但必须区分），再实现；覆盖独立knownness、空与零、币种/来源、focus寿命、motion中断，不写镜像CSS断言充数。精确include配置、单文件产品测试、strict依赖范围tsc/lint。禁止跑完整Workspace/性能benchmark以免争用。报告SOURCE-SHA256、输入/最终源码快照及精确diff、命令与完整日志，冻结IMPLEMENTATION-READY后停止写3源文件。

适用功能、实际浏览器交互、独立原图视觉三门必须分别报告；实现者没看真实render就视觉NV。root在最终版本逐项验收；第3轮FAIL或required NV暂停同任务并记录原因；未授权不能重置/改名绕过。P4整票0/3保持，当前历史模块尚无任何功能PASS。
