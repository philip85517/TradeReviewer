# 高级筛选抽屉选项复用

日期：2026-09-19

## 根因

交易库主页面已经以 `entries` 为依赖 memoized `advancedOptions`，但打开 `LibraryFilterDrawer` 时，抽屉又执行一次 `buildLibraryFilterOptions(entries)`。该函数会遍历所有 entry 的成交、回合成交、账户、来源、年份、模拟运行和标签；5000 回合数据下这次 mount 工作会延迟 DOM commit。

## 调整

- `LibraryFilterDrawer` 新增可选 `options?: LibraryFilterOptions`。传入时直接使用父级同一 scope 的 memoized options；未传入时仍按 `entries` 独立构建，保留组件单测和独立调用的 fallback。
- `TradeLibrary` 把已有 `advancedOptions` 传给抽屉，因此主页面打开抽屉不会再次扫描 5000 回合。
- fallback 仍以 `entries` 为依赖；传入的 options 也随 parent options identity 更新，不会保留旧来源/账户/年份/运行选项。

## 验证

```text
npx vitest run \
  app/components/library/library-filter-drawer.test.tsx \
  app/components/library/trade-library.test.tsx \
  --reporter=dot --maxWorkers=1
2 files, 36 tests passed

npx eslint \
  app/components/library/library-filter-drawer.tsx \
  app/components/library/library-filter-drawer.test.tsx \
  app/components/library/trade-library.tsx
exit 0

git diff --check -- app/components/library/library-filter-drawer.tsx \
  app/components/library/library-filter-drawer.test.tsx \
  app/components/library/trade-library.tsx
exit 0
```

新增测试覆盖 parent options 的更新、entries 变化后的 fallback 更新，以及不显示旧来源选项。未修改金融逻辑或全局样式；5000 回合 DOM commit 双计时由协调者复测。
