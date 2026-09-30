# 06 快速展开/恢复协作契约

批准来源：docs/specs/2026-09-29-strategy-desktop-ux-design.md DD06–DD08/DD11/DD12、06票AC01–08、DESIGN-COVERAGE C21–24/C30/C28。主旅程：确认取消→实际逐日展开→停止/失败→重试或明确排除→落后组不可用→结果；演示部分成交与内存检查点恢复同票验收。依赖03/05接受后开始实现。本文件为接线选择，不删减批准规格。

## 唯一写入责任

- desktop_workbench_01（Luna6/max）：running-prototype.tsx、running-prototype.css、新running-recovery-session.ts（若需要）、implementation/06-runtime.md。整条06状态与调用接线唯一owner，不写running-model/恢复子UI/result/creation。
- desktop_creation_02（Luna6/max）：running-model.ts、implementation/06-ledger.md。仅扩展合成执行账本，保留现有默认口径、标的及已接受日期，禁止改creation/runtime组件。
- desktop_workbench_style_01（Luna6/max）：新recovery-prototype.tsx/css、results-model.ts、results-prototype.tsx/css与implementation/06-ui.md。恢复/演示UI与结果对新执行状态口径的消费。不写running组件/model/creation。
- root：整页视觉、跨文件状态、覆盖及真实浏览器接受。Astra/low：独立静态及截图直接对照，未实施UI。代理不再派人、不控制浏览器、不改数据库/API、无commit/push/merge。先读批准全文及参考图，再代码。原子写入；不得删文件后分步重建。

## 模型提供方 → runtime/结果消费方

running-model新增并导出：

```ts
export type ExecutionOverride = { cursor:number; kind:'partial'|'unfilled' };
export type ExecutionStatus = 'filled'|'partial'|'unfilled';
// 现有TradeEvent增加可选字段，保留trades为真实已执行量；plannedTrades独立只读计划。
// executionStatus?:ExecutionStatus; executionNote?:string; plannedTrades?:Trade[];
buildLedger(calendar,maxCursor,draft,strategy,overrides?:readonly ExecutionOverride[]):Snapshot[];
nextExecutionCursor(calendar,fromCursor,draft,strategy):number|null;
```

默认无overrides与已接受数字/事件完全一致。overrides只在该组合既有计划建仓/调仓日使用，下一事件函数仅使用确定性模板日历，不显示未展开的数值；工具文案明确“下一次计划执行的合成演示”。partial每笔目标差量成交50%，unfilled无成交；计划/目标不伪称实际成交。费用0、小数股，cash+真实holding=equity，已完成日snapshot/events原子一致。未成交可保留事件但trades为空，原因及计划记录可查；不是失败半日。follows初始持有之后无后续计划返回null，不强加新调仓。重复计算同prefix幂等。

Runtime为每个稳定PortfolioId保存overrides记录；增加/重试不能改写历史事件。结果FIFO只读取实际trades；未成交事件不应混入“已执行再平衡”计数，结果过滤/标签准确区分。UI owner与模型owner直接确认字段，不发散真实撮合。

## Runtime一致状态

保留全局V/M，提供每组Mi（未排除随M，排除组冻结安全边界），所有账本build至各自Mi。一次advance检查确定性模拟故障；发生故障时该日所有同步参与组不提交，停在前一完整日并停止播放/展开；显示失败组/失败日/原因/最后完整日。重试从同安全边界做一次，清除一次性模拟故障，不重复买入。用户明确排除后其他组可继续，失败组Mi不变；切它且V>Mi时摘要/持仓/当日指标不可用、图形截止Mi、事件计数只到有效边界，并有显式“查看最后完整日”。不可静默跳V或forward-fill旧估值。

结果入口对所选组clamp到Mi且文案明确部分区间。回看/普通返回/来源结果等已接受行为必须保住，隐藏runtime键盘和timer均不推进。T0实际日期与行情cutoff仍分开。

批量展开与逐日/播放共用同一提交动作，不预设终点。阶段confirming取消V/M/账本/exposure全不变；expanding进度来自提交完成日数，可停止。每个tick完成真实一日账本，可用短异步节拍让停止按钮可用，但不能先算完再播放假进度。成功进入已有真实结果页；失败/停止/离开/查看配置/派生先停止在完整日。结果曝光source增加bulk/快速展开；只记录实际成功最远日期。

检查点只在内存演示工具，创建/重试checkpoint保存当前已完成快照；模拟保存失败保留此前checkpoint和当前本地状态，明确无真实持久化。显式重载恢复该checkpoint的M/V/各Mi/overrides等同一状态，仍保留原更远曝光日期/来源/时间，不伪装盲看。浏览器reload照常全重置。

## UI提供方 → runtime消费方

新recovery-prototype.tsx导出小型纯受控组件与props，UI owner先和runtime owner确认具体签名，再各自原子落地（具体名称允许双方选定）。职责：

- 快速展开就近确认层：后果、当前进度→计划结束、主确认/取消，Escape取消/焦点还原；显示进度与停止。
- 错误/落后组合可读反馈：失败原因、最后完整日、重试/排除/列表，警示不遮主时间条；普通事件仍中性。
- 默认折叠“原型演示工具”：一次性数据中断/执行失败、下一次计划部分/未成交、创建内存checkpoint/模拟保存失败/重试/重载。所有选择均清楚“演示”，触发前暂停，不能隐式运行。
- 控制层只能调用runtime提供动作，不另有时钟/账本/M；支持实例唯一ID与键盘。保持1440/1280满宽、12–14px关键文本、36px控件，避免撑高时间条挤掉主图。无新窄屏设计。

Runtime owner实际接入上述组件并确保提供结果；子组件/report单独PASS不关闭06。UI owner在新文件存在时立即通知runtime，避免未存在import。

## 验收计划

Root实际浏览器+独立Astra两档看确认/进行/停止/失败/恢复/落后/partial详情及checkpoint，证据acceptance/06.md、screenshots/06/。计算通过公开buildLedger验证默认基线不变、partial/unfilled prefix与cash/holding对账、重复重试一致，再真实UI核对。FAIL/NOT VERIFIED阻止06接受，07依赖06接受。保存DB、窄屏、物理触摸N/A范围明确，非自动省略适用门槛。
