# 旧库重复识别证据（2026-10-28）

只读检查业务库；没有写入业务数据。旧库的导入批次共 213 条，`source_fingerprint` 均为空；没有 `trade_change_plans` 和 `source_material_versions` 表。富途成交共 814 条：808 条 PDF 成交带有 90 个旧版 16 位来源指纹，另 6 条属于人工核实配股，不应当作文件成功回执。旧指纹可说明成交来源，不能证明原文件完整导入或严格证明文件字节相同。

新版普通导入中的来源材料可能缺少指纹，但已成功消费的计划与回执可追溯部分候选的来源指纹。新版应将更可靠的原文件指纹与成功提交事务绑定；取消和失败不能建立成功凭据，同一提交请求的安全重试应维持幂等。

旧文件需要单独兼容：不能声称“已确定为完全相同文件”。当旧来源指纹相符且服务端确认本次每笔候选均对应当前已有成交，并且没有新增、冲突、替换或恢复时，才可提示“疑似已导入，本次成交均已存在、没有新增”；还须考虑文件内重复、未识别内容和材料/修订的合法差异。不能单凭重复数量等于候选数量判断。

证据入口：`app/lib/import/futu.ts`、`app/lib/import/execution-reconciliation.ts`、`app/lib/storage/sqlite-store.ts`、`app/lib/storage/trade-changes-engine.internal.ts`。只读调查 SQL 使用批次 `source_fingerprint`、成交 `evidence_json.source.fileFingerprint` 和 `formatRuleId`，未保存或输出业务库的个人数据。
