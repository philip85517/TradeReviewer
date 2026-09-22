# 05 — 模式洞察整合与浏览器验收准备

## 当前状态

已完成 PatternInsights 的共享报告接线和集成测试；未派发 agent，未提交、未推送、未合并，未修改父任务、数据库 schema、交易计算、导入或外部 API。

真实浏览器验收尚未执行，按任务要求留给协调者亲自使用隔离 SQLite 和真实浏览器完成。因此本报告不声明浏览器路径已验收。

## 修改文件

- `app/lib/insights/insight-engine.ts`：扩展 `PatternInsightReport`，挂载收益结构、尾部诊断、新股来源拆分和市场拆分报告；所有报告继续从既有 `InsightEpisodeFact` 和上游排除项构建。
- `app/components/insights/pattern-insights.tsx`：在现有标签建议和正式/早期洞察之前渲染四个分析区块，并共享 `facts` 与 `onOpenEpisode`。
- `app/components/insights/pattern-insights.test.tsx`：补充 TDD 集成测试，验证四个区块、非因果说明、无法判定/未知市场可见性和统一回合跳转回调；扩展夹具支持 IPO/市场事实覆盖。

四个独立报告模块及其测试未修改。

## 已交付行为

- 共享 `buildPatternInsightReport` 现在同时产出四类报告：收益结构、尾部诊断、新股来源拆分和市场拆分。
- PatternInsights 页面顺序为总体收益结构、尾部结构诊断、新股/非新股来源拆分、分市场表现，然后继续原有待确认规则建议和模式洞察。
- 四个区块均复用既有 `onOpenEpisode(instrumentId, episodeId)` 回调。
- 页面保留“无法判定”、未知市场、小样本/排除信息和“不代表因果或交易建议”等说明。
- 既有标签建议、已确认标签洞察、类别筛选和原有 R/收益率口径行为未改动。

## TDD 记录

先新增 PatternInsights 整合测试并运行，初始失败：页面当时只能渲染收益结构，尾部诊断 region 不存在。随后只补共享报告挂载和四个组件接线，再逐步修正测试夹具，使未知市场样本真实落入未知组；最终通过。

## 验证结果

```text
npx vitest run app/components/insights/pattern-insights.test.tsx
Test Files 1 passed
Tests 9 passed

npx vitest run app/lib/insights/{episode-facts,insight-engine,outcome-structure,outcome-diagnostics,ipo-breakdown,market-breakdown}.test.ts app/components/insights/{pattern-insights,outcome-structure,outcome-diagnostics,ipo-breakdown,market-breakdown}.test.tsx
Test Files 10 passed
Tests 46 passed

npm run typecheck
exit 0

npx eslint app/lib/insights/insight-engine.ts app/lib/insights/episode-facts.ts app/lib/insights/outcome-structure.ts app/lib/insights/outcome-diagnostics.ts app/lib/insights/ipo-breakdown.ts app/lib/insights/market-breakdown.ts app/components/insights/pattern-insights.tsx app/components/insights/pattern-insights.test.tsx app/components/insights/outcome-structure.tsx app/components/insights/outcome-diagnostics.tsx app/components/insights/ipo-breakdown.tsx app/components/insights/market-breakdown.tsx
exit 0

git diff --check
exit 0
```

## 浏览器验收准备

建议由协调者在当前 worktree 启动隔离数据库预览：

```bash
TRADEREVIEW_DB_PATH="$PWD/.data/validation/tradereview.sqlite" npm run dev -- --hostname 127.0.0.1 --port 3001
```

建议路径：打开交易复盘工作区 → 模式洞察 → 检查总体收益结构、尾部诊断、新股/非新股/无法判定三组、市场分组；展开收益桶/诊断证据/市场回合并打开交易回合；切换实盘、模拟盘、模拟运行、日期和市场范围；分别用桌面和窄屏检查替代表格、折叠详情和无阻断性控制台错误。

浏览器验收还需记录：实际 worktree、端口、隔离数据库、桌面/窄屏宽度、前后原始交易数量与内容摘要、浏览器控制台结果和最终可点击预览 URL。

## 未决问题

- 本次未启动持续本地服务，也未使用真实浏览器；因此 ticket 05 的浏览器验收、原始 SQLite 前后核对和最终预览 URL仍待协调者完成。
- 当前工作区存在前置 tickets 的未提交实现，这是预期协作状态；本次未清理或重置其他改动。
