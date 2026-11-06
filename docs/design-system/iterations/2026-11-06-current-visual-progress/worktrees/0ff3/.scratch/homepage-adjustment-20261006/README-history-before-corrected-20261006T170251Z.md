# 首页完整修复与验收 — 推进中

2026-10-06 16:15 UTC（上海 2026-10-07 00:15） · State: open · Status: acceptance-failed · /root

用户要求“先推动整体的完整修复与验收”。既有原始数据和全部历史失败保留；未提交、推送、合并或发布。最新源码与受控组件旅程的核验继续推进，完整产品尚未放行。

root 刚在冻结源码上执行五条新增/修正路径，**4 PASS / 1 FAIL，零源漂移**：[准确运行记录](acceptance/integrated-repair-five-controls-20261006T161042Z.json)、[原始日志](acceptance/integrated-repair-five-controls-20261006T161042Z.log)。native 15m fallback、coverage-only hourly、完成现金保存后的 A→B→A，以及确认导入→返回原交易库搜索范围通过。这里使用真实组件和模拟传输，不是浏览器或 SQLite 持久化验收。

现金相同范围 original→CNY 重订阅仍 **FAIL**：新 GET 增加一次且请求字段完全相同，响应保持未决，但现金状态仍为旧的已保存/摘要失败，未进入加载态。Issue27 已重开此真实消费者反例，保留强 pending/保存事实/禁用重试断言，先独立只读核对最小响应式请求身份修复，再交 Luna 唯一源码 owner。旧 lint guard 的限定源码 PASS 和旧弱断言 2 PASS 不能消除此失败。

[Issue25](issues/25-market-publication.md) 日/分时数据发布、无证据缓存保留和取消边界已有限定源码与 12 项受控通过证据；新两条分时控制在本轮通过。Issue26 仅按两次测量裁定一个测试总预算及确认后查询预算，动作/断言/默认期限保留；本轮完整受控返回路径通过。两处新测试 provider 类型和现金 lint guard 仍待最终 fresh type/lint 复验。修复稳定后 root 将统一运行九套直接工作区消费者、type/lint/diff/build/runtime，再更新 3031 预览构建。

先前 327 文件全量 **3161 PASS / 4 FAIL / 6 SKIP** 和后续九套 **176 PASS / 1 FAIL** 原样保留，不能称最新全仓通过。字号、命中区、偏好生命周期的限定修正已有 root 14 文件 200 项通过；新鲜关联检查不会冒充全仓或视觉接受。

自动采样、桶边界及依赖 2:1/首屏/窄屏布局仍在范围内，等待最小真实图门槛。浏览器 URL 协议安全拒绝已请求恢复，未绕过。最小真实图、实际隔离保存→返回→reload、匹配状态独立视觉与真实输入均 **NOT VERIFIED**；3031 仍运行上一阶段构建。权威：[实施契约](IMPLEMENTATION-SPEC.md)、[覆盖矩阵](DESIGN-COVERAGE.md)、[当前验收](acceptance/FINAL-ACCEPTANCE.md)。



## 2026-10-06T16:34:33.903397+00:00 — root 现金三个控制的准确边界

冻结 7fbe13cb…cb1e / 594d4ef8…0180 运行 `integrated-repair-cash-controls-20261006T163026Z.json/.log`：exit1，15.89s，2PASS1FAIL，零源漂移。原 same-key 强 pending/保存事实/禁用重试/准确新错误 1919ms PASS；完成保存 A→B→A 2700ms PASS。原 measured same-key 生产缺口有 matching-version GREEN，旧 ce6 RED 和 whole-run FAIL 均保留。

新增 newest-post-save 控制在初始现金基准100000等待失败（1723），未到PUT，不构成 closure 生产RED。已交唯一Luna仅修新增传输fixture的公开阶段；保存完成前只能返回初始基准，公开切CNY才延迟Q1，PUT成功才开启R2。所有旧a1c29字节逆向保留、生产7fbe不改、期限/断言不降级。该新增closure旅程仍NOT VERIFIED直到实际运行。独立源码限定PASS见 `issue27-cash-pending-independent-review.md`；不是完整产品接受。



## 2026-10-06 16:46 UTC — root 新鲜整合门槛仍FAIL

最终冻结7fbe/fd889/043的九套182项：181PASS1FAIL（alias canonical V2立即读取null），typecheck唯一coverage-only闭包可选string错误。lint无error但15warnings；diff/build/runtime5PASS；所有checks源manifest无漂移。准确证据 integrated-repair-root-final-results.json 与六份raw日志。现金新post-save单项PASS且workspace94项整文件PASS，独立限定签署56d0fb82；同key原强控制/旧错误保护真实消费者PASS。

新的失败已建Issue28/29并补入派发前覆盖映射；先只读诊断alias，type仅捕获已检查的观测区间到const。仍不宣称整体或最新全仓通过，不更新预览为已接受产品。历史4FAIL与现金/fixture FAIL完整保留；真实图/SQLite/视觉和依赖采样布局继续NOT VERIFIED/未完成。

## 上一阶段结果（历史保留）

# 首页交互视觉修复 — 阶段预览，尚未接受

2026-10-06 · State: open · Status: acceptance-failed · 协调者 /root

已落地可信金额/已知小计、集中诊断详情、原币单币趋势与历史日期状态、首页范围与后台任务反馈等阶段源码。最终集中修正解决了诊断清空后旧状态/监听保留、消失币种偏好复活、无ID原因冒充对象数三个反例。用户已授权推进实施，但未授权提交、推送、合并或发布。

独立最终范围复核仍 **FAIL**：详情展开控件12px未达到14px，细指针日/周/月按钮缺少44px最小宽度。保留为 Important，不用测试数抵消。详见[复核](acceptance/final-fixes-re-review.md)、[协调者处置](acceptance/coordinator-final-review.md)。SDD只允许一次最终修正波次，未再派第二波；这不是批准延期或完整接受。

最终源13文件194项集成测试通过，typecheck/diff/build通过。全量在集中修正前版本3145PASS/18FAIL/6SKIP；最终源对这18项单独复跑11PASS/7FAIL。Scoped lint仍1error2warnings，与预先基线相同，保留FAIL。[验证详情](acceptance/final-verification.md)与[最终验收](acceptance/FINAL-ACCEPTANCE.md)是当前结论。

[隔离预览](http://127.0.0.1:3031/)已更新最终构建，PID58269 / session75882保持运行；首页HEAD200、存储状态GET200。工作区0ff3、显式隔离review.sqlite、端口3031；默认conf/runtime.json仍共享业务库/3022。[启动脚本](start-preview.sh)，停服后在本工作区运行 `./.scratch/homepage-adjustment-20261006/start-preview.sh`。两库四类原始记录数量/哈希保持不变。

**真实UI尚未验收。** 自动安全审核拒绝本地浏览器访问，无绕过。最小真实图、保存→返回→重载、匹配状态独立视觉/响应式/真实输入均NOT VERIFIED。自动采样、桶边界和依赖的2:1/首屏/窄屏布局仍在范围内，等待真实图旅程门槛，未声称完成。遵循[项目工作流](../../docs/agents/development-workflow.md)。

执行权威：[实施契约](IMPLEMENTATION-SPEC.md)、[实施计划](implementation-plan.md)、[覆盖矩阵](DESIGN-COVERAGE.md)。整体视觉与完整持久化owner /root；实现owner Luna。当前开放票10/11/12/13/14均未达到完整产品接受。

## 历史进度（以下保留旧版本结果，不是当前验收）

# 首页交互视觉修复

日期 2026-10-06 · State: open · Status: in-progress

用户“开始推进修复”授权执行草案推荐方向，协调者已将推荐默认值明确记录为实现裁定；不冒充六张规划票逐项人工决策。当前执行看[实施契约](IMPLEMENTATION-SPEC.md)、[实施计划](implementation-plan.md)、[设计覆盖矩阵](DESIGN-COVERAGE.md)。既有规划及 HITL 票保留，默认讨论模式不再阻止本次已授权实施。

整页视觉/数据持久化 owner /root；Luna 分工实现。实现票：[可信金额与缺口详情](issues/10-values.md)、[单币趋势与历史日期](issues/11-trend.md)、[首页范围与任务反馈](issues/12-shell.md)、[独立整体验收](issues/13-acceptance.md)。

现有业务配置与交易保留，源码起点在[baseline](baseline/source-manifest.json)。3031是上一轮隔离预览，PID91640，本轮尚未刷新其构建。真实浏览器安全策略拒绝本地访问，已请求恢复；功能/完整流程/视觉均尚未接受，不用测试代替。

保留[调整草案](adjustment-proposal.md)、[决策地图](issues/00-homepage-adjustment-map.md)及[规划检查](planning-checks.md)作历史，不再作为当前执行状态。

第一轮独立静态审查 Task1/2/3 FAIL，已返回原 Luna 实现者修复，证据见 acceptance/task1-review.md、task2-review.md、task3-review.md。全量单元当前35FAIL，其中34条在既有失败日志同名出现，新增pending日期预期待复验；[历史对照](acceptance/full-unit-history-comparison.md)仅证明先前出现过，不宣称全仓绿或没有回归。

最新阶段（2026-10-06）：三项原实现任务的最终范围复核静态PASS；[整体最终审查](acceptance/final-review.md)发现五项Important，已派单一Luna进行[集中修正](issues/14-final-findings.md)。全量限4workers结果为3145PASS/18FAIL/6SKIP，仍FAIL。原始两库四类数据post-unit哈希保持不变。代码成果尚未达到产品接受；最终预览构建刷新待集中修正完成，真实浏览器访问仍受自动审核拒绝。

## 2026-10-06 14:20 UTC — 新鲜诊断边界

Issue25受控trace显示I1所有权有效且root的selectedIntradayReady=true；立即DOM加载态不能证明publication失败。真实Recall有独立草稿repository，新test未建立此传输，toolbar查询失败尚不是late-daily RED。临时production trace已恢复base SHA4c1ee4d…e0f；D1改为区间内10月2日/5日。仅授权新test局部Recall存储传输fixture，保留真实UI与行情读取，生产仍锁定等待有意义RED。[协调者追踪复核](acceptance/issue25-trace-coordinator-review.md)。

Issue24独立边界计时仅测量原两绘图旅程，不增加默认超时/弱化断言；测量后必须恢复final source ac72f577…3a68。其结果仍待实测。业务库/隔离库四表新鲜preflight数量与SHA均保持不变：[数据核对](acceptance/data-integrity-complete-publication-preflight-20261006T141200Z.json)。真实图表、持久化与视觉依然NOT VERIFIED。
