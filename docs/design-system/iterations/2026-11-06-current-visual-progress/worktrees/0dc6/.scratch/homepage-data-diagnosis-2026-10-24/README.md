# 首页无交易信息：系统诊断

2026-10-24，root；用户要求核对数据库、协议、阻塞与内部异常，使用 systematic-debugging。诊断已完成，产品问题仍存在。未改产品代码、配置、构建产物或原始成交；未恢复暂停任务。

- [诊断结论与证据边界](DIAGNOSIS.md)
- [四项需求覆盖](DESIGN-COVERAGE.md)、[桌面局部控件与状态检查](CONTROL-AUDIT.md)
- [诊断任务及验收](issues/01-diagnosis.md)
- 未修复的问题：[性质与来源契约](issues/02-source-semantics.md)、[超时链](issues/03-timeout.md)、[失败状态和异常可观测性](issues/04-failure-observability.md)
- [真实接口与领域探针](PROBE.json)、[探针运行日志](PROBE-COMPLETE.log)
- [版本、进程、数据库句柄与原始行对比](VERSION-AND-DATABASE.json)、[浏览器记录](BROWSER.json)

当前预览：[首页](http://127.0.0.1:4392/home)、[普通交易库](http://127.0.0.1:4392/trades)。4392 为隔离验收库，不是业务原库的实时服务。服务已在真实 1440×1000 桌面浏览器复查并保留运行。服务停止后恢复：`bash .scratch/homepage-one-second-development/evidence/candidate-04/START-PREVIEW.sh`。不要对仍运行的服务重复执行；不需要 rebuild。

财务 P1/F07、Bars 仍暂停 3/3；Task02 仍 2/3、Task03 仍 1/3。本次只增加诊断证据，不生成修复候选，不重置轮数，不把诊断完成当作首页交付。

后续实施更新：用户已授权先修性质协议，见[独立子任务最终验收](../homepage-nature-contract/FINAL-ACCEPTANCE.md)。候选1首轮通过，桌面首页范围库不再0/0，实盘226标的726回合；首页财务仍超时。4392已切至该候选新构建和新隔离副本，服务停止后使用`./.scratch/homepage-nature-contract/START-PREVIEW.sh`恢复，代替上方旧C4脚本。原C4诊断及失败记录保留；本目录原“未改产品”及旧预览说明指诊断当时版本，不代表后续没有开发。

2026-10-24 21:20复查：[性质修复后的当前漏斗](../homepage-read-funnel-after-nature-2026-10-24/FUNNEL.md)。两接口仍1868条完整成交对象一致；当前性质1778live/84simulation/6unknown；Node实际接口+生产领域模块链18.29s（不是浏览器逐阶段trace），representation231缺口、selectedEntries232、内部holdings20行，真实1440桌面仍超时而未发布。旧0/0、3056缺口与旧各阶段时长只代表修复前采样，不能继续当作当前结论。原财务/Bars暂停保持。
