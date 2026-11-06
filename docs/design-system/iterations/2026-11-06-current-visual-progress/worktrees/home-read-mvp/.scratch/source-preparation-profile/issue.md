# SP-01 — 来源准备只读分段诊断

State: closed（仅限本次隔离诊断）
Status: accepted（完整页面目标仍未验收）
Assignee: update_experiment
集成负责人: root

Scope: DESIGN.md / DESIGN-COVERAGE.md；仅本目录新文件。真实副本测量等待独立审查与协调者许可。执行候选与命令不是测量批准。

历史：2026-10-29 读取原调用链及既有 run-02 汇总；根因仍 unknown；开始护栏 TDD。

预审施工补充：tsconfig 身份遗漏、CLI/library 门禁分离与任意 path 入口已通过合成 RED/GREEN 修复；run-02 非空 SHM 保持拒绝，改为获批后从固定 seed 文件只读复制至本实验私有输入。新增权限、无旁车、symlink、SHA、不可覆盖反例。完整合成回归 17/17；候选冻结与独立接受待下一步。真实 seed 尚未读取/hash/复制/打开。

冻结 candidate-01：snapshot 4f013391187f622e24878294efee3dbe6ed4c58117cce346eb36b547d3c2fe21；code 462e7bf8b76b09b6c4681bdd0e9df790d9aca29e30471dec22e711e11b80023f；support 6f79624d2009a80583234235605ed38ec7db89eb93ec38777f86b23fcf37cb50。17/17 合成回归 PASS，--check PASS 且未读真实输入/未开库。已交 root 与 update_review 独立审查；状态 implementation-ready / acceptance-pending。此 issue 与 reports/freeze-receipt-01.json 是冻结外运行记录，不是支持证据。未创建审批文件，未执行真实复制或测量。

后续记录：候选通过独立审查后，协调者创建本轮内部许可，执行 approved-01 三组隔离对照；结果和验收见[中文报告](reports/approved-01-plain-report.md)、[独立结果审查](reports/INDEPENDENT-RESULT-REVIEW-APPROVED-01.md)和[协调者验收](reports/COORDINATOR-ACCEPTANCE-APPROVED-01.md)。上段保留的是测量前历史状态。财务、Bars 和重复导入继续暂停。
