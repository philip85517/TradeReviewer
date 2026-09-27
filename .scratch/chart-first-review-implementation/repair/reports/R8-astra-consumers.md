# R8 独立consumer证据复核

2026-09-27，`gpt-6-astra / low`。独立打开4张实际图，读取fixture报告与真实组件/领域消费者；未操作浏览器、运行测试、改产品或读写数据库。**以下只关闭对应consumer范围，整体未接受。**

## E18 旧missing Text指针显示：局部pass

已独立打开 `R8-missing-text-visible.png`，可读文字完整显示“关联证据已缺失或修订变化，原引用保留”，并保留 `Text drawing-1790426055724-hn3sy · 修订2 · 归属 synthetic-repair-fresh-replay-partial`。不是因找不到新文字而删除原指针，也没有冒充现有revision1。

读取 `fault-acceptance/fixtures-report.md/json`：SQLite backup创建独立legacy-fixture，仅把原指针revision1改2，当前drawing仍revision1，属于历史不完整状态模拟；snapshot和retained bundle摘要不变。source/fixture各25 execution相同哈希。其来源明确不是实际重导。

实际组件 `recall-manual-evaluations.tsx:116`遍历当前draft.evidence，根据status不可用显示evidenceLabel，而不是丢弃引用；label保留kind/id/revision/owner。截图证明工作区真实consumer的missing Text显示。**截图处于工作图、人工标签仍是可编辑状态，不能额外声称已经进入只读留存快照模式**；缺失指针本身以只读文字显示的范围已闭合。只读留存模式已有组件自动化应独立归档，不冒称此图覆盖。

## E18 待确认→确认→重开：fixture consumer局部pass

已独立打开 `R8-association-confirmed-reopen.png`：人工“判断”标签仍选中，其关联待确认提示/按钮已不再出现。顶部“导入行情已有变更 / 移除1笔成交”独立提醒仍在，不将其误认为人工association确认失败。

组件`:100–102`仅在association.status=needs-confirmation且非readonly显示确认动作，并调用 `confirmRecallManualEvaluationAssociation`。领域函数 `manual-evaluations.ts:254`克隆文档，仅把所选association置linked、executionIds更新为currentExecutionIds，不改整个document.status或清stale标记。因此用户未另确认行情变更时顶层needs-confirmation保留符合这两个独立状态的语义。

root实际浏览器记录：独立3052 fixture点击确认→保存→重开，确认按钮计数0；副本SQL revision36、association linked、当前3 execution IDs、analysis标签保留。本代理仅复核截图与源码，SQL及点击过程归root，不冒称亲自查询。**该消费/保存重开边界关闭；真实重导产生needs-confirmation的上游旅程仍unverified，fixture报告已明确此限制。**

## US29/30 真实保存错误与409：分开结论

独立打开 `R8-save-500.png`：实际错误alert Synthetic Recall save failure、计划数量1100原值仍在，风险4400对应本地输入。root记录故障撤销后返回重试、重开仍1100。**该真实500保留/恢复局部pass**，不只依据原mock测试。

独立打开 `R8-real-conflict-1300.png`：显示真实云端新版本冲突与“当前草稿已保留”，A本地计划数量1300仍在；root A/B流程为A1100、B成功1200、A1300得到409，服务端保留B1200。**真实冲突未覆盖本地或服务器赢家这一边界局部pass。**

**R9明确失败仍在：** 用户显式重新载入远端后旧planEdits缓存未清，不能因409时正确保留1300就将冲突完整恢复标通过。Luna正在修复该独立动作；本审查不提前读取/接受其未冻结修补。

## 最小剩余

- R9显式重载真正消费远端1200并清过期本地输入/错误缓存，相关自动化和浏览器复验。
- 真实合成原单重导→变更识别→人工待确认→确认→保存重开；独立fixture消费成功不替代。
- 真实手机软件键盘价格/下部退出原因场景，无豁免。

以上来自R7-evidence-gaps本次主题，不凭本文件将其他DESIGN-COVERAGE条目一键置pass。
