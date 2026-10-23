# 环境与回归记录

固定运行时：Node 26.0.0 / 内置 SQLite 3.53.0，按 conf/native-environment.json。npm ci 与初始 typecheck 通过，日志在本目录。

全量 Vitest 尝试见 baseline-unit.log：324 文件，318 PASS、3 FAIL、3 SKIP；3091 测试，3074 PASS、11 FAIL、6 SKIP。本次执行期间 worker 正在修改新增文件，因此不能将其称作固定版本的 master 基线或最终版本全量通过证明。

- deploy 三个 SQLite 操作测试与 BaoStock 五测试共同报 listen EPERM 127.0.0.1，属于本次 sandbox 执行限制；没有据此改产品代码。
- deploy 一个真实仓库 staging 测试在5秒超时，原因未单独验证，不归为已修复。
- S 两测试执行时处于修订中，最终第3轮定向复跑7/7 PASS；但独立反例失败，S仍暂停。不能用最终单元通过覆盖业务合同 FAIL。

邻接领域回归在稳定的既有文件上独立重跑：trading-room-scope、portfolio、history、contribution 共4文件66测试全部 PASS，见 adjacent-regression.log。

最终静止源码版本（F/S实现者完成后）：固定Node `tsc --noEmit` exit0，见 final-typecheck.log；F/S两文件17测试PASS，见 final-module-tests.log。源码和测试指纹见 final-source-sha256.json。

F最后一轮独立真实交易库反例14项：10 PASS、4 FAIL，见 ../F/coordinator-round3-cutoffs.log。S最后一轮独立反例6项：1 PASS、5 FAIL，见 ../S/coordinator-round3-counterexamples.json。两票均已在第三轮暂停，未集成生产页面。以上失败是任务合同失败，与全量运行中的sandbox监听限制分开记录。

开发服务由标准 npm run dev 启动，127.0.0.1:3333，显式使用 launcher 在线备份的 .data/tradereview-test.sqlite。启动失败未切换业务库；获准本地监听后启动成功。浏览器已打开基线页面并保存 baseline-1440.png；这张截图只证明原页面环境可运行，不能作为V2.5实现或视觉接受。

未写原业务库，未推送、合并、发布。P1尚未派发，产品全页功能、UI持久化、全控件和匹配设计的视觉门槛均 NOT VERIFIED。
