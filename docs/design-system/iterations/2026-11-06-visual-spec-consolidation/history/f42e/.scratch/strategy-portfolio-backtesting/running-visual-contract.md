# 回测工作台：最小贯通原型契约

沿用用户已确认A与现有TradeReview风格。当前目标：补齐准备页开始入口，验证开始→逐日行情→持仓/事件→暂停回看→内存重开的真实可点击路径。范围是05票第一切片，尚不关闭05，不扩展正式引擎。保存失败/中断/完整结果比较暂留05/06未验证。

参考：docs/specs/2026-09-29-strategy-portfolio-backtesting.md S05/S06/S08与D03；creation-visual-contract.md V01/V02；screenshots/creation-baseline-1440.jpg、creation-history-1440-final.jpg、creation-preview-1280-final.jpg。新工作台无批准画板，单一A深化，用户要求优先于默认多方案。

所有权：creation_state_repair（gpt-5.6-luna）实现完整运行状态与真实图表/该页样式；主协调者不写UI，独立视觉与旅程验收。允许creation-prototype.tsx接入，新running-prototype.tsx/css；不得改globals、旧A/B及业务代码。需要lightweight-charts5.2真实CandlestickSeries，禁止以mock图表替代。数据明确合成，不读业务库。

W01 准备页主动作“开始回测”，次动作返回修改。继承日期、本金、期限、全部选中策略/预设、盲看/覆盖场景。进入运行仍停T0、未成交，播放由用户开始。
W02 顶部常驻当前观察日、已推进日、合成标识、所选策略版本。控制在主图上方：下一日、播放/暂停、速度、运行至终点；末尾禁用前进并显示到达名义终点。只模拟周末日历且明显标记。日期生成严格T0后至名义终点，五档期限不能都假装七天。至少20根T0之前合成上下文bar，逐日揭示真实bar。轴只按已可知数据生成。
W03 默认标的K线为主；通过“标的K线 / 组合净值”切换同一主图。当前持仓/现金与简明事件侧栏；桌面图高约360，1440/1280下核心控制/主图同屏；390纵排图高280、按钮44px，无整页溢出。复用现有深色变量/字体/蓝色动作/导航。
W04 全部选中策略共享市场时钟、各自组合账本。合成A/B价格，首次日开盘建仓、后续每日按收盘估值；EMA每5个合成交易日、quality每20个日调仓，无调仓预设不重平衡。规则为演示调仓模板，不声称真实策略运行。无候选始终100%现金且无成交事件。财务必须现金+持仓=总资产，不用固定100%现金搭配已有持仓。事件展示原因、旧/目标/实际、买卖数量/费用；费用可简化0但说明。不必伪造未成交。
W05 区分已推进maxCursor与观察viewCursor。下一日和播放推进并显示新增bar/当日成交；暂停不推进；已知历史回看仅改变观察，隐藏该日之后持仓/事件/图形，明确曾看至maxCursor。恢复最新进度回maxCursor，不重算交易。选择事件先暂停并定位当天，选策略/标的不改变游标。运行至终点标记主动展开来源，历史回看保留。图表推进自动显示末根，resize不推进；离开运行清理播放定时器。
W06 返回实验列表→重开保留内存cursor、selected strategy与曾看后续提示；回准备页继续不重置。修改创建配置、新建/重新开始使旧运行失效，刷新按原型契约清空。不宣称数据库保存。

N/A：Text训练输入、人工逐笔审批、真实撮合/节假日/数据库保存、真实触屏；此观察者原型没有这些输入。其余05异常流仍NOT VERIFIED，不能提前关票。

验收：从默认创建到开始，截图T0/第1日/第5日/回看/终点，直接核对真实K线和轴变化、成交/仓位变化。双策略/hold预设、empty现金，返回列表重开；1440/1280/390视觉，控制台、类型/构建。

所有权细化：creation_visual（gpt-5.6-luna）接管running-prototype.css与running-visual-implementation.md；creation_state_repair只写两个TSX及状态报告。仍为同一首条纵向切片的实现配合，不扩展下游模块；主协调者独立全页验收。

状态实现接管：creation_state_repair增量首稿未满足数据与回看契约，已停止。running_state（gpt-5.6-luna，独立新上下文）接管running-prototype.tsx与creation-prototype.tsx的唯一所有权。CSS仍为creation_visual；主协调者保持独立验收。

再次接管：running_state的重写仍存在cutoffIndex错误且W05/W06未闭环，停止该owner。复杂状态修复改由running_integration（继承主会话模型，未指定模型覆盖）负责；这是默认Luna首稿连续未通过后的实现例外，已向用户说明更换独立实现上下文。CSS继续creation_visual，主协调者仍未实现UI并独立验收。此前失败保留。
