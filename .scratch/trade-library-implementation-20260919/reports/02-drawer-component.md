# Ticket 02 — 高级筛选抽屉组件

状态：组件切片实现完成，等待协调者接入统一交易库页面并独立浏览器验收。

## 交付范围

本切片只新增以下文件：

- `app/components/library/library-filter-drawer.tsx`
- `app/components/library/library-filter-drawer.module.css`
- `app/components/library/library-filter-drawer.test.tsx`
- `app/components/library/library-filter-options.ts`
- `app/components/library/library-filter-options.test.ts`

没有修改 `trade-library.tsx`、`review-queue.tsx`、`library-browse-state.ts`、`globals.css`、工作台或 FX 文件，也没有发起外部请求、市场行情请求或数据库写入。

## 接口与行为

`LibraryFilterDrawer` 采用“打开时挂载”的接口：

```ts
type LibraryFilterDrawerProps = {
  value: TradeLibraryBrowseState;
  entries: TradeLibraryEntry[];
  onApply: (patch: Partial<TradeLibraryBrowseState>) => void;
  onClose: () => void;
};
```

父组件在打开状态下挂载抽屉即可，不需要额外的 `open` prop。组件挂载时复制 `value` 作为本地 draft，来源平台、账户和同维度选项用 checkbox 表达 OR；年份、模拟运行、持仓状态、行情状态和标签使用 select。模拟运行只在模拟范围或存在兼容模拟运行时出现，运行名称使用标的名称/代码和稳定哈希短后缀，不展示完整 opaque ID。标签使用共享的可读名称，账户复用稳定同名账户后缀。

Apply 之前所有变更只在 draft 中；关闭按钮、取消和 Escape 直接丢弃 draft，Apply 一次性返回 `brokers`、`accounts`、兼容的单值 `account` 及其他高级字段，然后由父组件关闭。`useModalFocus` 提供初始焦点、Tab 陷阱、Escape 和焦点恢复。抽屉是固定右侧面板，宽度为 `min(420px, 100%)`，底部操作区在窄屏保持可达；CSS 使用现有深色主题变量。

选项模块公开 `buildLibraryFilterOptions`、`formatBrokerLabel`、`formatSimulationRunLabel` 和 `shortStableId`，供股票分组/汇总接入时复用。`shortStableId` 使用现有 `dashboardStableShortId`，因此两个原始 ID 即使共享相同结尾也保持稳定区分。

## TDD 与验证

实现前先运行目标测试，两个新模块均按预期因模块不存在而在解析阶段失败。实现并补充稳定运行后，最后一次目标测试为：

```bash
npx vitest run \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.test.tsx
# 2 files, 8 tests passed
```

覆盖 readable broker/tag/account/run labels、同名账户稳定后缀、相同维度 OR 数组、draft 在 Apply 前不提交、关闭丢弃、重开读取父状态、Escape/focus restore、模拟运行兼容显示和窄屏可达操作所需的组件状态边界。

```bash
npx eslint \
  app/components/library/library-filter-options.ts \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.tsx \
  app/components/library/library-filter-drawer.test.tsx
# exit 0
```

`npm run typecheck` 已验证本切片类型没有错误，但当前并行 UI 修改在共享文件留下一个仓库级错误：

```text
app/components/library/trade-library.tsx(889,11):
Type '(status: MarketDataSyncStatus) => ...' is not assignable to
type '(status: string | undefined) => string'
```

该共享文件不在本切片所有权内，未在这里修改。组件尚未单独启动浏览器预览；右侧抽屉的最终页面、真实窄屏布局和网络无请求验收由协调者在 UI 集成后完成。

没有 commit、push、merge，也没有接触真实交易数据库。

## 协调者要求的后续 P2 修复

在抽屉报告完成后，协调者要求顺手关闭 FX 审查发现的日历校验缺口，因此额外对 `app/lib/fx/contracts.ts` 的 `isIsoDate` 做了真实月份/闰年校验，并在 `app/lib/fx/provider.test.ts` 增加 `2026-02-31` 的 provider 拒绝测试。该补丁不改变抽屉接口或交易库范围；FX 后续审查仍由协调者负责。

补充验证：

```bash
npx vitest run \
  app/lib/fx/provider.test.ts \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.test.tsx
# 3 files, 14 tests passed

npx eslint \
  app/lib/fx/contracts.ts app/lib/fx/provider.test.ts \
  app/components/library/library-filter-options.ts \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.tsx \
  app/components/library/library-filter-drawer.test.tsx
# exit 0
```

## QA02 P2 来源别名修复

QA 发现原始 `source.platform` 可能同时出现 `TradingView`/`tradingview` 或 `CMB`/`china_merchants`，仅合并展示标签会让 canonical state 过滤漏掉原始别名。已在 `library-filter-options.ts` 增加并导出：

- `normalizeBrokerId(value)`：把已知别名映射到 `futu`、`tiger`、`china-merchants`、`tradingview`、`unknown` 等 canonical ID；未知平台也会以稳定的小写分隔形式保留。
- `normalizeBrokerIds(values)`：对持久化/草稿来源数组归一化并去重。

`buildLibraryFilterOptions` 现在先归一化每个 execution 的原始平台再建 option，因此每个 canonical 来源只有一个 checkbox。抽屉挂载时也归一化既有 `value.brokers`，Apply 始终发 canonical ID。UI owner 在筛选 entries/episodes 时必须对每个原始 `execution.source.platform` 调用同一 `normalizeBrokerId` 后再与 state `brokers` 比较；只使用展示 label 或只比较 raw string 都会重新引入漏筛。

新增测试覆盖：

```bash
npx vitest run \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.test.tsx
# 2 files, 10 tests passed

npx eslint \
  app/components/library/library-filter-options.ts \
  app/components/library/library-filter-options.test.ts \
  app/components/library/library-filter-drawer.tsx \
  app/components/library/library-filter-drawer.test.tsx
# exit 0
```

本次 `npm run typecheck` 仍被并行共享文件阻塞：`app/components/library/trade-library.tsx:1008` 使用了当前未导入的 `REVIEW_TAGS`，并产生两个关联的隐式 `any` 错误；options/drawer 文件没有新增类型错误。未修改共享 state、trade-library 或 review-queue 文件。
