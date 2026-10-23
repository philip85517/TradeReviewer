# S 恢复第1轮独立接受 — PASS（纯合同）

接受者 /root；2026-10-23 00:49 CST。历史3/3 FAIL完整保留；本次显式恢复验收1/3 PASS。

冻结源码SHA256 `ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`，测试 `25c0af4452056c1763017a96f76fe45fd5a375159dde10013b98c32a80b19a68`。协调者重新计算并核对，完整读取源码、测试、REPORT与INTERFACES，不依赖实现者结论。

|独立检查|结论|证据|
|---|---|---|
|原第3轮6项反例原样重跑|6/6 PASS，源码hash相符|[原检查输出](../coordinator/S-acceptance-1-original.json)|
|新增协调者完整状态合同|7/7 PASS：应用/保存/恢复，嵌套白名单，全局及独立日期并发/终结/晚结果，目录URL与坏数据|[独立测试](../coordinator/S-contract.test.ts)|
|S本身及相邻偏好/交易库状态回归|67+5+19，加协调者7，共4文件98/98 PASS，退出0|[新鲜输出](../coordinator/S-acceptance-1-tests.log)、[精确配置](../coordinator/S-acceptance-1.vitest.config.ts)|
|定向严格类型检查|PASS，退出0|[输出](../coordinator/S-acceptance-1-typecheck.log)|
|源码与接口审查|PASS：唯一committed快照、三请求域generation/key、深层UI投影、v2明确拒绝旧版、目录与精确返回焦点责任边界明确|[消费合同](INTERFACES.md)、[冻结证据](source-freeze.json)|

测试工具问题单独保留：第一次协调者配置误用node环境导致5个localStorage相关失败；改用项目jsdom/setup后，mergeConfig把include数组拼接成全量，发现即中断（退出130）。原始输出为 coordinator/S-acceptance-1-node-environment.log 和 S-acceptance-1-merged-include-interrupted.log。最终配置保留项目环境/别名/setup，只覆盖精确include；未改产品源或项目默认配置。这两次配置错误不作为产品失败或全量基线。

纯合同门槛接受，解除P1的S依赖。真实storage异常、hydrate优先级、AbortController/timer、数据与标签原子提交、URL直达/刷新/回退、成交日open筛选、来源重读、实际持久化与DOM焦点均归P1。P2/P4图表、控件、持久化和视觉仍NOT VERIFIED，不能由本接受替代。整体功能尚未交付。
