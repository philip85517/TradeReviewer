# D01 技术事实准备——协调者接受

结果：**ACCEPTED，仅原票AFK事实准备**。完整业务契约、迁移和产品实现均未接受。

2026-10-26，root在工作树`/Users/zhoulin/.codex/worktrees/25db/TradeReview`接受。基线为`d95afc37d30f817edbd6daab41e85f485138de0d`，未提交新增产物。实现者`legacy_contract_sol / gpt-6.1-sol / ultra`；专属独立审查者`legacy_acceptance_luna / gpt-5.6-luna / max`。

## 版本与独立证据

root在关闭票前重新核对[冻结包](../decisions/TL20-D01/review-package.json)的12项工人产物和4项参考文件，16/16 SHA-256一致。Luna也逐项核对全部内容及完整新增文件diff，见[独立报告](../decisions/TL20-D01/review.md)。关闭后原票只改生命周期、勾选及证据链接，因此不再声称该参考票仍匹配冻结前hash；12项工人内容及批准规格保持原冻结版本。

root亲读parser、identity、store及Recall document关键调用链，与报告事实一致。root独立使用新`--output-dir`运行合成脚本：10/10 PASS、0 FAIL，Node26.0.0/SQLite3.53.0，仅3个`:memory:`句柄；[原始输出](synthetic-run.log)、[结果](synthetic-results.json)。未打开业务数据库。

候选类型按项目ESNext/Bundler解析方式运行strict tsc：exit0，[日志](candidate-typecheck.log)。首次误用NodeNext规则的TS2835保留在[失败日志](candidate-typecheck-nodenext-failed.log)，环境命令纠正1轮，无候选产品代码修复。

Luna独立审查SPEC PASS / QUALITY PASS；没有未处理的事实准备缺陷。审查列出的Important项均是本票必须揭示的后续生产/政策门槛，继续保留，不通过关闭事实准备来消除它们。

## 接受门槛

|门槛|结果|证据/范围|
|---|---|---|
|四类合成、逐字段和身份兼容矩阵|PASS|[报告](../decisions/TL20-D01/report.md)与独立SPEC审查；文件名、净额和旧run不充当practice身份|
|精确调用链、候选类型、复用和适配缺口|PASS|源代码亲读、冻结候选声明、strict tsc|
|dry-run/回滚/旧人工引用保留方案|PASS（方案）|报告明确现状缺口和未实施项；没有运行迁移|
|不读取或修改真实交易内容|PASS|只读代码与合成内存数据；服务未启动|
|独立Resolution及边界同步|PASS|[Resolution](../../comments/TL20-D01/2026-10-26-resolution.md)与原票/地图/协调记录|
|UI/浏览器/真实持久化|NOT APPLICABLE|只读事实准备，不改变控件、页面或保存链|
|完整源行导入、运行时CAS、迁移/恢复及Recall接线|NOT VERIFIED|本票未实现；仍须独立任务、隔离库及产品门槛|

TL20-LEG-001仅在候选声明层完成1轮修复：独立Practice.version、双版本CAS和duplicate-open不写日期。运行时并发行为未实现，保留为后续门槛。其他研究脚本/fixture修复及原失败见[轮次记录](../decisions/TL20-D01/verification-rounds.md)；无同一问题达到5轮。

签署：root。关闭D01不关闭地图、不解除其他未结依赖、不接受I10–I20或V2完整产品；未提交、推送、合并、发布。
