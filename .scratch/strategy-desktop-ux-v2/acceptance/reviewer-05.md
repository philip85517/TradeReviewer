# 05 独立验收记录

审查者：Astra Light 映射 gpt-6-astra/low；2026-09-29。本轮仅静态代码/规格审查，无浏览器操作。

依据：批准规格 DD06/DD09/DD12/DD13、05 票 AC01–08、INTEGRATION-03-05.md。审查 results-model.ts、results-prototype.tsx/css 及 running 的来源返回接线。

## 第一轮结论：集成 FAIL，视觉 NOT VERIFIED

X03-01 / P1 同时阻断 05：结果可见时隐藏运行仍接收 Space/ArrowRight，timer 未隔离结果状态，可能推进 M。详见 reviewer-03.md；只读结果与返回前后状态必须修复并实测。

root 已真实复现：结果 R=6/24 不变，但 ArrowRight 将可用边界 M 从 6/24 推至 6/25。

root 提供独立于静态的导航实测：V6/18→阶段结果 R6/18、assets99763.82→最远 R6/24、assets99592.29→仓位 tab/再平衡 filter/scroll146→事件回过程6/24 A drawer→返回来源 R6/24/仓位/再平衡/scroll146 全恢复→普通返回 V6/18、原 Kline C，M及曝光6/24保留。这条导航路径 root PASS；本审查者未亲自操作浏览器，不扩大为全部功能 PASS。

## 静态核对结果（不代替功能验收）

- R 按可用 max/账本长度限制，分析只读取截止 R 的账本前缀；新 entry 默认 R=进入时 V。净值、回撤、权重曲线从相同 prefix 实际计算，权重含现金和 A/B/C/D。
- 期末未平仓不强制清仓。FIFO 买入 lot、卖出逐批消耗；全退出才结束持仓回合，尚未退出回合的减仓已实现单列，剩余 lot 计算浮动损益。总损益对照 assets−initialCapital，零费用和不计息现金口径明确。
- 零平仓回合胜率为 null 并显示不可计算；费用为零，滑点/基准缺失有解释，没有伪造超额收益。组合当日收益由前日组合资产计算。
- 结果事件回过程指定来源组合、事件 cursor、具体标的（无指定时首笔），夹在已展开边界内；来源结果保持同 entry 的 R/模式/筛选/滚动 DOM。普通返回恢复进入前 V/模式/标的/视野。以上需要 root 实测，不能仅据回调判 PASS。
- 主动增加 R 记录结果来源曝光，来源链由 creation 承接；结果当前 selected portfolio 使用独立本金 draft。

## 待验

功能/时间状态：首轮 FAIL（X03-01），其余 NOT VERIFIED。需真实验证早期 V 默认 R、增减 R 不改 M、来源事件→返回保留 R/筛选/滚动、普通返回前 V、完成入口、partial 三标的贡献、空候选/零交易、FIFO 部分卖出及零闭合回合、键盘行为。完全闭合回合仅审查计算口径：当前策略不清仓，不要求超出批准范围新增 UI fixture。两档需指标/三曲线/归因与零回合状态图，匹配 reference 的密度、字体及主次层级。

## 修复复核 1：1440 独立视觉

直接查看 screenshots/05/stage-nav-1440.png、stage-drawdown-1440.png、stage-weights-1440.png，并再次直接对照 reference/tradereview-1440.png 与 DD09/12/13。CSS1440×900；reference 导出为1296×810，按同 CSS 视口的样式层级对比，不假定像素尺寸相同。

1440 这组状态视觉 PASS（限定范围）：保留 TradeReview 侧栏/背景/面板/蓝色选中、约21px主标题和约36px控件；先范围/partial提示、四指标、主图与损益、再贡献/成交的顺序明确。净值与回撤实际曲线区别清楚，仓位展示 A/B/C/D 和现金全时序。金额中性色与正负变化色分离；零闭合回合明确不可计算，部分减仓 -¥299.97 与浮动 -¥107.73 分开。stage-nav 为已滚动的归因视图，不视作首屏裁切。未见 P2 以上视觉缺陷；1280及空候选/完整结果仍 NOT VERIFIED。

X03-01 静态修复 PASS：结果可见时 keyboard/timer 均被阻断，root Right/Space 实测 M 未变；历史 FAIL 保留，结果返回状态最终复核仍待 root。

## 1280 复核：X05-01 / P2 视觉 FAIL

直接查看 stage-nav-1280.png、stage-weights-1280.png。整体宽度、指标与主图/损益层级成立，但净值 Y 轴 1.0126 与 X 轴日期实际渲染为明显细小窄字，正常100%查看难读；净值底部 Y 刻度同时被固定读数条覆盖。仓位日期也有同样缩字。对比同批03真实K线轴，差距清楚。不能用 CSS 声称11/12px消除此实际缺陷。

代码佐证：ResultChart 使用固定 viewBox 与 preserveAspectRatio="none"，SVG text随非等比缩放；readout absolute bottom:31px叠在绘图区底部。要求按实际可用宽高绘制或将轴文字置于不缩放的层，并为读数条/刻度预留互不遮挡区域；两档修后重采。此项使05视觉门槛重新 FAIL；前轮1440 PASS是当时已看状态的范围结论，不覆盖本次更窄边界发现。

root 补充 X03-01 返回仍6/24，故该项修后真实快捷键/返回路径 PASS。异常会话中留存的6/25曝光来自修前故障，不抹去，也不能作为修后曝光新旅程证明。

## 最终独立复核：PASS（本票范围）

直接查看修后 complete-nav-fixed-1280、weights-fixed-1280、empty-nav-fixed-1280、empty-weights-fixed-1280/1440、stage-nav-fixed-1440、stage-drawdown-fixed-1440。X05-01 修复视觉 PASS：两档轴数值与日期现在实际可读，Y轴三档值完整，读数条移到图下方不再覆盖刻度；仓位也有0/50/100%刻度。原 FAIL 历史保留。

完整/阶段标签、R与可用边界、partial说明、四指标→曲线→损益/贡献层级两档成立。全现金显示NAV1、收益/回撤0、100%现金时序、零事件、无持仓与零回合不可算，未将缺少回合写成胜率0。部分减仓与浮动仍分列；未见剩余 P2 以上静态/视觉问题。

root最终真实证据：修后新entry V=M6/24，body Right/Space并等待几十秒，M不变、返回当前日6/24且未播放；完成实验4后 R20/仓位/首次建仓filter→事件6/17→列表→结果恢复R20/仓位/filter/scroll272，普通返回V21，新entry V17默认R17；empty全现金完整结果真实UI与曲线通过。结合此前R/来源返回旅程与本审查独立静态/视觉，05可由root接受。独立模型30 slices报告只作补充，不替代这些UI证据。本审查者未亲自操作浏览器，也不执行关闭票。
