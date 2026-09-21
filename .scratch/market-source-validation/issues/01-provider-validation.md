# 行情源可用性与优先级验证

## What to build

对 Tencent、Tiger、Baidu、Eastmoney、Yahoo、Sina US、BaoStock 的 `1D`/`1H` 适配器进行只读代表性探测，按美股、港股、A 股沪深及股票/ETF 记录可用性、覆盖条数、相对耗时、复权口径和时间标签差异，并形成后续数据源重构的优先级与兜底规则。

## Blocked by

无。Tiger 真实账号 canary 是后续外部依赖，不阻塞本次报告。

## Status

complete-with-external-follow-ups

## Acceptance

- [x] 8 个代表性股票/ETF 样本覆盖四类市场板块
- [x] 7 个 provider 分别探测日线和 1H，共 112 次
- [x] 保存原始 JSON 结果和可复现脚本
- [x] 核对 raw/adjusted 代码证据与样本价格
- [x] 核对 1H bar timestamp 差异
- [x] 形成分市场、资产类型和周期的优先级矩阵
- [x] 形成 no-data、限流、超时、解析错误和 partial coverage 的兜底规则
- [ ] Tiger 配置后补做真实账户 canary
- [ ] 扩展全量 instruments 和 15m 矩阵

## Verification

```bash
NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem node --import tsx .scratch/source-probe-run.ts
node_modules/.bin/vitest run app/lib/market/providers/providers.test.ts app/lib/market/providers/baostock.test.ts app/lib/market/providers/tiger.test.ts app/api/market-data/daily/route.test.ts app/api/market-data/intraday/route.test.ts app/lib/market/market-data-fetch.test.ts app/lib/market/refresh-queue.test.ts --reporter=dot
```

结果：探测 JSON 有效；相关测试 `7 files / 109 tests passed`。
