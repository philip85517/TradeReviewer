# 一秒首屏开发进展

最新：[首页与交易库数据差异系统诊断](../homepage-data-diagnosis-2026-10-24/DIAGNOSIS.md)（仅诊断，未修复）。4392两入口读取同一隔离副本、相同1868笔成交；原业务库1866笔成交逐列保留。1784笔性质未明记录在旧库兼容显示为实盘，而首页严格分类为unknown。1440×1000全市场首页两次实际进入均终止于timeout；此前C4的A股来源警告截图仍保留其原状态。接口结构校验通过，不能据此判定财务来源与完整首页通过。Task02/03及财务/Bars暂停轮次均不变。

当前：独立优化已实施，Task01、Task04 已由 root 接受；Task02 代码与资源收益通过，UI 总验收仍有缺口。完整首页一秒目标 FAIL，不能报整体验收完成。最终结论以 [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md) 为准。

最新 Sol 6.1 Ultra 多 Agent [桌面续验](evidence/continuation-2026-10-24/ROOT-ACCEPTANCE.md)：真实 CSV/XLSX/PDF、慢模块等待、准确失败提示/关闭及手动刷新恢复已补证；关闭后焦点回到 BODY **FAIL**，真实取消/替换竞态仍 NOT VERIFIED。本轮只补证，884源码/272产物未变，Task02仍2/3、Task03仍1/3。扫描未发现原批准范围内尚未实施的独立产品优化；共享焦点设计已记录但未混入最后候选，财务/Bars仍暂停。

- [计划](PLAN.md)、[设计覆盖](DESIGN-COVERAGE.md)
- [01 行情窄查询](issues/01-narrow-query.md)：closed / accepted，2/3；708次HTTP响应逐项等价，三轮耗时下降14.95%–36.06%
- [02 启动模块边界](issues/02-lazy-startup.md)：open / partially-verified，2/3；仅 parser/XLSX 按需加载，首屏 JS+CSS 离线 gzip 体积减少 18.45%；四视图拆分未交付，完整 UI 门槛未关闭
- [03 集成验收](issues/03-integration.md)：open / incomplete，1/3；构建及 128 项定向回归通过，完整一秒 FAIL
- [04 券商订单号导入校验](issues/04-broker-order-id-import.md)：closed / accepted，2/3；生产浏览器确认→SQLite 新增两笔→返回→reload 通过，原 1866 行逐列不变

用户已答复“保持暂停，先完成独立优化”。原 P1/F07 与 Bars 仍 3/3 暂停，不借新票恢复或重置轮次。原记录见 ../homepage-v25-implementation/FINAL-ACCEPTANCE.md。

生产候选 C4：HEAD 58bf0d90＋884 文件 SOURCE-MANIFEST.json 定义的工作区。仅使用既有 baseline.sqlite 的 WAL-aware 隔离副本，初始 1866 executions、236 instruments、154410 daily_candles；真实测试导入后 1868 executions。构建 PASS；类型检查与基线字节一致，保留 8 项 Recall 测试既有错误，整体 FAIL。服务端口 4392、PID60461、显式 TRADEREVIEW_DB_PATH 及实际数据库句柄已绑定；没有接受完整数据首屏。

隔离预览：[交易库](http://127.0.0.1:4392/trades)、[首页](http://127.0.0.1:4392/home?scope=live&market=a&accounts=*&rangeMode=all)。恢复当前产物预览：`bash .scratch/homepage-one-second-development/evidence/candidate-04/START-PREVIEW.sh`；默认开发启动为 `make dev`，使用 3333 与新的测试副本，不能混作本轮 C4 证据。

默认实盘集合数据条件：[SCOPE-FINDING](evidence/baseline/SCOPE-FINDING.md)。1784未知性质＋82模拟，没有明确live成交；不自动改原始数据。真实scope空态与财务超时分开判断，非零真实实盘金样未具备。
