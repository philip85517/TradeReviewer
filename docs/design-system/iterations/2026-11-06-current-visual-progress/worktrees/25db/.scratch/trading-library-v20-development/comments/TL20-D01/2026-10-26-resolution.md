# 旧数据怎样映射为独立练习并保留复盘引用？——事实准备结果

日期：2026-10-26。接受人：root。类型：AFK task；仅当前工作目录内的只读事实准备，未决定用户政策。

## 事实和理由

[Sol核查报告](../../evidence/decisions/TL20-D01/report.md)给出四类合成记录、逐字段兼容矩阵、SQLite/bootstrap/HTTP/import-history/revision/Recall调用链和可审查候选类型。[专属Luna](../../evidence/decisions/TL20-D01/review.md)分别给出SPEC PASS与QUALITY PASS，范围为D01事实准备。root亲读关键源代码，使用新临时目录独立运行10项合成检查及项目Bundler规则的候选strict类型检查，均通过；详见[root接受](../../evidence/root-D01/acceptance.md)。

现有系统没有一等practice/revision/人的主动回合/内部配对身份；TV episode可以跨旧run，旧run的可读范围与当前写入资格不同，不能直接换名为新练习。parser会丢弃部分源行和列，accepted executions不能证明完整文件内容等价。Recall对账还存在同ID财务变化仍completed、开仓变化导致episode换键的情况。报告完整保留这些缺口，没有宣称修复。

候选方案据此分离文件来源、完整源行、练习、内容版本、日期元数据版本、人的动作、内部配对及旧引用；内容比较按完整规范化记录的多重集，保留重复次数。日期修改和导入同时校验元数据版本与内容版本，普通等价重导不写人工日期。上述是可供后续定案的候选边界，尚无生产实现。dry-run、事务、旧人工图保护、回滚和文件暂存的边界均已明确列出，不能把内存helper回滚当成新事务落地。

## 影响与未决边界

关闭的是原票要求的事实准备，不是完整迁移/业务契约冻结。没有读取真实交易数据，不能推断真实旧日期或自动绑定旧作品；后续若需样本，应另开明确的只读存量核查范围。

- [练习资金、结束估值与权益轨迹以什么来源为准？](../../issues/02-valuation-authority.md)继续决定来源。
- [变更文件的候选、冲突和部分失败怎样让用户处理？](../../issues/03-update-conflict.md)继续决定交互和冲突政策。
- [跨标的、跨账户和混合方向文件如何展示与分类？](../../issues/04-multi-scope.md)继续等待用户真实答复。
- [新回合身份怎样接入既有回放状态并安全重开？](../../issues/06-replay-adapter.md)继续核对Recall接线；原日期和人的主动行为识别票仍由原负责人处理。

完整原行normalizer、生产multiset比较、schema/repository/HTTP、运行时CAS、旧引用适配、迁移及恢复均NOT VERIFIED。I10–I20不能仅凭本票关闭而直接实施或接受。

## 同步位置

原票链接本Resolution并关闭；地图只增加一句事实准备摘要。README、EXECUTION、INTERFACES、DESIGN-COVERAGE及FINAL-ACCEPTANCE同步局部接受范围，继续保留整产品未验证状态。FULL-CONTENT-001、LEGACY-REF-001、LEGACY-IDENTITY-001和待决政策保留在问题账本；候选CAS的1轮修复不等同于运行时解决。

## 后续用户确认（2026-10-26）

上文保留D01接受时的待决状态。用户随后明确“一份练习仅可能包含一个账户和一个标的”，[D04已接受](../../comments/TL20-D04/2026-10-26-resolution.md)并覆盖多归属候选假设；D01冻结研究包保持原貌，不能把其数组声明作为现行应用接口。方向分类仍未决。
