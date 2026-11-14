# 归档证据与使用限制

2026-11-14 文档归档。`backend/` 保存后端诊断原始 JSON、日志、历史探针；`frontend/` 保存前端精选验收记录、原始结果与 Mock 截图。均来自既有执行，本次没有重跑这些测试。原始日志及HTTP响应头以无损gzip保存，保留尾随空格／CRLF等原字节；解压后与原件完全一致。完整版本范围见 [SOURCES](../SOURCES.md)。

## 后端原始结果

|材料|原执行结论|口径|
|---|---|---|
|[practice v2](backend/practice-read-results-v2.json)／[日志](backend/practice-read-probe-v2.log.gz)／[探针](backend/practice-read.probe.test.ts.txt)|测量 PASS；单对象依赖断言 FAIL|真实25db代码、合成内存库、N×配对数矩阵、SQL get/all及返回列字节；不是物理扫描／生产请求|
|[分段结果](backend/stages-results.json)／[日志](backend/stages-probe.log.gz)／[探针](backend/stages.probe.test.ts.txt)|1 PASS|真实指标函数插桩；nested CSV 包含在 pairProjection，禁止相加；不是一次优化后的时间|
|[readstore](backend/readstore-results.json)／[日志](backend/readstore-probe.log.gz)／[探针](backend/readstore.probe.test.ts.txt)|测量 PASS；一秒预算断言 FAIL|3次真实 Request／Response／严格解析，第4次独立 SQL trace；已有隔离库 readOnly；无浏览器、socket、写入和并发|
|[保护测试日志](backend/guards-probe.log.gz)／[入口](backend/guards.probe.test.ts.txt)|55 PASS|来源／快照／无费用／资本反例的窄范围保护，不等于全仓／全部CAS或性能通过|
|[最初分段失败](backend/stages-probe-v1-failed.log.gz)／[旧探针](backend/stages-v1.test.txt)|探针错误，修正后通过|spy递归，不是产品故障；保留旧失败，不计有效性能样本|
|[practice v1](backend/practice-read-results.json)／[旧入口](backend/practice-read-v1.test.txt)|历史诊断 RED|主报告采用v2；不跨版本拼接为一次完整结果|
|[来源摘要](backend/source-summary.json)／[完整冻结](backend/source-freeze.json.gz)|原 before／after 字节完全一致|含 dirty 实际文件 SHA256，不只记录HEAD；全冻结仅存一份gzip|

原 [report-check.md](backend/report-check.md.txt) 及后端 [接受记录](../ACCEPTANCE.md)保留修正说明：固定Date并非匹配发布TTL，第一页并非首页。两处文字已纠正，不影响原数值。

探针／配置／辅助脚本保留为 `.txt`，保持原字节并防止仓库测试发现器将历史探针当新增产品测试。它们**不是当前目录可直接运行的测试套件**：含原工作区绝对导入、原 scratch 输出位置和已有验收库位置。复现需要恢复对应候选实际源码／依赖并逐文件匹配冻结、复制探针至独立 scratch、调整配置和输出路径，另存新结果；不能覆盖本归档。

运行环境原为 Node26.0.0／SQLite3.53.0。所有重新诊断须显式使用隔离数据库环境路径；内存探针自建库，readstore 只读现有隔离库且检查 realpath 含 `/.scratch/`。业务数据库与该隔离库均未收入 Git；不以 `make dev` 或业务库替代缺失的验收数据。只有哈希无法重建未提交源码，因此异机完整重放仍需取得相同候选源码与合法隔离数据。

## 前端精选证据

- [最终自动化摘要](frontend/automated-final-results.json)与同目录原日志；[生产404响应](frontend/production-guard-17701786-headers.txt.gz)。原脚本路径是历史定位，不是本次运行声明。
- [33文件／13参考及版本桥接 manifest](frontend/final-manifest.json)、[来源冻结检查](frontend/source-freeze-check-final.json)、[源取用清单](frontend/SOURCE-MANIFEST.json)。
- [原接受记录](frontend/FINAL-ACCEPTANCE.md.txt)、[控件登记](frontend/CONTROL-RESULTS.md.txt)、[原审计说明](frontend/CONTROL-AUDIT.md.txt)、[执行判断](frontend/RULINGS.md.txt)、[全分支审查](frontend/final-branch-review.md.txt)与[修复复审](frontend/final-fix-review.md.txt)。保留原版本、FAIL与NOT VERIFIED；其中链接指向未全量收入的历史附件。
- [列表1440](frontend/list-17701786-direct-1440.png)、[详情1440](frontend/detail-17701786-direct-A-1440.png)、[默认交付页](frontend/delivery-17701786-default.png)：均为固定 Mock 数据。没有收入真实交易原件、数据库或真实账户页面截图。
- [端口消费者计数](frontend/port-call-count-results.json)、[网络摘要](frontend/network-summary-final.json)、[控制台分类](frontend/console-classification-final.json)、[配对五态几何](frontend/pair-retry-17701786-geometry-summary.json)。端口计数不等于HTTP数；网络观测范围不等于所有请求。

这是精选归档，不包含全部截图、浏览器 DOM／动作日志、完整源分支或真实验收库。它保存当前进展和诊断的依据，不能代替新实现后的重新验收。[归档清单](ARCHIVE-MANIFEST.json)标明逐文件 SHA256；[本次文档检查](DOCUMENTATION-CHECK.md)记录实际验证范围。
