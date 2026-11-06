# 首页访问超时漏斗诊断
State: closed
Status: accepted（仅诊断，产品超时仍存在）
Owner: /root

用户授权增加日志/profiling，测定各访问环节耗时。本轮仅观察性 instrumentation，保留15秒、金额/身份/校验/缓存合同及P1/F07/Bars 3/3暂停。原3333服务和真实库页面不重载、不修改；复制当前未提交源码到RUN.json指定临时应用，真实库WAL-aware在线备份到独立数据库，以显式TRADEREVIEW_DB_PATH、独立端口4391运行。原始文件哈希冻结于BASELINE-MANIFEST.json。

协调者/root管理隔离环境、真实桌面1440×900复现和独立验收。Astra客户端负责人仅改临时copy的workspace/host/financial/编码模块；Astra服务端负责人仅改临时copy的storage、API、db模块。共享日志helper由/root持有，schema见临时app/lib/diagnostics/homepage-profile.ts。无产品修复、无推送合并。

记录runId、host generation、单HTTP id、monotonic及epoch时钟、stage start/end、数据计数、异常和deadline拒收。并行/嵌套阶段不能直接求和；缺测保留NOT VERIFIED。只记录数量/阶段，不记录完整账户或账单内容。首个完整浏览器采样后分析，避免挑样重跑。冷模块加载与warm受控复现分开；若首个采样受编译支配，额外warm样本须另存。

## 当前结论与导航

2026-10-24 主代理独立接受本次诊断，Astra 客户端/服务端插桩及独立复核已结束。完整样本使用 [RUN-COMPLETE.json](RUN-COMPLETE.json) 的 `complete.sqlite`，不是首个缺测样本的 `isolated.sqlite`。

bundle 13.827秒返回，fromGlobal再占3.704秒，afterDomain于17.541秒拒收。首次15秒越界在 sourceEncode；上游236行情请求7.243秒，大型行情/来源encode+SHA两阶段合计5.968秒。SQLite/API读取成功；FX命中缓存。结论限单个完整插桩桌面样本，不能视为无插桩精确基准。

- [完整诊断报告、分层耗时与限制](DIAGNOSIS.md)
- [主代理验收及桌面局部覆盖](FINAL-ACCEPTANCE.md)
- [范围矩阵](DESIGN-COVERAGE.md) / [诊断任务01](issues/01-timeout-funnel.md)
- [独立复核](INDEPENDENT-REVIEW.md) / [结构化指标](FUNNEL-METRICS.json)
- [1440×900截图](complete-desktop.png) / [AX](complete-desktop-AX.txt)
- [冻结浏览器日志](FROZEN-BROWSER-COLLECTOR.ndjson) / [冻结服务日志](FROZEN-SERVER.log)

产品首读仍FAIL；期间仍loading、指标未知、持仓初始空态均已记录。旧P1/F07、ContributionBars 3/3暂停不变，本诊断不恢复修复轮次。服务4391保持运行；启动命令见报告，3333原服务未重启或重新加载真实库页面。
