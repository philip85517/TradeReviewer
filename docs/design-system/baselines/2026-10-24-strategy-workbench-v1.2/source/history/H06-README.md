# 0.7 · 2026-10-10 当前视觉检查点（含滚动修复）

这是当前视觉的本地归档入口，基于分支 `codex/strategy-visual-system-20261008`、基线 `9c2b3d2`。它冻结用户已确认的完整观察画面和本轮滚动修复证据，供开发态复现与后续比较使用。

2026-10-10 归档提交 [573e58b](https://github.com/philip85517/TradeReviewer/commit/573e58b253c54d7050a192068ff44c7f95a4d2ef) 已推送任务分支，`ls-remote` 确认与该次本地 HEAD 相同，见[远端回执](remote-receipt.json)。本回执随后另作纯文档提交；视觉源码哈希不变。

推荐入口：[打开完整观察](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=complete)。这是当前源码的可复现开发态预览；若服务未运行，按下方命令启动后再打开。

同一开发态还保留完整范围入口：[结果](http://127.0.0.1:3069/?prototype=strategy-workbench&view=results&scene=complete)、[比较](http://127.0.0.1:3069/?prototype=strategy-workbench&view=compare&scene=complete)、[T0 起点](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=T0)、[运行中](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=running)；原生个股复盘的设计依据为[图表优先复盘元素规范](../../../../specs/2026-09-25-chart-first-review-ui-elements.md)。这些入口可列出完整范围，但本检查点的当前视觉冻结对象仍是完整观察画面。

## 当前画面

固定状态为完整场景、EMA20、2024-09-13、净值观察、三个月双策略合成数据。以下四图沿用 2026-10-10 滚动修复接受时的同状态浏览器证据，按原字节归档；不是本轮重新截图：

- [1440×900 顶部观察](screenshots/observe-1440.jpg)
- [1280×720 顶部观察](screenshots/observe-1280.jpg)
- [390×844 顶部观察](screenshots/observe-390.jpg)
- [1280×720 底部观察（滚动后）](screenshots/observe-bottom-1280.jpg)

本轮另在真实浏览器新鲜确认了 1280×720 / DPR2 完整观察，见 [当前运行截图](screenshots/live-preview.jpg)与[运行测量](live-preview.json)。

截图来自本版本归档目录；原始参考和完整滚动记录仍在 [`observe-scroll-20261010.md`](../../observe-scroll-20261010.md) 及其[证据目录](../../../../../.scratch/strategy-visual-system-20261008/evidence/observe-scroll-20261010/)中。归档截图不替代真实运行预览。

## 覆盖与结论

本检查点覆盖 A01–A03：本地视觉冻结、文档索引和分支提交范围。主工作台完整观察的视觉、响应式布局、页边滚动与相关菜单/抽屉滚动已按本轮记录验收；结果/比较保留其既有内部滚动边界。用户确认的是完整观察画面与当前样板体验。

生产公共组件固化、整体 01、全量未来信息/Tooltip 审计、生产 SQL 写入链、物理或模拟触摸、Windows/逐字字体、软键盘、全量 hover/active，以及启动包专项符合性仍为 `NOT VERIFIED` 或保留在原记录中的范围。A 与原生复盘的登记例外继续存在，不因本页重开整体审美验收；本页不把用户视觉认可写成生产完成。

历史和依据按以下路径保留：

- [当前总体规范](../../README.md)
- [0.7 共用视觉候选规则](../../homepage-style-reuse.md)
- [0.7 严格回归与历史 FAIL](../../observe-regression-20261009.md)
- [滚动修复与回归接受](../../observe-scroll-20261010.md)
- [完整 Workbench 恢复与范围边界](../../full-workbench-preview.md)
- [诊断](../../diagnosis.md)
- [接受记录](../../acceptance.md)
- [0.6 实际接受（历史）](../../homepage-style-acceptance.md)
- [完整恢复契约（原始范围）](../../../../../.scratch/strategy-visual-system-20261008/full-restore-contract.md)
- [任务票与 A01–A03 覆盖矩阵](../../../../../.scratch/strategy-visual-system-20261008/issues/06-visual-checkpoint-and-remote.md) · [DESIGN-COVERAGE](../../../../../.scratch/strategy-visual-system-20261008/DESIGN-COVERAGE.md)

## 归档文件

- [manifest.json](manifest.json)：截图、源码/证据指纹和归档清单，由协调者生成。
- [verification.md](verification.md)：当前检查命令、浏览器确认、服务和未验边界，由协调者生成。
- [remote-receipt.json](remote-receipt.json)：归档提交的实际推送与远端 SHA 回执。
- `screenshots/`：四张原始接受图与一张本轮真实运行图。

[远端归档排除清单](remote-exclusions.json)记录仅本地保留的原始证据。旧业务复盘页诊断基线包含公共行情和空计划；其中隐藏业务目录的原始测量不随分支上传。首页参考测量中的实际账户筛选、证券目录及包含真实持仓估值/成本/盈亏的参考截图也保留本地、不上传。历史 manifest 保留原值；它们代表各次接受时点，不代表所有当前源码或后续修改的文档，也不代表远端包含这些有意排除的原件。

原始证据的哈希不得被版本页改写；若后续回归，保留原记录并同步功能 README、覆盖矩阵和最终接受记录。

## 复现

在任意已检出本分支的工作树中运行，使用隔离数据库：

```sh
npm install
TRADEREVIEW_DB_PATH="$PWD/.data/strategy-visual-acceptance.sqlite" npm run dev -- --port 3069 --hostname 127.0.0.1
```

然后打开上方 URL。这里的 `$PWD` 是当前工作树，便于迁移；不要把某个绝对 worktree 路径当成唯一启动方式。该样板为开发态合成预览，不能借启动成功推断生产持久化已验。
