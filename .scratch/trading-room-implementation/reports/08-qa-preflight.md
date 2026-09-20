# 08 数据质量模型与 details 独立预审

复查时间：2026-09-19。范围为 `app/lib/reviews/trading-room-quality.ts`、`room-data-quality.tsx`、`quality-details.tsx` 及其定向测试，对照 spec §6、§10、§12。只读审查，未修改产品代码，未运行全量测试；统一 dashboard/data-management 装配不纳入本次缺陷判断。

## 结论

**最终通过（独立 08 QA；集中 full/typecheck 仍由 root 收口）。** `supplement` 进入 `StockDataDialog` 属于合理的交易数据补录路径。`08-browser-source-diagnostic.txt` 显示 source 按钮进入的对话框同时给出日线、1H 状态、覆盖区间/缺口和“更新当前股票行情”动作；`08-browser-transaction-account-fixed.txt` 显示交易账户有 2 笔记录且补录/编辑可用；最新 daily retry 证据确认 1H 源状态不会再阻止日线重试。root 已反馈的历史持仓覆盖、`complete` 无 candle、unknown-only 总状态和 details 装配问题均已复核，不作为当前缺陷。

## 已确认的修复

- 历史 K 线现在把 `holdings.rows` 映射为合成行并与业绩行一起按 instrument 去重（`trading-room-quality.ts:403-413`），期前未平仓标的不会因没有 closed row 而从历史质量分母消失。
- 历史状态为 `complete` / `ready` 只有在对应 candle 数量大于 0 时才进入 available（`trading-room-quality.ts:425-433`）；空 candle 不再被误判为可用。
- 当前 overall status 对 unknown-only scope 会进入 `needs-check`（`trading-room-quality.ts:566-570`），不会把只有未知资产的范围标成可用于本期统计。
- 持仓行情源不支持时，`retryableInstrumentIds` 现在只从 action 为 `retry` 的 issue 生成（`trading-room-quality.ts:326-329`），不会把 `source-unsupported` 混入重试队列；该边界由当前定向回归覆盖。

## 已关闭：source-unsupported 明细路径可执行

此前代码审查发现 `quality-details.tsx` 对 `source-unsupported`、`open-data-management` 和 `supplement` 共用分支；单看 callback 名称会像是把行情源问题送进交易数据检查。新的真实证据 `08-browser-source-diagnostic.txt` 显示该路径打开 `StockDataDialog` 后，明确展示“当前行情状态：日线：行情源待连接；1H：行情源待连接”、覆盖区间与缺口，并提供“更新当前股票行情”。在当前没有单独 provider 管理 UI 的范围内，这已经是可执行的行情核对动作；`supplement` 仍保持交易数据补录语义。该项不再作为开放缺陷。

组件测试仍可补充“两个 callback 同时提供时 source 路径包含行情状态”的回归，但属于防回归建议，不阻断本条件通过结论。

## 已关闭：质量明细默认账户为空

早一轮集成证据曾显示交易问题打开 MSFT 时选中账户没有成交。当前 workspace 已用 `defaultAccountIdForInstrument()` 选择该标的第一个非空账户；`08-browser-transaction-account-fixed.txt` 复验为当前账户 2 笔，补录、编辑和行情更新均可用。多账户同标的仍应优先保留 issue 对应回合的账户，但本次固定样例的阻断已关闭。

## 已关闭：holdings 日线与 1H source 状态分离

此前 `buildHoldingsDimension` 会从合并标签判断 source unsupported；当前 workspace 已传入独立 `marketDataDailyStatuses`，模型优先使用 daily status，1H 状态只保留在详情展示。11/11 scope 定向回归覆盖 stale daily、daily source-unavailable、daily needs-provider 与 1H unsupported 的组合。`08-browser-daily-retry-fixed.txt` 显示 SPY 的过期行情动作是“重试持仓估值行情”，159919 的日线源不支持仍是“查看数据源”；`08-browser-daily-retry-result.txt` 显示点击 SPY 单条重试后持仓质量从 2/5 变为 3/5，SPY issue 消失。该 P2 已关闭。

## 模型契约复核：无 status 的 candle 不再被推断为完整

当前 `buildHistoricalDimension` 已删除 `inferredComplete` 路径；只有显式 `complete` / `ready` coverage status 且存在 candle 时才进入 available（当前源码约 `trading-room-quality.ts:425-433`）。没有 status 时，即使有一根或跨范围 candle，也会保留为需检查/可重试。`reports/08-scope.md` 记录的 23 个定向回归覆盖了无 status 单根、跨范围 candle、空 candle 和 provider unsupported。因此这不是当前开放缺陷，但应作为后续 coverage-aware 变更的回归保护。

## 定向测试覆盖缺口

已有模型测试覆盖费用未知不被行情掩盖、持仓分母、unsupported/stale history、旧汇率和空/CNY scope；当前 11/11 定向回归覆盖无 status 的历史 candle、holdings unsupported 不进入 retry 队列、complete 空 candle 及日线/1H holding action；source 按钮和单条 daily retry 也有真实浏览器证据。没有剩余的 08 QA 阻断项。
