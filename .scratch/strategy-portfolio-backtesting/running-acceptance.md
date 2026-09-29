# 开始回测与工作台第一切片验收

- 当前状态：W01–W06首条集成路径技术与视觉PASS（原型范围）。工作台设计仍等待用户反馈。
- 范围：running-visual-contract.md W01–W06。05票其他异常流和最终设计选择未完成，不关闭该票。
- 实现：creation_state_repair / gpt-5.6-luna。独立验收：Codex主协调者（未写UI）。
- 工作区：/Users/zhoulin/.codex/worktrees/0972/TradeReview，codex/strategy-creation-prototype。
- 预览： http://127.0.0.1:3047/?prototype=strategy-create&variant=A
- 数据：prototype-isolated.sqlite显式隔离服务，原型只使用内存合成行情；无业务API/写入。

| Gate | 状态 | 证据 |
| --- | --- | --- |
| W01创建配置→开始与T0 | PASS（prototype only） | |
| W02真实图表逐bar与终点 | PASS（prototype only） | |
| W03整页视觉/图形视口 | PASS（prototype only） | 1440×900/1280×800/390×844，DPR1；参考creation-baseline-1440.jpg及creation-preview-1280-final.jpg |
| W04独立组合账本/事件/空仓 | PASS（prototype only） | |
| W05双游标与未来隐藏 | PASS（prototype only） | |
| W06返回/重开/配置失效 | PASS（prototype only） | |
| typecheck/build/console | PASS（prototype only） | |
| 真行情/插件引擎/数据库持久化/真实触屏 | NOT APPLICABLE | 本轮合成观察原型 |
| 05票保存失败/中断与工作台HITL设计 | NOT VERIFIED | 首条主图契约接受后再扩展，不声称已完成 |

## 独立操作计划

1. 默认EMA创建→开始。T0已知20根上下文且无成交、现金=本金。
2. 下一日→真实主图新增bar，显示第一日收盘/持仓/现金/首次建仓事件。
3. 第五日周期事件，旧/目标/实际可解释且账本总和正确。点击事件定位；无未来bar/后续事件。
4. 自动播放→暂停，等待一次播放间隔确认不再推进。切净值/标的、resize不推进。
5. 回看T0→图/持仓恢复当时，曾看后续说明保留；恢复最新→不重复成交。列表重开保留进度。
6. 运行终点→最后bar实际可见，前进禁用；短1周与长1年日期范围区别。返早期保留主动展开来源。
7. 双包分别使用每周和初始持有：共同市场时钟，独立仓位/预设。empty现金场景无虚构成交。
8. 更改创建参数→旧运行清除；刷新空列表，保持原型约定。
9. 首张桌面工作台及关键状态直接看图对照；窄屏图表/按钮可达，无整页横溢出。

## 问题与复验历史

保留发现的FAIL，不由后来PASS覆盖。

### 初稿静态审查（未交付）

R-F01：最初makeBars无T0前上下文且终点循环越界，月末日期溢出/UTC日历偏移。R-F02：固定quantity和holding value不一致、净值独立公式、hold预设未约束事件。R-F03：running与creation-main并排渲染，未清理所有配置变更下旧运行。R-F04：CSS使用未scope的side-block等选择器可能污染业务主页。上述问题已交唯一owner修复；以最终真实浏览器证据接受，不把WIP能编译视为完成。

状态实现接管：creation_state_repair增量首稿未满足数据与回看契约，已停止。running_state（gpt-5.6-luna，独立新上下文）接管running-prototype.tsx与creation-prototype.tsx的唯一所有权。CSS仍为creation_visual；主协调者保持独立验收。

再次接管：running_state的重写仍存在cutoffIndex错误且W05/W06未闭环，停止该owner。复杂状态修复改由running_integration（继承主会话模型，未指定模型覆盖）负责；这是默认Luna首稿连续未通过后的实现例外，已向用户说明更换独立实现上下文。CSS继续creation_visual，主协调者仍未实现UI并独立验收。此前失败保留。


## 最终独立浏览器验收

2026-09-29，主协调者未参与UI实现，真实IAB浏览器鼠标/键盘操作。最终owner为running_integration（继承主会话模型）；CSS为creation_visual/gpt-5.6-luna。首稿问题均已修复并复验，历史失败保留。

- 从空列表经过现有创建四步，准备页出现主按钮“开始回测”。进入T0保持2024-06-14 16:00、0/5日、20根上下文、现金100000、零成交。截图running-t0-1440.jpg。
- 下一日真实日K线右端新增2024-06-17红bar；现金10000，A市值44463.98、B45515.89，总资产99979.87、净值0.9998。截图running-day1-1440.jpg。账本加总一致，事件明确开盘买入、当前收盘估值。
- 连续推进至第五日2024-06-21，真实末根可见，事件2条，A买92.0993股、B卖122.1072股，目标55/35/10，现金9921.52而不是重置10000，资产99704.14。截图running-day5-1440.jpg。前进/播放末尾禁用。
- 回看T0图回到原20根上下文，现金100000、0成交，已推进仍5/5并保留曾看至21日提示。返回列表显示已到终点，重开仍在T0回看；恢复最新返回第五日。点击首笔事件定位17日，恢复不重复成交。截图running-review-t0-1440.jpg。
- 组合净值为账本计算的归一化折线，1280截图running-nav-1280.jpg；A/B切换显示不同实际K线且不推进。
- 返回准备页再继续保持回看/账本；更改期限为1个月并选择双策略，重新开始回到0/20日。quality选择初始持有，20日末仍只有首笔事件、现金20000、资产100466.83；EMA保持自己的周期账本。
- 播放0.5x实际推进到11/20；点暂停后跨一个完整播放间隔仍11/20。运行至终点20/20，名义2024-07-14/合成实际07-12分开显示。主动展开来源及时间在回看T0后仍保留。
- 无候选、200000本金、1年：260/260日，名义2025-06-14/合成实际06-13；最新bar在真实主图右端可见。两策略均无成交、现金=资产200000、净值1。截图running-year-cash-1280.jpg。
- 盘中与闰月配置直接浏览器验证：T0 2024-01-31 10:00，最后完整bar01-30；1个月名义/合成实际终点02-29，21个合成交易日。不把盘中当天收盘注入T0。
- 视觉直接对照本任务引用TradeReview基线：1440/1280侧栏、品牌/主色/字体密度一致，控制与图360px在首屏；390导航纵排、图280px、回看与详情可滚动到达。曾发现两个header action仅36px，CSS修正后实测44/44；所有页面无整页横溢出。截图running-390-final.jpg；未把窄屏鼠标操作记为真实触摸。
- 最终再次从新标签从头创建→开始→键盘Enter下一日，显示1/5且console error=[]。开发中热更接口/构建曾产生onStatus和Vite reload错误，记录为中间状态；最终重启后新标签无此错误。
- npm run typecheck / npm run build / git diff --check均PASS。running-build.log保留构建信息（Node弃用、OpenCV externalization与chunk体积提示仍存在）；CSS PostCSS检查无unscoped selectors。
- 服务最终session55584，绑定127.0.0.1:3047；TRADEREVIEW_DB_PATH显式prototype-isolated.sqlite。服务保持运行。保留起始准备页和已完成合成样本浏览器标签。刷新仍清空内存，此前创建刷新契约未变。

限制：真实回测引擎、节假日日历、财报/行情接入、小数股/费用真实性、实际保存恢复均未实现。运行至终点在这个小型原型中同步逐日计算后展示终点，不是后台可取消任务；其进度/取消、保存失败、数据中断和最终比较仍属05/06后续设计。05票保持open，不将本次技术PASS当用户接受。
