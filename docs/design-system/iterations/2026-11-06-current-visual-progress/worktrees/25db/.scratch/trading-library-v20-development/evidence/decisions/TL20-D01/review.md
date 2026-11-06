# TL20-D01 独立验收报告

**SPEC：PASS（仅 D01 技术事实准备范围；候选方案和后续产品契约未冻结）**
**QUALITY：PASS（仅冻结证据包范围）**

审查者：`legacy_acceptance_luna / gpt-5.6-luna / max`
日期：2026-10-26（Asia/Shanghai）
基线：`d95afc37d30f817edbd6daab41e85f485138de0d`
实现报告：[`report.md`](report.md)
预检记录：[`review-preflight.md`](review-preflight.md)

本报告接受的是 D01 的 AFK 技术事实和候选方案准备，不关闭 TL20-D01，不代替 root 写 Resolution，也不接受 V2 产品、真实数据迁移、Recall 适配或新 practice 实现。

## 完整性和范围核对

- [`review-package.json`](review-package.json) 声明 12 个 worker 文件和 4 个参考文件；独立 SHA-256 核对为 **16/16 PASS，0 mismatch**。
- [`review-package.diff`](review-package.diff) 逐文件解析并与 12 个冻结文件全文比对，**12/12 PASS**，行数和内容均一致。审查没有用空 `git diff` 推断无变更。
- D01 冻结 [`source-manifest.json`](source-manifest.json) 的 45 项与当前工作区逐项比较后，只有 `.scratch/trading-library-v20-development/INTERFACES.md` 和 `DESIGN-COVERAGE.md` 两项变化；其余 43 项 hash/行数不变。两项变化均为 root 已接受的协调/覆盖记录，未发现产品源码或批准规格变化。
- [`synthetic-results.json`](synthetic-results.json) 和 root 使用新绝对 `--output-dir` 的复验均为 Node 26.0.0 / SQLite 3.53.0、10/10 PASS、0 FAIL、仅 3 个 `:memory:` SQLite 句柄。候选声明的 Bundler strict tsc 也由 root 记录为 exit 0（[`evidence/root-D01/candidate-typecheck.log`](../../root-D01/candidate-typecheck.log)）。本次没有重复整组测试，也没有打开业务库或启动服务。
- 初始失败、修复轮次和一次 manifest 路径纠正均保留在 [`verification-rounds.md`](verification-rounds.md)；稳定问题没有超过 5 轮。NodeNext 的 TS2835 是命令模块解析选项不匹配，Bundler 项目命令已通过，不是产品变更。

## SPEC 审查

### 事实准备结论：PASS

原票要求的事实准备项均有直接证据：

| 要求 | 独立判断 | 实际证据 |
| --- | --- | --- |
| 四类合成及逐字段兼容矩阵 | PASS | 报告 [`report.md:74`](report.md#L74)–[`report.md:103`](report.md#L103) 和脚本 [`synthetic-check.cjs:88`](synthetic-check.cjs#L88)–[`synthetic-check.cjs:188`](synthetic-check.cjs#L188) 覆盖 complete date、missing date、legacy run、manual work；输入全为脚本手写合成值。 |
| 身份层级不以 filename、净额或时间/价格近似 | PASS | 报告 [`report.md:11`](report.md#L11)–[`report.md:15`](report.md#L15)、[`report.md:35`](report.md#L35)–[`report.md:49`](report.md#L49) 区分文件、run、batch、execution、episode、practice、human action 和 pair；V2 规则也明确四个单位分离（`visual-design.candidate.md:136-159`）。 |
| SQLite/bootstrap/HTTP/import-history/revision/Recall 调用链 | PASS | 报告 [`report.md:51`](report.md#L51)–[`report.md:64`](report.md#L64) 给出精确入口、消费者、可复用方法和适配缺口，未把类型改名当成现有实现。 |
| parser 丢行和 multiset 边界 | PASS（事实和边界） | 报告 [`report.md:66`](report.md#L66)–[`report.md:72`](report.md#L72) 对照 parser/reimport 源码；S06/S07 在 [`synthetic-check.cjs:137`](synthetic-check.cjs#L137)–[`synthetic-check.cjs:160`](synthetic-check.cjs#L160) 实测重排、重复角色、未配对行和实际计数损失；候选完整投影及纯 comparator 在 [`candidate-contracts.ts:52`](candidate-contracts.ts#L52)–[`candidate-contracts.ts:76`](candidate-contracts.ts#L76)。 |
| 旧 run 的读写差异 | PASS | S03 在 [`synthetic-check.cjs:107`](synthetic-check.cjs#L107)–[`synthetic-check.cjs:120`](synthetic-check.cjs#L120) 证明旧 `source.run` 可读、通用 scope 为 `simulation:unknown`，当前 writer 以 `Invalid simulation evidence` 拒绝写回；没有将旧 run 冒充新 identity。 |
| Recall 同 ID 财务变化、人工图保留和新旧 key 变化 | PASS（现状风险被正确揭示） | S08 在 [`synthetic-check.cjs:163`](synthetic-check.cjs#L163)–[`synthetic-check.cjs:180`](synthetic-check.cjs#L180) 保存/重载 3 个 snapshot、drawing 和 human note；移除 exit 变为 `needs-confirmation` 且保留 lastCompleted；同 ID 改 exit price 仍为 `completed/stale=false`，改 opening price 则 episode ID 改变并拒绝 reconcile。报告 [`report.md:98`](report.md#L98)–[`report.md#L103`](report.md#L103) 没有把这个现状缺陷写成已修复。 |
| 候选 CAS、duplicate-open 日期规则 | PASS（候选声明层） | `Practice.version` 及其独立于 content revision 的说明在 [`candidate-contracts.ts:29`](candidate-contracts.ts#L29)–[`candidate-contracts.ts#L38`](candidate-contracts.ts#L38)；`open-duplicate`/`update` 同时携带 `expectedPracticeVersion` 与 `expectedRevisionId`，`changeDate` 也携带两者，见 [`candidate-contracts.ts:173`](candidate-contracts.ts#L173)–[`candidate-contracts.ts#L203`](candidate-contracts.ts#L203)。报告 [`report.md:119`](report.md#L119) 明确普通 duplicate-open 不写人工日期；EXECUTION 记录 TL20-LEG-001 已完成 1 轮修复。 |
| transaction/rollback、dry-run、旧引用保留 | PASS（方案事实边界） | S10 只验证现有 helper 的 rollback，见 [`synthetic-check.cjs:190`](synthetic-check.cjs#L190)–[`synthetic-check.cjs#L195`](synthetic-check.cjs#L195)；报告 [`report.md:121`](report.md#L121)–[`report.md:137`](report.md#L137) 明确候选 practice transaction、迁移、恢复和文件暂存尚未实施，未以 helper PASS 冒充产品实现。 |

这些判断与批准规格一致：一个导入文件构成一个模拟练习，完整内容/未配对/记录次数参与重复判断，更新保留人工成果（[`trading-library-design-spec.md:7`](../../../../../docs/design-system/trading-library-design-spec.md#L7)–[`trading-library-design-spec.md#L45`](../../../../../docs/design-system/trading-library-design-spec.md#L45)）；练习日期、历史区间和导入时间分离且人工日期受保护（同文件 `L47-L61`）；实盘主动平仓回合、内部配对和成交明细分离（同文件 `L63-L79`）。

## QUALITY 审查

### 结论：PASS

证据包是可复核的冻结包：worker 报告、候选声明、合成输入/输出、人工 Recall 文档、失败轮次和 rerun 输出之间 hash 一致；`review-package.diff` 保留了全部新增冻结内容。报告把以下事实清楚分开：当前源码事实、候选建议、HITL 未决政策，以及未实现/未验证的生产接线。没有业务 DB、真实交易内容、服务、UI 或迁移写入；这正符合本票的 AFK 只读范围。

## Findings

### Critical

无。

### Important（必须保持未冻结；不是本票事实准备失败）

1. **FULL-CONTENT-001：完整源文件语义等价仍未实现。** 当前 parser 在规范化前排除无效、重复角色、未配对和歧义行，S07 只能证明损失；候选 `CompleteNormalizedFile`/multiset comparator 是清晰边界，但没有运行时 normalizer、完整原行留存或导入接线。后续不得以 accepted executions、收益合计、filename 或 fingerprint 宣称全文件重复。证据：[`report.md:156`](report.md#L156)–[`report.md:158`](report.md#L158)、[`EXECUTION.md:41`](../../../EXECUTION.md#L41)。
2. **LEGACY-REF-001：旧 Recall 绑定和受影响状态仍未冻结。** S08/S09 证明同 ID 财务变化可能保持 completed，改开仓可能换 episode key；候选要求保留旧作品、旧键、快照/图画/正式版并显式 `needs-confirmation`，但没有 D06 writer/reader、reference CAS 或原子跨图实现。证据：[`report.md:98`](report.md#L98)–[`report.md:103`](report.md#L103)、[`EXECUTION.md:42`](../../../EXECUTION.md#L42)。
3. **TL20-LEG-001：CAS 修复已在候选声明完成 1 轮，但运行时仍未验证。** `Practice.version`、`expectedPracticeVersion`、`expectedRevisionId` 和 duplicate-open 不写日期均已写入 proposal；候选文件开头明确 `PROPOSAL ONLY`，没有 schema、repository、HTTP 或并发测试。因此该修复可作为 D01 的候选技术事实接受，必须保持为后续实现门槛，不能写成已落地行为。证据：[`candidate-contracts.ts:1`](candidate-contracts.ts#L1)、[`candidate-contracts.ts:29`](candidate-contracts.ts#L29)–[`candidate-contracts.ts:38`](candidate-contracts.ts#L38)、[`candidate-contracts.ts:173`](candidate-contracts.ts#L173)–[`candidate-contracts.ts#L203`](candidate-contracts.ts#L203)、[`EXECUTION.md:27`](../../../EXECUTION.md#L27)。
4. **PROD-VERIFICATION-001：事务、迁移、恢复和真实来源完整性未验证。** S10 仅是现有内存 helper 回滚；候选事务范围、幂等、filesystem staging、恢复和旧引用适配均为方案。不能以 10/10 内存合成或候选 tsc 代替隔离库实现验收。证据：[`report.md:121`](report.md#L121)–[`report.md#L137`](report.md#L137)、[`report.md:170`](report.md#L170)。
5. **政策/存量边界继续回原票：** `LEGACY-DATE-001`（真实旧日期和冲突）、`LEGACY-IDENTITY-001`（真实旧数据映射）、`ACTION-001`（人的动作证据与合并/拆分）、`MULTISCOPE-001`（单文件多账户/标的）都被正确列为 blocker；候选 arrays 或 synthetic fixture 不代表政策已定。证据：[`report.md:160`](report.md#L160)–[`report.md#L170`](report.md#L170)。

### Minor

无。初始 harness、fixture 和 manifest 路径问题均保留原始失败并在既定修复轮内复验通过，不构成冻结包质量缺陷；详见 [`verification-rounds.md`](verification-rounds.md)。

## D01 接受边界

本次可接受并可供后续实现使用的技术事实是：现有身份和调用链的分层、旧 run 读写差异、parser 丢行事实、完整 multiset 比较的纯函数边界、日期/动作/配对的语义分离、Recall 人工图保留要求，以及候选 CAS/duplicate-open 设计。

以下必须保持 **未冻结 / NOT VERIFIED**：新 practice/revision schema 和 HTTP、完整原始行 normalizer 与生产导入接线、PracticeRepository 运行时 CAS、duplicate-open/changeDate 实际并发行为、真实存量日期和 legacy binding、human action/multi-scope 政策、Recall writer/reader 原子适配、迁移/恢复/文件暂存回滚。root 仍需另行接受这些范围并决定票状态。

**最终状态：`SPEC PASS / QUALITY PASS / D01 FACT-PREPARATION ONLY; PRODUCT CONTRACT AND IMPLEMENTATION NOT VERIFIED`。**
