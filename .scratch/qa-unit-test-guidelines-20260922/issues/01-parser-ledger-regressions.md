# 01 - 解析器与回放回归

What to build: 用独立的成交余额样例覆盖招商证券 PDF 的期初/期末持仓重建，并把解析结果送入交易回合构建。

Blocked by: None

Status: complete

Acceptance:

- [x] 正常 fixture 不再把缺失证券余额默认为 0。
- [x] 覆盖买入、卖出、首行卖出、显式 0 和缺失余额。
- [x] A 股回放不会把余额矛盾解释为空头。
- [x] 解析器测试和回放测试均能对旧错误形成红灯信号。

Verification: `npx vitest run app/lib/import/china-merchants.test.ts` — 15/15 passed.
