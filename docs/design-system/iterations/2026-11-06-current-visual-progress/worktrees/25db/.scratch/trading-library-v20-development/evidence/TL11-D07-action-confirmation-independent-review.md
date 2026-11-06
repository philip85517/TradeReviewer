# 动作确认资格门：独立审查和第 1 轮复验

2026-10-28；仅审查和测试纯模块，未修改实现、业务数据库或启动服务。基准 HEAD `d95afc37d30f817edbd6daab41e85f485138de0d`，受审源码是工作区未提交文件。产品、UI、持仓计算和统计链均非本次验收范围。

## 结论

第 1 轮修复后，在明确的纯函数输入前提下，缺少或不可靠编号的记录未确认时不能计数；确认本身也不能代替动作已经识别和配对完成。全空稀疏数组、混合空槽和 null/错误类型的成交现已拒绝。目标 suite 和独立反例均通过。此结论不证明最终业务规则、实际来源、持久化、历史交易或页面已经接入或通过验收。

原版 `3a5cca541a99f9cddfaca96715335ff12fb67b99669365b57f5b9b9752cf7371` 使用 `executions.length > 0 && executions.every(...)`，静态反例为合法的 `Array<ActionRoundExecution>(1)`：长度为 1 但 `every` 跳过空槽，会产生 true；现版采用逐项检查自有索引拒绝空槽。原版是静态源码反例，由于实现者在测试开始前并行修改文件，没有对原版录得运行红灯，不应宣称有原版运行证据。

修复版 SHA `4cad440e0718da3f6942d53f9ff8250bf15eab2408d405e15ea69be50ab90b25`，测试前后哈希一致。`./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/trades/action-confirmation.test.ts --maxWorkers=1`：1 文件 13 项通过。隔离临时 Vitest 的 [独立反例](TL11-D07-action-confirmation-independent.test-source.txt) 3 项通过，输出见 [复验日志](TL11-D07-action-confirmation-independent-retest.log)。

此前第一次独立运行的 [日志](TL11-D07-action-confirmation-independent-test.log) 有 1 个审查断言失败：我原期望错误编号类型抛异常，但并行更新后的实现已改为安全返回 false；因此该失败是审查脚本的过时假设，非产品缺陷。日志同时不能用来证明原版运行失败。已将审查断言改为要求返回 false 后重跑。

## 契约及剩余限制

- `requiresManualActionConfirmation` 判断的是**存档中**编号是否非空且由调用者明确认定可靠；并不判断原始文件是否有编号（`app/lib/trades/action-confirmation.ts:1-12`）。单凭 `referenceIsReliable=true` 并不能证明来源可靠；需要未来生产入口先独立建立该标记，不能将现有其他来源编号直接当作可信委托号。
- `canCountCompletedActionRound` 依赖调用者提供动作身份、完整配对和逐条确认状态（同文件 19-41）；即便三个布尔值为真，也不能证明这些事实本身可靠。模块不完成分组、确认的持久化、复盘映射或成交数据完整性审查；空数组与稀疏数组均不能计数，正常数组只能按给定数据评估。
- 对传入的 **每条** 成交，无号/不可靠且未确认都会阻止计数。独立例子是缺号开仓加有号平仓，当前返回 false；如果只传平仓则不会检查未传入的开仓。用户尚未确定开仓/平仓各自需要纳入什么证据，以及待确认的配对依赖，故该接口目前只能是抽象资格门，不能将这一行为宣称为完整已批准生产口径。
- 当前 TypeScript 类型要求成交数组、布尔值和字符串/空编号；基本错误类型和 null 成交已拒绝。没有证明任意恶意 Proxy、完整外部数据验证、并发和状态过期等情况下的行为；外部输入接线仍需明确验证边界。
- 搜索生产 `app` 代码，除模块本身外未找到此模块调用。没有对用户看到的回合数、位置、原始记录或复盘产生经过本次验证的改变。
- 决策票仍为 open，不能把同账户、同标的、相同编号视为一次操作的提议误作确认；不得仅凭时间接近合并。见 [原规则审查](TL11-D07-independent-rule-review.md) 和 `.scratch/trading-library-v11-design-decisions/issues/07-action-identification.md:45`。
