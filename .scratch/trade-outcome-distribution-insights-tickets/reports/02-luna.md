# 02 — 尾部结构诊断与证据跳转：实现报告

## 当前状态

已完成本 ticket 的独立实现，未提交、未推送、未合并，也未修改 `PatternInsights`、`OutcomeStructure`、父规格、03/04 文件或全局样式。

## 交付内容

- 新增 `buildOutcomeDiagnosticsReport` 纯报告 seam，消费已接受的 `OutcomeStructureReport` 和 `InsightEpisodeFact[]`。
- 计算亏损广度、盈利广度、最差/最佳 20% 尾部集中度、同侧中位绝对收益率和最大绝对收益率。
- 仅在同侧至少 5 个样本时生成正式诊断；规则覆盖“少数大亏拉动”“亏损较普遍”“少数大赚拉动”“多笔小赚”。
- 最差/最佳尾部按同侧绝对收益率降序取 `ceil(20%)`，并保留可审计的阈值和方法标识。
- 每条正式诊断保留样本 episode IDs、尾部证据、反例、时间范围、收益率口径和计算版本。
- 新增独立 `OutcomeDiagnostics` UI 子组件：显示两侧描述统计、样本不足状态、诊断解释、阈值、时间范围、版本、证据/反例折叠列表，并通过 `onOpenEpisode` 打开回合。
- 缺少收益率或无法计算的统计值显示为 `—`，不会填充为 0。

## TDD 记录

先新增测试并运行：

```text
npx vitest run app/lib/insights/outcome-diagnostics.test.ts app/components/insights/outcome-diagnostics.test.tsx
```

结果为 2 个测试 suite 导入失败，原因是两个目标生产模块尚不存在；随后实现生产代码并逐步修正真实行为断言。

最终定向测试：

```text
npx vitest run app/lib/insights/outcome-diagnostics.test.ts app/components/insights/outcome-diagnostics.test.tsx
Test Files 2 passed (2)
Tests 5 passed (5)
```

覆盖内容包括：

- 广度与尾部集中度的精确计算。
- 20% 尾部取整、异常大亏/大赚和四类中性诊断。
- 同侧少于 5 个样本时不生成正式诊断。
- 诊断的样本、证据、反例、阈值、时间范围和计算版本。
- UI 审计信息、样本不足、未知值和证据/反例回合跳转回调。

## 验证命令

```text
npx eslint app/lib/insights/outcome-diagnostics.ts app/lib/insights/outcome-diagnostics.test.ts app/components/insights/outcome-diagnostics.tsx app/components/insights/outcome-diagnostics.test.tsx
exit 0

git diff --check -- app/lib/insights/outcome-diagnostics.ts app/lib/insights/outcome-diagnostics.test.ts app/components/insights/outcome-diagnostics.tsx app/components/insights/outcome-diagnostics.test.tsx
exit 0
```

全局类型检查：

```text
npm run typecheck
exit 2
app/components/insights/ipo-breakdown.test.tsx(7,30): error TS2307: Cannot find module './ipo-breakdown' or its corresponding type declarations.
```

该错误来自并行 ticket 03 的独占文件范围，当前工作区尚未出现其 `ipo-breakdown` 生产模块；本 ticket 文件没有类型错误输出，也未越界修复 03。

## 修改文件

- `app/lib/insights/outcome-diagnostics.ts`
- `app/lib/insights/outcome-diagnostics.test.ts`
- `app/components/insights/outcome-diagnostics.tsx`
- `app/components/insights/outcome-diagnostics.test.tsx`
- 本报告文件

## 未决问题

- 本组件尚未接入共享 `PatternInsights` 页面；按任务边界留给 05 整合。
- 全局 typecheck 需等待 03 补齐其生产模块后重新运行。
- 未启动浏览器预览；最终页面整合和浏览器验收由 05 负责。
