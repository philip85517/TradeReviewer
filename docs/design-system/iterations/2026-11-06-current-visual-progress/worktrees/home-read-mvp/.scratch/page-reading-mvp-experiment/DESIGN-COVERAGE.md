# 一次性读取实验覆盖契约

状态：合成实验范围通过协调者独立复核；真实产品链路未验证。关联 wayfinder `03-mvp` 的依赖仍由原票管理，本目录不关闭该票。

范围来源：协调者本轮委派；`issues/03-mvp.md` 的“预先准备、轻量摘要与分页、更新/重启/资源”；`docs/backend-design/page-reading-architecture-review-2026-10-29.md` §问题 2–4。

|需求 ID / 来源|elementID / 参考图|状态 / 精确范围|owner|旅程 / 可观察反例|证据|
|---|---|---|---|---|---|
|EXP-01 / 本轮隔离约束|不适用：无产品 UI|只读产品源码；只写本目录；固定合成数据|mvp_experiment|CLI 新建独立 SQLite，绝不读取 runtime.json 业务库路径|README.md；results/latest.json|
|EXP-02 / 03-mvp 成本对照|不适用：CLI|约 1,867 笔 / 236 标的；20,000 笔放大；3 账户；每页 8 笔成交|mvp_experiment|模拟重复全量、每次计算后窄响应、持久化预备结果；记录构建/读取/CPU/空间/字节|experiment.mjs；results/latest.json|
|EXP-03 / 审查问题 1、4|不适用|完整匹配范围先筛选/排序/计数，再分页；按成交日期；不含持仓/回合|mvp_experiment|逐页对照独立原始 SQL；跨账户同标的；搜索命中未在首页的记录；限制页不得改总数|results/latest.json checks|
|EXP-04 / 审查问题 2|不适用|合成 amount 字段，依据缺失保留 null 和原因；不计算真实财务|mvp_experiment|事实存在但金额未知，不改写 0；已知金额仅合计为 knownSubtotalCents，完整总额遇缺失返回 null|results/latest.json checks|
|EXP-05 / 审查问题 3|不适用|成交/复盘/rule 合成版本；游标绑定筛选、排序、页大小与版本；选择冲突后刷新策略|mvp_experiment|翻页期间合成补录旧日期记录 -> 明确拒绝旧游标；合成复盘状态/rule 改变 -> 失效；重建后匹配|results/latest.json checks|
|EXP-06 / 审查问题 3、4|不适用|原子发布失败与进程重启|mvp_experiment|注入发布中断 -> rollback；旧结果保留但读请求报 stale；重建后恢复；新进程首次读不重新准备|results/latest.json restart/checks|
|EXP-07 / 未批准/暂停范围|不适用|真实导入/修订、P1/F07、Bars、FX、来源资格、重复导入、真实页面、浏览器渲染全部 NOT VERIFIED|mvp_experiment|明确不以本实验证明完整 MVP、页面一秒、真实导入成功或产品基线|README.md 限制|

无前端控件或数据接线变动，因此 UI 控件审计、参考图对比、浏览器预览与正式数据库写入验收不适用。所有状态更改均是实验 schema 的直接合成 mutation，不调用产品导入或修订接口。

## 第二轮历史：实现者自测结果

EXP-01至EXP-06在本目录合成边界内PASS，证据为`results/2026-10-29-run-02.json`，脚本hash与结果一致。EXP-07各项继续NOT VERIFIED，不计入实验通过。28个检查、72次路线采样及两次新进程首读已完成；首次运行失败历史见`RUN-HISTORY.md`。这是第二轮历史记录；最终接受结论见第三轮与独立验收记录。


## 独立复核后第三轮最终证据

最终hash `eaeac44724a44124114494aeb7723da13a655f66c4ccdfe85b76db5212dae31c`；`results/2026-10-29-run-03.json`：两组各15项检查、共72个读取样本、2个新进程首读PASS。精确benchmark组合已逐页对照；发布失败前后全体旧行、摘要和指针digest相等；full/narrow envelope等价；新进程prepare函数调用观测0。前两轮证据继续保留。协调者已独立复跑并接受合成实验范围，见 `INDEPENDENT-ACCEPTANCE.md`；真实产品范围仍 NOT VERIFIED。
