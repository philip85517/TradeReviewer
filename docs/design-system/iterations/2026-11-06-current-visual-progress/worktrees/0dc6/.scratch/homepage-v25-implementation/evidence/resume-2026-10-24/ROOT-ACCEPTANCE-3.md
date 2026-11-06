# P1 / F07 — 第 3 轮独立验收：FAIL，暂停

2026-10-24 CST。实际并行代理为 `/root/astra_finance`、`/root/astra_source`、`/root/astra_integration_design`，均为 **gpt-6-astra / ultra**；root负责逐项独立审查、实际浏览器与数据库接受。采用 `codebase-design` 的模块责任边界与 `systematic-debugging` 的先根因后修复流程。当前候选及全部历史失败保留，**整页未交付**。

## 轮数与范围

这次是原 P1/F07 最后第3候选，不是新票或重置。依照用户“每任务最多3轮，超限暂停并记录原因”和 [有界派发](ROOT-BOUNDED-SESSION-AND-RECOVERY.md)，独立验收失败后已冻结产品与测试。ContributionBars原3/3 FAIL仍暂停。其他独立模块保留各自既有接受记录，不从P1失败反推其全部失败，也不以纯模块PASS关闭整页。

用户范围仍为V2.5公共规范与首页，含必要普通交易库接线；首页先采用共享规范，其他页面后续迁移。完整交易库V1.0改版不在本任务。root拥有整页视觉一致性与完整数据/持久化流程。

## 已完成且有独立证据的部分

|对象|root独立结果|接受边界|
|---|---|---|
|本地工具、固定运行时与3333服务|[环境恢复](environment/ENVIRONMENT-RECOVERY.md)；已恢复离线依赖及授权监听，真实浏览器可用|旧ENOENT未复现，根因未证；不声称所有环境问题均已归因。当前服务保留隔离库。|
|财务核心时序、固定金额与性能|[原48+9结果](source/qualifier-repair/F07-acceptance/final-preparation/ROOT-RESULT.json)：48例PASS/无violations；原固定9样本PASS，cold0.762–1.224s，27次repeat最大2.622ms，64MiB未超限|4个非法日期控制在进入F前拒收，非48个都完整执行F。原365字面金额/public bytes/输入SHA不变；不能代替首页15s门。|
|来源读取与恢复活动状态|[root结果](period-ui-final-design/implementation/recovery-identity/final-publication/root-independent/RESULT.json)：原选择38 PASS，126未选；12文件hash一致|ref保持同步权威，rendered active统一开始/退役；本地取消/旧数据保护等为定向测试范围。worker185项邻接PASS不是root整页接受。|
|复盘编辑会话模块|[root检查点](source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/root-independent/ROOT-CHECKPOINT.md)：80/80运行测试PASS；实际W→A→B→返回恢复Oct22/115/浮盈15；更新→保存rev33→返回→reload→重开仍保持|仅所列真实鼠标旅程。旧bundle SHA不变；未覆盖完整dirty/conflict/failure/键盘/触摸/响应式视觉。类型检查仍FAIL。|
|当前首页CPU诊断|[root归因](homepage-timeout-stage-plan/post-sample-design/cpu-attribution/ROOT-CHECKPOINT.md)：一次当前来源Node采样和一次离线分析完成；852源文件前后一致|complete/own的主要已映射采样成本为SHA与序列化。12.121s为Node发布前路径，未运行React/UI发布，不是浏览器性能PASS。|

最终产品/测试指纹和852源文件复核见 [ROOT-FINAL-SOURCE-CHECK.json](ROOT-FINAL-SOURCE-CHECK.json)，无差异。财务固定样本的872文件冻结与CPU的852文件集合是不同检查范围，不能混为同一集合。

## 阻断接受的完整问题集

|问题|证据与根因|状态 / 下一处理边界|
|---|---|---|
|新增测试导致全项目strict失败|[8项错误日志](source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/root-independent/ROOT-2.log)、[只读统一诊断](source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/implementation/STRICT-FAILURE.md)：错误使用working.viewport和7处role-query exact参数；Vitest默认不做类型检查|FAIL；同一候选已停止。拟一次修正8个测试对象字面量，保持全部断言和产品类型，不加cast/skip。未实施。|
|无效scope已拒收却显示持续加载|[真实截图](period-ui-final-design/implementation/recovery-identity/final-publication/root-independent/hard-invalid.png)、[根因](period-ui-final-design/implementation/recovery-identity/final-publication/hard-invalid-diagnosis/DIAGNOSIS.md)：host零IO终态拒收，period仍用view=null推导loading|FAIL；需要统一显式终态传递，区分未开始/读取中/拒收/失败/有旧数据。不能靠延迟或假空数据解除。未实施。|
|真实首页仍超过原15s|[原19.245s分段样本](homepage-timeout-stage-plan/root-execution/ROOT-RESULT.json)；[最终新鲜页面](period-ui-final-design/implementation/recovery-identity/final-publication/root-independent/final-home-preview.txt)再次显示“读取已超时，新范围未应用。”|FAIL/OPEN；CPU已为编码与摘要模块优化提供证据，具体收益未测。保持15s、2s/200ms及64MiB合同。|
|超时呈现仍不完整|最终页面指标显示未知/timeout，但期间按钮仍写“期间数据读取中”；空持仓表现及真实数据应用仍未接受|FAIL；与上述终态传播统一处理，不能只修无效URL单例。|
|M08保存响应JSON失败|原失败消费者缺少确定的method/status/body绑定；后来正常200保存不关闭原反例|OPEN；保留原诊断边界，未获批准的新探针没有运行。|
|RS07旧Markdown来源混合|旧导出可能混合当前财务表与旧图；旧证据保留|OPEN；下一次须按冻结快照来源统一界定，不顺带覆盖旧bundle。|
|历史真实数据及完整页面|最终真实页面仍明确“历史已平仓，尚未接入”；完整持仓/筛选/CSV/返回、96状态及视觉矩阵尚未全部闭合|NOT VERIFIED / 未完成。依赖P1真实接线接受的扩展不能越过当前门。|
|ContributionBars空间稳定性|原第三轮pending/error等推移下游布局的失败证据保留|3/3 FAIL暂停。未派第四修复。|

CPU分析另有明确限制：一个-3µs delta被排除；ledger分类路径拼写不匹配实际模块，不能据此宣布ledger成本为0；GC/idle/unresolved未分配给SHA。保留原profile/analyzer，不补跑挑样。

## 功能、持久化和视觉分别判定

|门|本轮结果|
|---|---|
|财务核心正确性/原固定性能|PASS，限已冻结纯模块与原样本|
|P1完整功能与源码质量|FAIL（strict、真实超时、终态加载等）|
|完整数据/保存/返回/reload|有限复盘正常保存路径PASS；dirty/failure/conflict等必需项NOT VERIFIED|
|独立完整控件审计|局部有限证据已记录；原55项/96状态总分母保留，完整门NOT VERIFIED|
|参考视觉一致性|root已直接看图与有限状态比较；全页、完整状态及响应式边界NOT VERIFIED；Bars有已知FAIL|
|真实输入方式|所列鼠标旅程PASS；本轮未执行的键盘、模拟触摸、实体触摸分别NOT VERIFIED|
|整页交付|FAIL / 未交付|

## 数据保护与保留预览

[最终原业务库只读逻辑复核](environment/business-data-checkpoint-final-astra.json)：executions1866、import_batches213、trade_revisions11、reviews138，四表全部行数及SHA与基线相同。浏览器fixture修改仅发生在显式隔离库；没有push、merge或发布。

最终预览已用真实浏览器新鲜打开并直接查看截图，服务仍运行：[首页](http://127.0.0.1:3333/home?scope=live&market=a&accounts=*&rangeMode=all)。[当前截图](period-ui-final-design/implementation/recovery-identity/final-publication/root-independent/final-home-preview.png)是失败现场，不是成功交付。保留的复盘页展示有限通过状态，见[保存后重开截图](source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/root-independent/66-persisted-working.png)。

通常启动为 `make dev` / `npm run dev`，固定3333且每次重新在线备份隔离数据库，**会重置当前验收fixture**。保留现场时使用既有显式 `TRADEREVIEW_DB_PATH` 的 `scripts/start-local.mjs` 入口，详见 [STARTUP.md](STARTUP.md)。本次没有再次执行会重置fixture的标准入口。

## 暂停后的统一恢复方案（未执行）

恢复需要用户明确重新授权同一耗尽任务的轮次，不能改名规避。现有根因已集中记录，建议下次按固定边界一次设计完成：先修正8处测试API类型；将期间的拒收/超时/加载状态统一由真实读取状态决定；在原摘要模块内实施字节兼容的分块SHA及两个现有编码语法输出，保持验证时点与金额所有权。先strict，再原字面摘要/时序/金额和所有摘要消费者回归，最后独立固定性能及真实首页完整旅程；任何失败冻结并保留原因。

编码模块方案见 [DESIGN.md](homepage-timeout-stage-plan/post-sample-design/DESIGN.md)。它只是下一候选设计，不保证能解决全部15s成本；不能删除receipt/carrier验证、放宽unknown、信任revision代替内容、延长deadline或迁移旧bundle。后续历史真实接线、完整UI及其他独立叶子接受仍有各自门槛。
