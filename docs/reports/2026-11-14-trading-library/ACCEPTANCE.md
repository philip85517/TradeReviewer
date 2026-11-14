# 本轮后端评审的独立核查记录

> 2026-11-14 正式归档：以下为原评审时点的结论；本次仅整理文档，没有重新执行产品验收。候选源码按 [来源与版本](SOURCES.md) 定位。

2026-11-14；协调/独立接受人root。范围为“完成四读驱动的完成度、设计质量、性能原因和复用价值评审”，**不是接受真实后端功能或迁移方案**。产品代码未改，本轮不需要UI/业务数据库验收，也不沿用Mock的产品PASS作为后端PASS。

状态：**本轮研究 accepted**。四读完成度、设计质量、性能证据和逐模块复用判断已独立核查；真实后端和迁移路线未验收。

## 评审覆盖

|要求|证据|本轮判断|
|---|---|---|
|四类读取逐条对应路由/服务/表、返回粒度与版本缺口|[REVIEW](REVIEW.md)、[25db一级研究](research/practice-backend.md)、[38a0一级研究](research/readstore-performance.md)|PASS；没有将四方法冻结成四URL或把Mock当真实接入|
|先完成度、再设计质量、再复用/重构/重写与成本|[VERDICTS](VERDICTS.md)|PASS；明确读写/财务/资本/发布/worker/兼容边界，无凭空人天或复用比例|
|性能有可复现原始证据，区分历史/本轮、结构/测量/风险|[PERFORMANCE](PERFORMANCE.md)、[证据索引](evidence/README.md)|PASS（诊断任务）；已复现的性能失败仍未修复|
|来源/unknown/版本/全范围汇总语义保留|[REVIEW](REVIEW.md)、55条[保护测试](evidence/backend/guards-probe.log.gz)|PASS（评审约束）；不是完整新后端正确性证明|
|关键主张由协调者独立核查|实际源码路径复核；root编写/执行真实函数与路由隔离探针；原始JSON和日志|PASS；未仅据worker报告声称完成|
|候选源码及当前产品不被研究改变|[前](evidence/backend/source-freeze.json.gz)/[后](evidence/backend/source-freeze.json.gz)冻结；[自动核对](evidence/backend/verification.json)|PASS；4工作区HEAD和全部21,573个纳入文件未变，scratch研究产物不计入产品指纹|
|后端路线/数据迁移决定|本轮没有此授权|NOT APPLICABLE：评审任务不代用户选型，不迁入、不升级业务DB|

## 根协调者直接核查的链路与反证

- 对照前端 `LibraryReadPort`、请求台账和当前设计规范，确认范围汇总要覆盖完整匹配集合，不能把6行页与6条SQL总工作量画等号。
- 直接读25db list/metrics/source snapshot/detail/financial/statistics/pair路由与schema；通过探针确认全量工作，且确认raw单ID detail主要工作不随无关练习增长。没有把全库问题错误归到每个detail方法。
- 直接读38a0 `validatePublication`、事务Map、分页、registry/构建器/worker；root重放readOnly既有隔离发布，确认两请求各读全目标。`app_settings`确实注册，worker确实独立进程；没有保留错误的“资金未注册/只是Promise”解释。
- 逐项检查金额纯内核的价值及provider限制；合法千位金额可被25db纯投影处理，而38a0原文校验仍有拒绝反例，不能跨模块贴标签。
- 源码研究由两名research agent分别完成，root的诊断、合并判断与版本比对独立于两份静态报告。最终又请readstore研究者对root综合文档核对证据口径；若有修正，保留在下方记录。

## 保留的FAIL / NOT VERIFIED

|检查|状态|含义|
|---|---|---|
|单对象财务不受其他练习数量放大|**FAIL**|旧消费者依赖全库统计，源BLOB工作量9,929→496,450字节；本轮只诊断|
|38a0既有发布 readiness→交易库第一页→严格解析 ≤1秒|**FAIL**|本轮3次3.71–4.18秒；无socket/浏览器。不是生产p95|
|38a0合法原文金额的全部详情严格解析|**FAIL（同指纹历史）**|65段/45标的/52回合已有反例；本轮静态复核，同1221源码指纹，不声称新跑完整明细|
|分段计时第一版脚本|**FAIL（探针错误，已更正）**|spy递归错误，日志/脚本保留，不计产品缺陷或性能样本；更正后1 PASS|
|真实业务库规模、来源大小、bound旧成果比例及实际性能|**NOT VERIFIED**|未打开业务库，不把合成数据外推生产|
|冷启动/重启/并发读写、锁/WAL/worker争用、浏览器waterfall|**NOT VERIFIED**|机制风险已审，未以无测量的百分比归因|
|新四读实际持久化链、全市场估值/FX/未平仓/部分配对|**NOT VERIFIED**|新后端尚未实施；类型/Mock/纯函数不代表生产provider接齐|
|实盘新动作模型、回放、图表、旧人工成果全旅程|**NOT VERIFIED / 本轮动态范围外**|不能把本次研究结论当这些功能已接受或值得整块迁入|

55条来源/快照/无费用反例PASS是窄范围保护证据，不覆盖所有资本CAS、全仓测试或生产数据。独立源码研究中的测试文件存在也不能自动记为本轮PASS。

## 来源/产物范围

- 当前分支保持 `codex/library-frontend-mock@1770178694f5815b699c23deef894888dac1abea`。25db/38a0/0dc6按实际dirty文件冻结，不用HEAD掩盖未提交实现。未重新fetch远端。
- 研究与探针只写当前scratch目录及地图研究票/说明；不改产品或其他候选源文件。动态写入只在内存及测试自建临时库；38a0已有验收库以readOnly打开，没有创建业务DB副本。
- 文档研究快照保存到本地 `research/library-backend-four-read-20261114`；其上下文/提交指针由[研究票](SOURCES.md#e0bb)（冻结定位：`e0bb:.scratch/library-staged-migration-20261113/issues/10-backend-four-read-review.md`）独立Resolution记录。该分支只归档本轮研究产物，不包含后端迁入；当前工作分支不切换，无push/merge。

## 最终核对

root直接运行[核对脚本](evidence/backend/verify-review.py.txt)：4工作区共21,573个纳入文件、HEAD/指纹前后完全一致；再次重算38a0历史冻结的1,221个文件也全部一致。报告链接/行号检查通过，最终数量见[verification.json](evidence/backend/verification.json)。`git diff --check`通过，当前产品tracked diff为空。

独立文档复核找到两处表述问题：固定Date被误写成匹配发布有效期、交易库第一页被误称首页。root直接核对store中valid_until=null及freshness条件和探针operation，已修正文档，见[复核记录](evidence/backend/report-check.md.txt)。未发现数值与原始JSON冲突，性能归因和迁移判断无未解决重大异议。

本轮研究票可以关闭；用户最终选型/接口与模型决策票继续开放。不会因完成研究自动迁入后端、修复上述FAIL或关闭生产验收门槛。
