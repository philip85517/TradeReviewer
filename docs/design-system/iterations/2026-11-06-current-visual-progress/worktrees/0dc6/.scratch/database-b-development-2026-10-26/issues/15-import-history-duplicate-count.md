# 导入历史：实际重复数量的证据归属与读取

State: blocked  
Status: 5/5 acceptance-failed, stopped  
Assignee: /root/duplicate_history_diagnosis  
集成负责人: /root  
Blocked by: 原问题第五轮整体验收失败，按用户要求停止继续迭代；底层独立审查也未接受。财务与 Bars 保持暂停。

## 范围与参考

按用户批准的导入公开接口和桌面导入旅程，保持导入前预估与正式保存结果的含义可核查；证据不足时不得将另一批的数量冒充为本批结果。保留此前批准设计及 [DESIGN-COVERAGE](../DESIGN-COVERAGE.md)，不得调整财务、Bars 或已达到 5/5 上限的问题。本票记录既有原问题，不重置尝试轮次。

## 验收与反例

- [ ] 原问题正确性：正常导入和幂等读取返回有证据的实际数量；跨批或证据矛盾时不能虚报。独立公开边界测试及证据待补。
- [ ] 已消费的损坏凭据不能被静默跳过；同批存在一份正常和一份无法确定归属的凭据时显示未知。候选 3 [FAIL](../evidence/import-history-duplicates-2026-10-27/candidate3/luna-review-candidate3.md)。
- [ ] 完整范围的性能和安全边界：保留每轮原样本及软硬件/缓存约束，不能用异常样本的快速一次结果覆盖慢样本；首页完整一秒为独立门槛。
- [ ] 原 P03/P04 的既有合同及失败有证据裁定，不能通过弱化测试掩盖缺陷。
- [ ] 受影响的桌面控件、实际持久化、返回和刷新、同态视觉及完整产品构建依据项目规范验收。

## 轮次和证据

候选 1/5 跨批汇总及性能 FAIL；候选 2/5 跨批行归属 FAIL；候选 3/5 异常凭据跳过 FAIL；候选 4/5 专项正确性受限 PASS、整体 FAIL（异常性能和原 P03/P04），见 [第四轮独立报告](../evidence/import-history-duplicates-2026-10-27/candidate4/luna-review-candidate4.md)。剩余第五轮；若第五轮不通过，按用户要求停止并保留所有证据。特殊 TV 身份绑定及账户纠正样例的实际数量仍可能未知；隐藏未选计划的闭世界性质尚未证实，不能宣传全部数据均可安全归属。

第五轮设计诊断：现有索引不能证明未读取的计划不涉及目标批次；反复完整解析造成异常数据下的高成本。实施方向为完整核验后持久化轻量归属证明，并与后续写入/恢复规则同步维护；旧库首次建立的扫描、导入后首读及重启首读必须实际测量，不能将未准备好或结果未知算作一秒通过。只读诊断及最终文件所有权待附证据。UI 切片见 [确认前重复信息](16-import-confirm-duplicate-preview.md)，两切片共享原问题 5/5 总验收。

第五轮候选已冻结；14 个底层文件由协调者复核哈希一致。冻结回归 461 PASS / 1 FAIL，失败项为旧测试仍要求数据库版本 17、当前迁移版本为 18；不修改旧测试掩盖失败。UI 独立验收发现日期精度和账户信息问题，全项目类型检查失败；两切片共享原问题，故整体 **FAIL、5/5 停止**。首次启动及审计分别测得约 3.74 秒和 3.04 秒，但用户规定进程启动单独计时，不能据此判定页面一秒门槛失败；真实完整首屏、重启后首读和导入后首次打开仍未验证。详见 [第五轮底层报告](../evidence/import-history-duplicates-2026-10-27/candidate5/FINAL-LIMITED-REPORT.md) 和 [确认页独立审查](../evidence/import-confirm-duplicate-preview/INDEPENDENT-CANDIDATE-REVIEW.md)。底层独立审查尚在进行，结束后补充其结论，不开启第六轮。

底层独立审查已结束，结论 **STOP / NOT ACCEPTED**。一条静态反例显示：外部 SQLite 连接直接修改派生重复数量时，现有失效保护可能不触发，读取会返回错误的确定值；该反例尚未运行复现，详见 [独立审查](../evidence/import-history-duplicates-2026-10-27/candidate5/INDEPENDENT-FINAL-REVIEW.md) 与 [静态反例](../evidence/import-history-duplicates-2026-10-27/candidate5/independent/derived-proof-tamper-counterexample.md)。备份样本局部通过，但激活、强杀和部分恢复场景未闭合。
