# 01 — 收益结构基础：Luna 实现报告

## 当前状态

已完成 01 的用户可见切片。收益结构报告已接入现有 `PatternInsights` 页面；未修改原始交易、数据库 schema、外部 API 或父任务文件。未提交、未推送、未合并。

协调者指出的等值收益率直方图边界问题已修复：新增全相同收益率回归测试先失败（期望 1 个区间，实际 2 个），随后将等值数据直接生成单一有效区间；修复后通过。

## 修改文件

- `app/lib/insights/outcome-structure.ts`：新增可重建的费用后收益率报告 seam，生成核心指标、直方图分箱、结果桶和排除项。
- `app/lib/insights/outcome-structure.test.ts`：报告口径、缺失值、大小分类、直方图和证据 ID 测试。
- `app/lib/insights/insight-engine.ts`：在现有 `PatternInsightReport` 上挂载可选 `outcomeStructure`，不改变原模式洞察口径。
- `app/components/insights/outcome-structure.tsx`：收益结构 UI 区块、可读替代表格和回合打开入口。
- `app/components/insights/outcome-structure.module.css`：区块级样式、窄屏布局和图表替代信息样式。
- `app/components/insights/pattern-insights.tsx`：在现有模式洞察首屏接入收益结构区块。
- `app/components/insights/pattern-insights.test.tsx`：页面核心指标、替代表格、大小分类说明、未知值破折号和回调行为测试。

## 数据口径

- 只使用已有 `InsightEpisodeFact`；只把 `returnPercent !== null` 的已构建事实纳入正式收益结构统计。
- 主口径固定为费用后 `returnPercent`，不受现有 R 覆盖率选择影响。
- 收益率大于 0 为盈利，小于 0 为亏损，等于 0 为持平；总胜率含持平，非持平胜率只以盈利/亏损为分母。
- 提供平均/中位盈利、平均/中位亏损、赔率、利润因子、每笔期望收益、最大盈利和最大亏损。
- 盈利、亏损两侧分别按同侧绝对收益率中位数划分小/大；同侧少于 3 笔时不分桶并显示不可可靠分类。
- 直方图提供零收益线文本、可访问名称和可读替代表格；结果桶与直方图区间均保留 episode ID 并可通过现有 `onOpenEpisode` 回调打开回合。
- 缺失收益率进入收益结构报告自己的排除列表，显示为未知，不以 0 替代。

## 测试命令与结果

定向复验（最终执行）：

```text
npx vitest run app/lib/insights/outcome-structure.test.ts app/lib/insights/insight-engine.test.ts app/components/insights/pattern-insights.test.tsx
Test Files 3 passed
Tests 19 passed
```

类型检查（最终执行）：

```text
npm run typecheck
exit 0
```

`git diff --check`：通过。

本次边界修复后的最终定向复验（2026-09-20 16:21 Asia/Shanghai）：

```text
npx vitest run app/lib/insights/outcome-structure.test.ts app/lib/insights/insight-engine.test.ts app/components/insights/pattern-insights.test.tsx
Test Files 3 passed (3)
Tests 20 passed (20)

npm run typecheck
exit 0

npx eslint app/lib/insights/outcome-structure.ts app/lib/insights/outcome-structure.test.ts app/lib/insights/insight-engine.ts app/components/insights/outcome-structure.tsx app/components/insights/pattern-insights.tsx app/components/insights/pattern-insights.test.tsx
exit 0

git diff --check
exit 0
```

全量 `npm run test:unit` 已运行但未全绿（运行时间约 148 秒）：测试文件为 3 个失败、202 个通过、2 个跳过，共 207 个文件；测试为 7 个失败、1819 个通过、5 个跳过，共 1831 个测试。实际失败明细：

- `app/lib/fx/boc-parser.test.ts` 测试套件加载失败：缺少既有 `.scratch/trading-room-implementation/reports/boc-source.html` fixture。
- `app/components/trade-review-workspace.test.tsx` 5 个测试超时（每个 5000ms）：绘图草稿失败重试、稳定绘图队列、刷新所有交易回合、导入后市场刷新失败、缓存导入回合的统一回放工作区。
- `app/components/trade-review-workspace.test.tsx` 1 个测试找不到 `/^(展开|收起)小鹏汽车交易回合$/` 按钮。
- `app/components/dashboard/room-holdings.test.tsx` 1 个日期断言失败：期望 `当前持仓，截至 2026-09-19`，实际为 `当前持仓，截至 2026-09-20`。

以上失败均在本 ticket 允许范围外，未做修改。

## 未决问题

- 本报告只交付收益结构基础；尾部诊断、新股/非新股和市场分组留给后续 02/03/04 子任务。
- 本次未启动真实浏览器服务，因用户要求在定向测试、typecheck 和报告完成后停止；浏览器验收仍需由协调者在最终整合阶段执行。
- 全量测试的既有失败需要在整合阶段单独判断是否由当前环境基线变化引起。
