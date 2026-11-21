# 原始来源纠错工具

适用工具：[source-correction.mjs](../../scripts/source-correction.mjs)；必要反例保存在[工具测试](../../scripts/source-correction.test.mjs)。本说明从 2026-11-18 的实施、独立审查和协调者验收记录提炼，命令参数已对照当前源码。本文编写时没有执行数据库操作。

## 适用范围

用于已核实原件后的有界修正：成交的账户、证券身份及证据，导入批次的证据、核对信息和记录数，以及补入有原件依据的证券、批次和成交。工具只允许 `executions`、`import_batches`、`instruments` 三张源表；已有成交的数量、价格、费用等经济列不在更新白名单，已有证券不能由此工具修改。不支持任意 SQL 或源记录删除。

工具检查计划与数据库是否匹配，不替代人或独立审查者核对原件。保留原文件、SHA、页码/行位及判断理由；包含账户和交易详情的完整计划与备份留在私有目录，不放 Git。

## 执行顺序

1. 从原件独立得出预期，列出准确的新增、修改及保持不变的范围。使用目标库的 WAL 一致性备份，在隔离库中先预检、应用、关闭重开并通过实际存储读取；检查防重及回退，不靠 SQL 更新成功就接受。
2. 制作绑定准确目标源摘要的计划，由非计划作者核对原件和前后差异。`baselineDigest` 覆盖三张源表的全部内容；后续哪怕是计划外的源变化，也会使旧计划失效。
3. 获得该次数据修正授权后，预检准确目标库，使用要求在线备份的 CLI 应用。应用事务重新检查源摘要和完整 before 行，避免预检之后发生的变化被覆盖。
4. 关闭重开目标库，通过实际存储读取、外键检查、防重及范围外数据比较验收。然后等待正常后台发布，核对同版首页、详情和导出。源修正完成不等于首页已刷新。

计划顶层为 `id`、`reason`、`baselineDigest`、`evidence`、`changes`。每个证据包含 `sha256`、正整数 `page`、`description`；每个改动包含 `table`、`id`、完整 `before` 和完整 `after`。新增的 before 为 null；after 不能为 null。最多 500 个目标，具体字段白名单和 schema 检查以源码为准。不要从过时库抄 before，也不要仅更换摘要让旧计划强行通过。

## CLI 示例

从仓库根目录运行，以下 `/ABS/...` 均需换成已准备好的绝对路径。数据库和计划必须存在；备份父目录应已存在、属于当前用户且权限为 0700。每次写操作使用新的备份文件名，不能覆盖已有文件。

```sh
./scripts/native-node.sh scripts/source-correction.mjs --db /ABS/isolated.sqlite --plan /ABS/private/plan.json --check
./scripts/native-node.sh scripts/source-correction.mjs --db /ABS/isolated.sqlite --plan /ABS/private/plan.json --apply --backup /ABS/private/before-apply.sqlite
./scripts/native-node.sh scripts/source-correction.mjs --db /ABS/isolated.sqlite --rollback OPERATION_ID --backup /ABS/private/before-rollback.sqlite
```

`--check` 只读检查结构、白名单、证据形状、源摘要和行快照，不模拟全部写入约束。`--apply` 和 `--rollback` 先做 WAL-aware 在线备份，再进入实际事务；备份文件独占创建、权限 0600。任何约束或比较失败整笔拒绝，不保留半改数据。直接调用导出的 API 不会自动备份，调用方承担同等保护。

## 重复执行与回退

计划内容及其 SHA、源表 before/after 摘要和执行状态，随数据在同一事务中写入 `source_correction_runs`。计划审计负载不能 UPDATE/DELETE，回退保留执行历史。

- 同一操作 ID、同一计划且源仍等于应用后的状态时，重复应用返回 already-applied。相同 ID 不同内容、源已变化或操作已回退时拒绝。
- 回退先验证完整 after 摘要和行，再按依赖顺序恢复/移除本次改动，最后检查完整 before 摘要。回退后再次回退无副作用。
- 新增证券、批次或成交后来被人工复盘、行情或其他计划外外键引用时，回退在删除前拒绝。不能为了回退而级联删除或清空人工资料。
- 摘要冲突或引用保护拒绝后，重新核实当前状态并设计新的有界修正；不能跳过保护或直接恢复旧库覆盖后续业务。

## 验收与历史教训

早版回退存在可能连带清空人工复盘引用的问题，独立审查拦下后才增加删除前外键检查。该失败不能被“工具测试全绿”掩盖。2026-11-18 的接受范围包含隔离库应用/重开/重复/回退、计划外引用保护、原件及人工数据保护，以及当次获准的正式应用；不代表未来任意计划也已获准或已核实。

以后修改工具时，优先复用上述正式测试和少量实际 schema 样本；临时目录中的特定账户探针不复制成第二套维护工具。完整首页的性能和视觉门槛按[独立交接记录](../reports/2026-11-21-homepage-integration-handoff.md)处理。
