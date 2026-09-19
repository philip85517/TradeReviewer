# 交易库实现编排

用户已授权按九项编排开发，指定 gpt-5.6-luna / max 多实现 agent 与独立 Luna QA。

规格：../trade-library-ux-20260919/spec.md。最新对话确认优先。

- [01 统一交易库入口与浏览状态](issues/01-shared-browse.md)
- [02 高级筛选抽屉与来源平台筛选](issues/02-filter-drawer.md)
- [03 股票展开回合并进入复盘](issues/03-stock-rounds.md)
- [04 手动刷新汇率与持久化快照](issues/04-manual-fx.md)
- [05 展示准确的已平仓盈亏与加权收益率](issues/05-closed-metrics.md)
- [06 跨币种人民币绩效展示](issues/06-cny-metrics.md)
- [07 表头排序与模拟运行限制](issues/07-header-sorting.md)
- [08 交易库顶部与统计区重排](issues/08-summary-layout.md)
- [09 完整流程、性能与预览交付验收](issues/09-acceptance.md)

实施与验收状态见 [progress.md](progress.md)；独立 QA 的 [规格覆盖矩阵](reports/qa-final-spec-coverage.md) 用于逐项收口。原规格保留需求讨论时的历史状态，本目录记录用户后续授权开发的事实。

**最终状态：01–09已验收。** [交付验收与启动说明](reports/交付验收.md) · [性能测量](reports/performance-final.md) · 本地预览 http://127.0.0.1:3031/ 。没有提交、推送、合并或发布。
