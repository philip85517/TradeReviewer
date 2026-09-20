# 03 Luna 实现报告：新股、非新股与无法判定拆分

## 状态

已完成 03 的独立实现；未派发 agent、未提交、未推送、未合并，也未修改 `PatternInsights`、`OutcomeStructure`、`OutcomeDiagnostics`、04 文件或全局样式。

## 交付内容

- `InsightEpisodeFact` 增加 IPO 来源事实：`ipo`、`non-ipo`、`unknown` 三态、证据 ID/标签、无法判定原因和 IPO 成本链完整性。
- 分类严格校验同账户、同标准化证券、同市场的正数量 IPO 事件；复用 `isExecutionBackedIpoAllocation` 和 `resolveIpoAcquisitionCost`。
- 重复 IPO 证据按账户/市场/标准化证券/日期/数量/金额去重，避免重复计数。
- 普通成交且无初始持仓、历史缺口或库存冲突时归入非新股；初始持仓、历史缺口、非 IPO 库存事件、方向/事件歧义归入无法判定。
- 新股成本链不完整时保留在新股覆盖中，但排除出正式收益比较并显示原因。
- 新增 `buildIpoBreakdownReport`，为三组提供覆盖率、可比较样本、胜/负/平、总胜率、非持平胜率、平均/中位盈亏、赔率、收益桶、证据和回合 ID。
- 新增独立 `IpoBreakdown` UI，显示三组、统计口径、证据/原因详情、缺失值破折号和回合打开回调。

## 修改文件

- `app/lib/insights/episode-facts.ts`
- `app/lib/insights/episode-facts.test.ts`
- `app/lib/insights/ipo-breakdown.ts`
- `app/lib/insights/ipo-breakdown.test.ts`
- `app/components/insights/ipo-breakdown.tsx`
- `app/components/insights/ipo-breakdown.test.tsx`

## TDD 与验证

- 先运行缺失 `ipo-breakdown` 实现的测试，按预期失败。
- 定向 Vitest：`npx vitest run app/lib/insights/episode-facts.test.ts app/lib/insights/ipo-breakdown.test.ts app/components/insights/ipo-breakdown.test.tsx app/lib/insights/outcome-structure.test.ts app/components/insights/pattern-insights.test.tsx` — 5 files / 26 tests passed。
- TypeScript：`npm run typecheck` — passed。
- ESLint：`npx eslint app/lib/insights/episode-facts.ts app/lib/insights/episode-facts.test.ts app/lib/insights/ipo-breakdown.ts app/lib/insights/ipo-breakdown.test.ts app/components/insights/ipo-breakdown.tsx app/components/insights/ipo-breakdown.test.tsx` — passed with 0 errors。
- 差异检查：`git diff --check` — passed。
- 全量 `npm run test:unit` 已启动用于基线核对；在收尾前停止，已观察到范围外既有失败 `app/components/dashboard/room-holdings.test.tsx` 的 `shows holding status and opens the exact episode`。未将其归因于 03，未修改范围外文件。

## 未决问题

- 03 组件尚未接入 `PatternInsights` 页面；按任务边界由 05 统一整合。
- 未进行浏览器验收；由 05 使用隔离数据库和真实浏览器完成。
