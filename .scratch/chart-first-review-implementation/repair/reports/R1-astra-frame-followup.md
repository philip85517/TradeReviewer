# R1 frame 二次审查与首帧视觉门槛

2026-09-26；gpt-6-astra / low。保留 `R1-astra-frame-review.md` 历史；本次只追加文档。未操作浏览器、未运行测试、未写数据库。已读取更新后的R1-frame报告、CSS、workspace状态/底栏实现及 `diagnostic-after.txt`，实际view_image查看root提供的 `R1-frame-intermediate-1440.png`。

## 前三项修复复核

| 原项 | 源码复核 | 剩余证据 |
| --- | --- | --- |
| F1容器下置被覆盖 | pass（源码范围）：删除末尾重复两列/grid-column及viewport单列覆盖，原基础列+recall-work容器控制恢复 | root需真实导航展开/收起测量，尚unverified |
| F2旧96px胜出 | pass（源码范围）：两个layout容器的96px声明已删除，基础snapshot统一展开上限 | root需展开代表图/全记录测量可读空间，尚unverified |
| F3窄屏阶段36px | pass（源码范围）：≤900px统一变量44px，阶段按钮沿用该变量 | 实际390px命中框/焦点尚unverified |

报告中headerActions已正式声明，临时cast已移除；实现报告记录2个frame行为测试pass/74 skip，含返回/数据/检查操作。此为worker证据，未将其升级为视觉通过。

## F4 · P2 / R1 gate · 底栏集成仍堆成多层，E19未通过

截图可直接看到：持仓/截止是一张独立边框条，下一行再有回放动作；下方“三阶段代表图”和“全部记录与快照”各自占一整行，最下方再重复成交来源。root测量为header61、chart570、bar116（两行且重复边框）、collapsed panels38+38+5gap、selected fill18，主图下方约228px。该测量由root提供，本代理未重复浏览器测量；图像观察独立支持多层占高结论。

依据主规格102–107及E19：底部约48px起的一条控制/关键指标，必要时自然换行。1440桌面有空间但仍采用旧条层叠，不属于窄屏必要换行，也不能以“R3后面全面收敛”跳过本次G08首帧门槛。主图高度570本身不是独立失败阈值；失败是主操作结构、重复层级与已确认图D04/D05不同。

确定的结构接缝：workspace约2626行是 `.recall-replay-bar > .recall-replay-bar__primary > .recall-position-strip / .recall-controls`；CSS的清边框、padding、flex规则仍为 `.recall-replay-bar > .recall-position-strip / .recall-controls`，不匹配实际孙节点。即使修正选择器，完整截止/成交/四项指标加8个长动作也不能自然形成约48px主条；必须同时收敛默认信息。

### frame/state最小联合修复（本次门槛范围）

- state owner：主条依设计顺序保留上一根、播放/暂停、下一根、简短已揭示截止、下一决策、留存及阶段侧栏入口；当前重要指标紧凑显示。保留含时区的完整截止和双截止可访问详情，不通过删除信息解决。
- state owner：完成回合、完整历史、代表图、全部记录汇入同一个“更多/记录”入口；该入口区分三阶段代表选择和完整决策/快照。取消两条全宽常驻summary；当前成交来源进入同一个可访问详情。完整历史/完成仍保持原处理器、来源标记和完成规则。
- frame owner：按实际`__primary`内子节点清除旧position/controls边框、sticky、padding/min-height及多余spacer，采用一个横向布局；只在可用宽度不足时换行，控件不缩字号/命中区。展开内容给可读独立区域，不能重新引入96px盒。
- root验收：1440默认持仓/买入前/事后，记录主条实际高度、默认常驻层数、首屏核心动作；1280及导航展开验证必要换行；390后续触控检查。所有动作保持可达，不能只是视觉隐藏旧面板造成入口消失。

## 状态修复的中间证据（尚无最终state结论）

`diagnostic-after.txt`记录16:17:25的一次诊断：6 passed，6.45s。覆盖新鲜next bar/timer、nextDecision首笔及下一笔、选首笔后逐根、未来标签遮蔽、回早期nextDecision不跳旧晚游标、直接后续决策后来源标记。原3个失败反例已在这份日志中变绿。该diagnostic文件第44行mock ReplayChart，故只能证明工作区状态/交互，不证明真实绘制、视野跟随、成交锚点或视觉。

实际代码复核支持：pre-entry nextDecision使用`firstDecisionInExecutionOrder`及`revealRecallDecision`，不再调用`switchPhase(holding)`；selectDecision/global入口单调合并hasSeenFuture；blindEpisodeSelection在非完整历史/非post状态遮结果标签；末尾禁用和原因/回早期入口存在；刷新路径传false抑制新revealRequest。完整保存重开、同K决策顺序和所有入口来源仍待state报告/定向证据核对。

截图中的当前K/成交锚点异常由root与chart owner处理；本报告没有对未冻结chart下最终结论。6case全绿不能覆盖该真实图像异常。

## 当前结论

前三项CSS源码缺陷局部解除；**R1首帧E19/G08仍fail（F4）**。真实回放、所有视口、状态保存重开、导出均未因本报告接受。等待state报告后继续定向审查，不运行全量套件。

协调者后续调度说明：state owner继续收敛JSX，frame owner接收实际hooks后修CSS；本代理本轮停止完整state审查，待下一轮稳定报告一次复核。工作区类型检查涉及chart仍在修改的WIP，不能据此接受整体验证，也不将未冻结中间结果写成最终global failure；本代理本轮未独立运行typecheck。
