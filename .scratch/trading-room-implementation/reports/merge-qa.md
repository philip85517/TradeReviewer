# Merge QA

审查基线：feature `1f3b8a8` 与 master `dd59a89` 的当前合并工作树。审查范围为交易室默认范围、趋势/日历状态、数据管理入口、交易库默认股票视图/展开状态、复盘返回上下文及两套汇率路由。未修改产品代码，未执行全量测试。

## Findings

### ~~P1 — 从交易室入口进入复盘后，返回动作丢失交易室上下文~~ — 已解决（协调者浏览器复验通过）

此前，从交易室的业绩行或当前持仓点击“打开复盘”时，工作区只切换到 `review`，没有记录来源页面；复盘侧栏的返回动作也总是切到交易库。当前工作树已在 `app/components/trade-review-workspace.tsx` 增加 `reviewReturnView`，交易室入口记录 `dashboard`、交易库入口记录 `library`，并由 `returnFromReview` 分别恢复交易室或交易库；`StockEpisodeNavigation` 也按来源显示“返回交易室”或“返回交易库”。交易库路径仍清空库内选中项而保留筛选/展开状态，交易室路径保留 dashboard 的筛选、期间、趋势/日历状态。该修复满足交易室规格“从复盘返回保留离开前的合法筛选与展示状态”及 S12 的“从持仓行进入复盘，返回交易室保留筛选、期间及趋势/日历状态”（`docs/specs/2026-09-19-trading-room-homepage.md:28,61`；`.scratch/trading-room-implementation/reports/qa-plan.md:22`）。协调者已完成真实浏览器双路径复验，Luna 新增定向测试通过，问题关闭。

## Review result

未在上述范围发现其他由本次合并造成的具体行为缺陷。交易库默认 `stocks`、筛选/展开状态由 `libraryBrowseState` 保留；首页 BOC `/api/trading-room/fx` 与交易库 ECB `/api/fx` 路由在当前合并中保持分离。

## 协调者浏览器复验

使用 3030 隔离数据库预览，持仓来源进入甘李药业回合后显示“返回交易室”，返回后今年至今、日历和交易室均保留；交易库来源进入相同回合后显示“返回交易库”，返回后股票展开状态保留。两个路径均在真实浏览器通过，console error 为空。证据为本目录忽略的 `merge-return-room-fixed.txt` 与 `merge-return-library-fixed.txt`。
