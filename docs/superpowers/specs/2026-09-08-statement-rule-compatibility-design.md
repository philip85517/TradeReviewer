# 月结单规则兼容性设计

## 目标

让月结单导入具备可演进的规则 seam：券商适配器、账单模板、市场身份和时间策略可以独立增加或修订，同时保持现有股票流水、费用、时区证据和复盘结果兼容。

## 约束

- 不改变现有 `StatementParseResult`、`TradeExecution` 和 SQLite 导入语义。
- 不依赖文件名判断券商或月份。
- 已识别但未验证的新结构不得复用旧模板静默解析。
- 原始字段、来源页/行、模板 ID、规则 ID、时区候选和置信度必须可追溯。
- 规则以类型化 profile 和注册表组织；解析算法仍保留在适配器内部。
- 不引入新的运行时依赖。

## 设计

### 规则注册表

`statement-rules.ts` 提供小接口：

```ts
type StatementRuleRegistry = {
  xlsx: readonly StatementAdapter[];
  pdf: readonly StatementAdapter[];
  confidenceThreshold: number;
};
```

dispatcher 只负责读取文件、抽取 PDF 页面、运行注册表中的检测器、处理零命中/多命中和转发解析；它不再内嵌券商列表和分支链。

### 模板 profile

富途模板的表头、章节锚点、字段别名、模板优先级和 unsupported 状态集中在 `futu-template-profile.ts`。profile 只描述格式证据，不负责读取 PDF；解析器继续负责坐标、跨行和守恒校验。

### 时间策略

`futu-time-policy.ts` 只消费市场时区、会话窗口、有效期和规则 ID。推断结果同时保留最终选择、候选时区、置信度和理由。当前美股/港股规则先保持行为一致，后续可以按 venue 和历史有效期扩展，不把常数散落在解析循环中。

### 兼容性降级

检测器只在结构证据足够时命中。命中券商但没有匹配已验证模板时，返回 `unsupported-statement-template` 并保留诊断，不进入旧模板解析。这样兼容性优先表现为可审计的复核，而不是错误的成功导入。

## 验收

- 现有富途、老虎、招商和富途 XLSX 测试全部保持通过。
- dispatcher 的检测结果与现有 broker 结果一致。
- 已知富途 F0/F1/F2/F3/F4 输出不变；F4a 仍阻断。
- 时间推断输出增加规则 ID/候选证据，但最终时区、UTC 和置信度保持兼容。
- 未知富途表头或新模板不会回退为 F1/F5 的正常解析。
- 类型检查、lint、build 和运行时测试通过。

## 实施结果（2026-09-08）

- 已建立 `statement-adapters.ts` 注册 seam；dispatcher 不再按券商写分支。
- 已建立富途 PDF 模板 profile、富途 XLSX workbook profile 和版本化时间 policy。
- 已知模板继续沿用原有解析结果；未知交易表头和未知 XLSX 字段会阻断并保留诊断。
- 成交来源新增可选 `formatRuleId`、`timeRuleId` 和 `timeCandidates`，不破坏旧记录读取。
- `npm run test:unit -- --maxWorkers=2`：117 个测试文件通过、1 个原件测试跳过；1096 项通过、1 项跳过。
- `npm test`：构建通过，运行时测试 4/4 通过；`npm run typecheck` 和 `git diff --check` 通过。
- `npm run lint`：0 个错误；保留既有 `app/lib/storage/storage-boundary.test.tsx:36` 警告。

仍有意保留的边界：PDF 内部的坐标解析、费用标签和股票身份正则仍属于券商适配器实现；新增的、未进入 profile 的语义字段不会被猜测导入。下一步若出现真实新模板，应先增加脱敏 fixture/profile，再放行解析。
