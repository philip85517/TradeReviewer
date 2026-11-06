# 冻结真实副本非财务事实实验覆盖契约

Owner：real_fact_mvp；集成与独立接受：协调者。授权来源：本轮明确派发；规格参考为 `../page-reading-mvp-experiment/RESULTS.md` 的真实数据未验证边界、`../../docs/backend-design/page-reading-architecture-review-2026-10-29.md` §问题2–4、`../page-reading-mvp-wayfinder/issues/03-mvp.md`（只读引用，不更改状态）。无产品 UI，所有 elementID、画板、浏览器操作均不适用；理由是仅写独立 CLI/实验持久化代码，没有前端控件、布局或状态接线。

|需求ID/准确来源|elementID/图|状态/范围|owner|旅程/可观察反例|证据|结论|
|---|---|---|---|---|---|---|
|REAL-01 / 本轮冻结源与禁止范围|不适用，CLI|seed SHA固定；只读文件复制；SQLite只读+query_only；全部数据库只在私有目录|real_fact_mvp|运行前后SHA相同；不解析业务库路径；不输出真实行；实际路径/现存symlink组件预检|runtime.mjs；runtime.test.mjs；results/run-02.json|run-02脚本/独立实验范围PASS；不防恶意并发替换路径|
|REAL-02 / 审查问题4；同源A/B/C授权|不适用|A实际产品读取+全包JSON+合同；B同读取校验后窄响应；C持久化事实/计数后窄读|real_fact_mvp|按同一源、字段与范围比较；B无排序投影+一次排序，计时内排序B=1/A、C=0，来源调用A、B=1/C=0|experiment.test.ts；core.test.mjs；结果samples|首轮公平性FAIL保留；run-02脚本/独立实验范围PASS|
|REAL-03 / 审查问题1、2|不适用|活动成交非财务事实；完整范围计数、排序后分页|real_fact_mvp|独立SQL及全页ID/content；同标的跨2账户56笔排名/摘要；同日第40/41笔跨页；跨账户375笔/47页；严格日历/越界游标|core.test.mjs；scopeContracts/coverageWitnesses|run-02脚本/独立实验范围PASS；真实精确时间戳平手未观测，合成覆盖|
|REAL-04 / 审查问题2 缺失状态|不适用|四项nullable原样；空字符串不转零；缺simulationRunId不判异常|real_fact_mvp|真实缺失计数及逐页内容；另用内存null账户/withdrawn谓词反例，不混算真实覆盖|core.test.mjs；factSummary/realSourceCoverage|真实null账户0/withdrawn状态0；合成PASS；真实生命周期NOT VERIFIED|
|REAL-05 / 审查问题3；冻结实验版本边界|不适用|绑定source SHA、bookVersion摘要、规则和代码；身份含alias/锁/直接依赖；无产品动态失效承诺|real_fact_mvp|真实C无游标4字段拒绝、B旧游标4字段拒绝；独立内存C旧游标4字段拒绝；发布失败回滚；每读不重算全量数据摘要|core.test.mjs；runtime.test.mjs；结果checks；INDEPENDENT-REVIEW-02.md|实验范围PASS；不提供存储篡改检测/动态产品失效|
|REAL-06 / 审查问题4 成本与重启|不适用|首次准备、空间含WAL/SHM、读取/近似CPU/RSS/JSON；新进程只读C|real_fact_mvp|重启同响应digest、准备调用0；身份成本含总耗时；7样本p95=最大值；CPU两次取样近似|结果prepare/readSummary/restart；RESULTS-RUN-02.md|run-02脚本/独立实验范围PASS；GC未暴露；不外推页面|
|REAL-07 / 本轮暂停边界；旧实验RESULTS限制|不适用|P1/F07、Bars、重复导入、真实变更、财务资格、HTTP/浏览器/首屏、追溯/导出/并发等|real_fact_mvp|不恢复暂停任务，不修改产品或wayfinder；不以CLI结果关闭MVP票|README；最终RESULTS|NOT VERIFIED；范围外|

无前端触发、控件范围、视觉比较或数据库业务写入，UI/视觉/浏览器预览门槛为NOT APPLICABLE（范围依据见开头），不能写成产品页面PASS。[独立验收](INDEPENDENT-REVIEW-02.md)已确认仅非财务读取实验范围PASS，产品首页/交易库/一秒目标没有验收。

第二轮候选最终无真实数据库文件自测10/10 PASS，harness语法PASS；代码冻结与逐项修订见 [CANDIDATE-02.md](CANDIDATE-02.md)。随后授权run-02为58检查/42样本PASS，真实值与负例路径见 [RESULTS-RUN-02.md](RESULTS-RUN-02.md)，独立接受边界如上。
