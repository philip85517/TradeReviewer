# V2.5 首页统一交易库入口

2026-10-22 用户确认：首页取消独立待复盘入口，统一进入交易库；交易库承接复盘入口。

## 修订边界

- V2.5 第一章、第七章与入口参数附录统一为普通交易库导航，取消数量徽章与默认待复盘队列。
- 首页入口及返回分镜使用 `journeys-library-entry.svg`、`library-return.svg`；旧数量分镜保留文件，不再作为当前首页设计合同。
- 交易库 V1.0 同步来源、返回及验收说明。待复盘列表图仍表示库内显式筛选。
- 日期和标的入口、首页筛选维度、业务口径与已确认布局保留。冻结 V2.4.2 和历史评论不改。

## 验收

主代理独立检查源文、全部关联图稿引用、冻结内容哈希与真实浏览器预览。结果见 [验收记录](acceptance.md)。拆分原始通过记录保留于 [prior-split-verification.json](prior-split-verification.json)，不以本次结果覆盖原有证据。

[当前可评论 V2.5](../../baselines/2026-10-22-homepage-v2.5/visual-spec.html#chapter-HP06) · [交易库 V1.0](../../baselines/2026-10-22-trading-library-v1.0/visual-spec.html#chapter-BT06)

本次为设计文档修订，未改产品代码、未写业务数据库、未提交或推送 Git。
