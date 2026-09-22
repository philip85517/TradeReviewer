# 行情源可用性与优先级验证

本目录记录当前任务的验证范围、证据和完成状态。原始探测结果保存在仓库根目录的 [`source-probe-results.json`](../source-probe-results.json)，最终报告为 [`docs/adr/0003-market-source-validation-and-priority.md`](../../docs/adr/0003-market-source-validation-and-priority.md)。

任务卡：[01-provider-validation.md](issues/01-provider-validation.md) · [02-fixed-provider-policy.md](issues/02-fixed-provider-policy.md)

## 验收清单

- [x] 按美股、港股、A 股沪深及股票/ETF 拆分样本
- [x] 直接探测 Tencent、Eastmoney、Baidu、Sina US、BaoStock、Tiger、Yahoo 的 1D/1H
- [x] 记录返回条数、时间范围、错误类型和相对耗时
- [x] 核对 raw/adjusted 代码证据
- [x] 核对 1H 时间标签和样本价格一致性
- [x] 给出按市场/资产/周期分层的优先级与兜底规则
- [ ] 配置 Tiger 后进行真实账号 canary
- [ ] 扩展全量标的和 15m 矩阵

## Status

`complete-with-external-follow-ups`
