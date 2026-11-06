# 当前读取漏斗与阻塞位置

## 验收结论

性质协议子范围已由 root 首轮 1/3 独立接受，见 [最终验收](../homepage-nature-contract/FINAL-ACCEPTANCE.md)。本次复核源码与构建 hash 完全一致，不是仅引用已过期报告。HTTP 传输、结构/摘要协议及历史性质资格不再是“实盘集合为零”的卡点；完整首页仍 FAIL。

历史 1784 条缺显式性质的记录经过只读业务 resolver 后，1778 条具备合格券商证据，6 条仍 unknown；另有 84 条 simulation。没有把全部缺字段记录无条件升级，也没有回写原始成交。普通库实盘为 226 标的/726 回合；首页财务投影选中 232 个 entry，粒度不同，不能把两个数字直接当作相同标的计数。上一轮已独立确认 764 个旧回合 ID/成员不变；本次未重新执行该完整身份回归。

## 新采样漏斗

证据：[PROBE.json](evidence/PROBE.json)、[精简摘要](evidence/SUMMARY.json)、[HTTP 与版本复核](evidence/HTTP-VERSION.json)。采样时间 2026-10-24T13:15:29Z；Node 26 对实际 4392 接口读取，调用生产领域模块。日线步骤按工作区 includeIntraday:false 分支重现；未运行 React host，不含 alias loader、catalog 和 job 展示覆盖，因此**不是浏览器逐阶段 trace，也不是 p95/SLA 成绩**。浏览器只独立验证真实桌面最终超时，不赋予 Node 时长为浏览器精确耗时。

|层|当前数据/行为|本次单样本耗时|判定|
|---|---|---:|---|
|SQLite→HTTP|首页 source 与普通 bootstrap 均 1868 条，排序后的完整成交对象摘要相同|独立复核 source 600.83ms；bootstrap 271.31ms|成交传输一致；不能据此保证整个 DB/财务链均正确|
|source + FX 并行|source 6,329,541B，FX 349B，均 HTTP200|并行 621.47ms|通过读取；单个 source 总时延621.23ms，FX455.02ms；不能相加|
|协议结构与 SHA 解析|parseHomepageStoredCollection 成功|395.48ms|通过，无协议丢成交证据|
|采集 prepare|月结投影、输入绑定等|1212.02ms|已成功，但单步已超1秒目标|
|summary|236 个全量 instrument summary|3.82ms|成功；在 scope 下推之前读取全部市场|
|日线缓存读取与覆盖处理|236 次读取，154411 根本地日线|2967.88ms|成功但重；内含范围计算CPU720.95ms、覆盖处理CPU623.90ms，二者不能再与总时长相加；并非同步下载外部 Bars|
|entry 构建|普通载体/回合组装|262.76ms|成功|
|采集 complete|来源表示、完整性证据等|2412.84ms|成功返回 unknown，不是抛异常|
|own financial source|选中232个首页财务 entry|5412.77ms|当前最大单步耗时|
|财务 view|没有可发布的完整期间序列|1808.52ms|series=null，完整性不足|
|财务 facts|读取规范化事实|3108.88ms|成功；当前总市值/浮盈亏均 unavailable|
|holdings|产生20行/20个标的的持仓结构|16.58ms|内部有行，总金额null；不能当成已发布到页面|
|总读取+领域计算|不含后置接口对照请求|18291.15ms|超过 host 15000ms 门槛|
|React host 发布|完成前后都会检查请求截止时间|本轮未采集精确浏览器分段时间|真实1440桌面显示“读取已超时，新范围未应用”；未发布财务 domain|

probe 全链已完成并写出时长和领域结果；其后置 bootstrap 对照请求发生一次 ECONNRESET，导致该 Vitest 命令退出1，保留 PROBE-localhost.log，**不称整条测试通过**。该请求不计入18291.15ms。随后独立 http-check.mjs 使用新连接完成两个接口对照，退出0、摘要一致，结果在 HTTP-VERSION.json。默认沙箱首次探针的本机 EPERM 保留在 PROBE.log，非应用错误。未为这些探针问题修改产品。

## 当前的三个独立卡点

1. **先卡发布时限。** `trade-review-workspace.tsx:2232` 串接采集、全量日线和财务计算；`use-homepage-host.ts:175–180` 在 fromGlobal 完成后再次检查15秒截止，CPU阻塞定时器也不能绕过检查。实测领域链18.29秒与真实桌面 timeout 相互支持；精确浏览器各阶段占比尚未重新插桩，不声称已测出。当前采样最大成本为 own5.41s、facts3.11s、dailyAll2.97s、complete2.41s，不能再归因于“接口没连上”。
2. **即使及时发布，也不能展示完整财务总额。** representation.state=unknown、gapCount=231；暴露的前64条样例均为 no-original-carrier。source receipt 还报告 universe:unassigned-evidence-scope、universe:unresolved-corporate-action、universe:unknown。完整历史边界为 unknown，存在 lifetime-coverage-missing-or-conflicting 等问题，期间 series 为 null。当前量/成本/行情证据亦有缺口。不能把231当作231笔丢失成交，不能将完整性补写为 complete；需要原财务来源任务处理。
3. **页面失败态及未实现模块。** 超时后保留空 seed，持仓区域仍写“当前范围暂无持仓”，但 Node 同代码探针已有20行持仓结构。页面空槽不能证明真实持仓为零。期间按钮仍是“期间数据读取中”；历史已平仓代码固定 status:not-wired，页面明确“尚未接入”，它不是此次性质修复覆盖的内容。扩大超时只能改变第一道门，无法修复完整性或接线。

本次浏览器 error 日志为空、服务日志没有新 stack；这仅表示未捕获到额外抛出异常，不能排除未记录的内部错误。已明确发现的是可返回的 unknown/unavailable 领域结果和 host 超时，不应以“没有 console error”认定正常。

## 下一实施边界

不恢复暂停事项。若用户后续决定恢复，应把来源表示/归属完整性、财务来源与事实重复构建成本、发布失败态、历史模块接线分别定义验收，不用拉长 deadline 或伪造完整性来通过。当前只更新诊断；没有新的产品候选轮次。
