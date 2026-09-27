# R8 真实浏览器扩展验收

日期：2026-09-27。root 独立操作，Luna gpt-5.6-luna/max 修复，Astra gpt-6-astra/low 独立复核。整体未接受，见 R9 冲突恢复及真机软件键盘余项。

## 图表生命周期：限定通过

旧构建在切回合/resize出现一次 `Object is disposed`。SDK detachPrimitive 会排新一轮绘制，旧 remove→detach 顺序在画布销毁后排入新任务。修复 detach→remove、退订范围监听，并防止旧 RO/queued range callback访问已销毁实例。

- root 独立 43/43（R8-coordinator-tests.txt），最后冻结源码 typecheck、lint、build exit0（R8-final-*.txt）；最终构建 runtime5/5（R8-runtime.txt）。不宣称本轮全仓全绿。
- 3049生产服务会话28457，显式 repair/acceptance.sqlite；原始25合成成交未修改。
- 最终浏览器从 2026-09-26T22:26:39.789Z 开始：999996 post→交易库→999999 pre→390More→交易库→999996 post→1440。真实主图正常，未来边界正确；新时段 error=[]。
- [原失败](R8-browser-before.json)、[新时段日志](R8-browser-after.json)、[最终事后主图](R8-final-post-1440.png)、[窄屏记录](R8-more-390.png)。旧错误没有被删除或当作新构建错误。
- [Astra 独立闭环](R8-astra-disposal.md)。此结论只关闭生命周期缺陷。

## HTTP500：输入保留、离开前重试保存、重开通过

3051本机代理默认转发3049，只给PUT /api/storage/recall一次500，然后自动恢复pass。真实页面999999计划数量1000→1100；出现失败提示，字段仍1100。点击返回交易库触发离开保护重试；正常离开后重开仍1100。[失败可见截图](R8-save-500.png)。未触发回放、未修改原始成交。代理见 ../fault-acceptance/recall-fault-proxy.mjs。

## 真实双窗口409：发现R9，未通过恢复

A3049/B3051同时读1100；B写1200正常保存并返回；A写1300收到真实SQLite CAS冲突（没有注入409）。A字段1300保留，B重开1200，证明拒绝覆盖另一窗口。A显式“重新载入”后提示消失且无dirty，但计划仍1300/风险5200；这是缓存显示错误，不能称恢复通过。[原冲突图](R8-real-conflict-1300.png)、[R9票](../issues/R9-conflict-reload.md)。等待Luna修复与最终双窗口复验。计划体验样本稍后恢复1000，尚未推进行情。

## 历史缺失Text引用：隔离夹具实际显示通过

3052使用 SQLite backup API 创建的 legacy-fixture.sqlite，原25成交和原验收库不变；仅模拟历史指针revision2无法在当前drawing revision1中找到。实际进入999996事后，滚动独立侧栏，原drawingId、修订2、owner完整提示可读；没有静默删除或重新绑定。证明此历史状态的UI消费者，不能冒充导入流程。

有效截图 [R8-missing-text-visible.png](R8-missing-text-visible.png)；早一张 R8-missing-text-fixture.png 尚未滚到提示，不能作为提示可视证据。[夹具边界和哈希](../fault-acceptance/fixtures-report.md)。

## 待确认标签consumer：限定通过

另一SQLite backup副本needs-confirmation-fixture，实际3052打开999996：可见“成交集合已变化，当前标签需要确认归属”及确认按钮。点击“确认使用当前回合成交”，返回库/重开后按钮count=0，原analysis标签保留。只读SQL复核revision36，association linked/当前三笔，见[R8-association-confirmed-state.json](R8-association-confirmed-state.json)及[实际重开图](R8-association-confirmed-reopen.png)。

顶层行情变更未确认，所以仍显示待重新确认，不能因人工标签已确认就清掉另一个安全门槛。R8-association-pending.png在滚动过渡时右栏空白，不能作为提示可视证据；待确认入口证据为真实DOM及UI成功点击，最终画面为confirmed-reopen。此consumer限定通过，不证明真实重导来源链；独立合成源导入可行性另查。3052临时服务已停止。
