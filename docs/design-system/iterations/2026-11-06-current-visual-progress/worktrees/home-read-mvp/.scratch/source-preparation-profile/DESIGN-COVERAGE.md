# 需求覆盖

owner: update_experiment；集成/独立接受：协调者 root 与独立 reviewer。依据：本次 NEW_TASK 和后续非独占/隐私限制；无 UI 元素、画板、浏览器旅程，均 NOT APPLICABLE（离线诊断，不改产品）。

| ID | 阶段/旅程 | 交付与反例 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| P01 | 7.3 秒边界/假说 | DESIGN 与原入口精确锚点；缺失/重复锚点拒绝 | instrument.test、product.test 阶段计数 | implementation PASS；根因 UNKNOWN |
| P02 | 固定私有只读输入 | 固定 seed 文件只读复制至私有 0700/0400 目标；SHA/stat/无 sidecars/query_only/immutable；宽权限/路径/旁车/变化拒绝 | core.test、product.test、review-gates.test、readonly-uri-investigation | synthetic PASS；真实 NOT VERIFIED |
| P03 | 冻结与执行许可 | 严格工具/源/支持 manifest；改动/审批缺失 DB 未打开 | entry/review-gates.test 的 CLI/direct-import 子进程与 DB sentinel | implementation PASS；独立待审 |
| P04 | 重现采样 | 3 对 B/P 交错、fresh connection，原始 wall/CPU/大小、阶段 residual | synthetic-04.json；真实待许可 | 合成 1 对 PASS；真实3对 NOT VERIFIED |
| P05 | 内容完整性 | 原合同接受、normalized 全内容摘要一致；数据变更/保留嵌套时间字段反例 | core.test、product.test 原入口 1003 条2页 | synthetic PASS；真实 NOT VERIFIED |
| P06 | 隐私与失败 | 无原始记录/CPU profile/stack，安全错误码，输出 wx | core/entry/product.test | implementation PASS；独立待审 |
| P07 | 扰动/限制 | 探针校准+baseline，非独占，不推 p95/SLA/一秒 | DESIGN、REPORT、synthetic-04.json | 明确记录；真实扰动 NOT VERIFIED |
| P08 | 不变旧证据/范围 | 仅本目录新文件；不改产品/旧实验；UI/财务/Bars/导入排除 | git status、冻结产品 manifest；仅本目录 patch | implementation 范围遵守；协调者独立接受待审 |
