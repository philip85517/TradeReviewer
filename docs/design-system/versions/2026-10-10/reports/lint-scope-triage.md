> 归档副本（2026-10-10）。以下原结论保留原时间和范围；标注“本地历史记录”的文件未随远端归档。当前版本入口见 [版本说明](../README.md)。

# Final lint scope triage

审查对象：`.scratch/drawing-control-fix-20261009/reports/root-final-lint.log`，mtime `2026-10-10 01:12:40 +0800`，命令为 `eslint . --ignore-pattern dist --ignore-pattern .next`。

日志结尾为 `137 problems (27 errors, 110 warnings)`。这次 lint 把归档快照和证据目录也当作源码扫描；因此不能把 27 个 error 直接当成本轮 Canvas/toolbar/helper 改动引入的结果。下面的归因以日志中的路径、`.scratch/drawing-control-fix-20261009/baseline` 快照、`git show HEAD:<path>` 和当前 `git diff` 交叉核对。

## 结论

- 本轮改动没有新增 lint error。
- 27 个 error 中，13 个是当前 `app/` 源码已有的既存 error，并且对应文件均与 `HEAD` 字节一致、也不在本轮 dirty diff 中；同一组 13 个 error 又被 baseline 快照重复扫描一次。另有 1 个 error 来自更早的 `.scratch/review-design-system-20261006` 证据副本。因此 27 = 13（当前既存）+ 13（同内容 baseline 副本）+ 1（旧证据副本）。
- 本轮 Canvas 改动新增的是 5 个 warning，全部位于 `app/components/chart/drawing-canvas.tsx`；它们应作为本轮后续 lint 修复候选。Canvas 测试中的 9 个 `stage` warning 在 baseline 日志中已经存在，属于 dirty 基线债务；toolbar、label helper、workspace 两个目标测试没有 lint 诊断。
- 本报告没有运行测试或 lint；只读比较之外，按 root 后续授权对 workspace 测试 fixture 的四个 `this` 参数加了 `HTMLElement` 注解，`npx tsc --noEmit --pretty false` 已通过。该注解发生在 lint 日志生成之后，不改变上述 lint 归因。

## 27 个 error 的精确归因

下表列出唯一源码位置。带“重复”表示同一位置在 ESLint 输出中出现两次（一次来自 baseline，一次来自当前 `app/`），不是两个独立问题。

| 位置 | 规则/诊断 | 归因 | 依据与建议 |
|---|---|---|---|
| `.scratch/drawing-control-fix-20261009/baseline/app/components/dashboard/review-dashboard.tsx:567:5`；`app/components/dashboard/review-dashboard.tsx:567:5` | `react-hooks/set-state-in-effect`，`setBrowsePreferencesWritable` | dirty 基线既有；重复 | 当前文件、baseline 文件与 `git show HEAD` SHA-256 均为 `c87940a65ca3…`，且该文件不在 `git diff --name-only`。若要修，应另开既存 lint debt 修复，不归入本轮绘图改动。 |
| `.scratch/.../baseline/app/components/data-management/account-principal-provisional-panel.tsx:98:27`；`app/components/data-management/account-principal-provisional-panel.tsx:98:27` | `react-hooks/refs`，render 中读 `clientRef.current`（日志重复） | dirty 基线既有；重复 | 三份文件 SHA-256 前缀均为 `cd7a6859b3c7…`，当前文件无 dirty diff。 |
| `.scratch/.../baseline/app/components/data-management/account-principal-provisional-panel.tsx:112:5`；`app/components/data-management/account-principal-provisional-panel.tsx:112:5` | `react-hooks/set-state-in-effect`，`setLoading(true)` | dirty 基线既有；重复 | 同上。 |
| `.scratch/.../baseline/app/components/data-management/cash-baseline-panel.tsx:174:8,175:32`；当前同两行 | `react-hooks/refs`，render 中读两个 ref（各重复） | dirty 基线既有；重复 | baseline、HEAD、当前 SHA-256 前缀均为 `d43b8aff2f44…`，文件未修改。 |
| `.scratch/.../baseline/app/components/data-management/tradingview-account-migration-panel.tsx:424:27,674:102,677:24,707:49`；当前同四行 | `react-hooks/refs`，render 中读 migration/commit/rollback refs；424 与 674 各重复 | dirty 基线既有；重复 | baseline、HEAD、当前 SHA-256 前缀均为 `87b144d15f17…`，文件未修改。 |
| `.scratch/.../baseline/app/components/trade-review-workspace.tsx:1990:5`；`app/components/trade-review-workspace.tsx:1990:5` | `react-hooks/set-state-in-effect`，`setCashSavedFact` | dirty 基线既有；重复 | baseline、HEAD、当前 SHA-256 前缀均为 `608f67cf2928…`，文件未修改。 |
| `.scratch/review-design-system-20261006/revisions/2026-10-07-panel-controls/evidence/source-third-freeze/app/components/recall/recall-workspace.test.tsx:290:9` | `prefer-const`，`more` 未重新赋值 | 旧证据副本；与本轮无关 | 路径不在当前 `app/`，且位于另一任务的 revision/evidence 目录。不要修改证据副本；若该证据需 lint，应在其生成源修复或从 lint scope 排除。 |

因此，当前 `app/` 中的 13 个 error 是既存问题，不是本轮 Canvas/toolbar/helper/test dirty diff 引入；baseline 目录只是把同一源码再报了一遍。日志里 account principal 的 98 行、migration 的 424/674 行重复计数解释了 13 个 error 而不是 10 个唯一位置。

## 本轮 Canvas/toolbar/helper/test 重点

### 应修复候选：Canvas 生产文件新增 5 个 warning

这些位置在同一 lint 日志的 `baseline/app/components/chart/drawing-canvas.tsx` 中没有对应 warning，且当前源文件相对 baseline 已改变（baseline SHA-256 `4d8d2bc3ebba…`，当前 `f4b36f6e5420…`）：

| 当前行 | 诊断 | 原因与最小处理方向 |
|---|---|---|
| `app/components/chart/drawing-canvas.tsx:741:21` | `fontSize` defined but never used | `measure: (text, fontSize) => canvasTextMeasure(context, text)` 忽略 helper 的字号参数。应决定 `canvasTextMeasure` 是否需要使用字号；若不需要，删除参数名或显式 `_fontSize`（以项目 lint 约定为准）。 |
| `app/components/chart/drawing-canvas.tsx:804:10` | `riskRewardLabelLines` defined but never used | 当前绘制路径已改为直接构造风险/收益 label，但旧 helper 仍在文件中。应删除真正不再使用的 helper，或恢复单一调用路径；不要仅屏蔽 lint。 |
| `app/components/chart/drawing-canvas.tsx:1146:12` | `clearTextCreationDraft` defined but never used | 当前函数没有调用点；应接入取消/完成流程，或删除死代码。需保持文本创建状态机语义后再改。 |
| `app/components/chart/drawing-canvas.tsx:1727:6` | `useEffect` missing `cancelGesture` dependency | Escape key effect 调用了 `cancelGesture`，依赖数组只有 `[editor, onSelectDrawing, pickingAnchor]`。应按稳定 callback 方案补依赖或调整函数边界，避免闭包陈旧。 |
| `app/components/chart/drawing-canvas.tsx:2225:6` | `useEffect` missing `cancelGesture` dependency | active-tool effect 同样调用 `cancelGesture`，当前依赖只有 `[activeTool, editor]`。按同一 callback/依赖策略修复。 |

### 已有 dirty 基线 warning：不归因于本轮新增

- `app/components/chart/drawing-canvas.recall-review.test.tsx` 当前 `413, 855, 971, 1008, 1040, 1074, 1106, 1135` 的 `stage` 未使用 warning，在 baseline 中已对应报告 `327, 682, 798, 835, 867, 900, 931, 960`；文件虽有本轮扩展，warning 数量和语义为既存基线债务。
- `app/components/chart/drawing-canvas.test.tsx:421:13` 的 `stage` 未使用 warning，在 baseline 已是 `402:13`；不要把行号漂移误判为新增 lint 问题。
- `app/components/chart/drawing-toolbar.tsx`、`app/components/chart/drawing-toolbar.test.tsx`、`app/lib/chart/drawing-label-layout.ts`、`app/lib/chart/drawing-label-layout.test.ts`、Canvas 新增 creation/labels/selection 测试均没有 lint 诊断。
- `app/components/trade-review-workspace.test.tsx` 和 `trade-review-workspace.refresh.test.tsx` 没有 lint 诊断。后续 root 授权补的 fixture 类型注解位于 `trade-review-workspace.test.tsx:2820,2823,2922,2925`，仅解决 typecheck 的 implicit-`this`，不属于该 lint 日志中的 27 errors。

## 其余日志项的范围判断

当前 `app/` 其余 warnings（dashboard、review workspace、cash/storage、recall 等）均在 baseline 同路径已有；baseline 与当前路径还分别产生了同一批 warnings。`.scratch/drawing-selection-20261008/evidence/**`、`.scratch/review-design-system-20261006/**`、`.scratch/trading-room-implementation/qa/**` 和 `.scratch/control-visual-fix-20260927/**` 属于历史证据/QA 目录，不应作为本轮产品 lint gate。它们包含 1 个历史 `prefer-const` error 和若干 unused/dependency warnings，但没有当前工作树产品文件依据。

## 最小后续验证建议（未执行）

1. 先修上表 Canvas 生产文件 5 个 warning，并保持 Canvas/toolbar/helper 的功能断言不变。
2. 用当前源路径而不是整个 `.` 重新 lint，至少覆盖 `app/components/chart/drawing-canvas.tsx`、toolbar、label helper、相关测试；或在 lint 配置中明确排除 `.scratch/**`、`.next`、`dist`。不要用 `--fix` 修改 baseline/证据副本。
3. 既存 13 个 app error 单独开 lint debt 修复；它们与本轮 drawing-control 工作无因果证据。

本报告只读诊断部分未运行测试或 lint。附加 typecheck 修正后，`npx tsc --noEmit --pretty false` 退出码为 0，`git diff --check -- app/components/trade-review-workspace.test.tsx` 通过。
