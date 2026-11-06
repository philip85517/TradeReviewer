# I16 已确认完整交易的财务数据链：实现记录

范围：数据层局部切片，依据 DESIGN-COVERAGE 的 I16 完整交易财务数据接线、`financial-production-wiring-proposal-20261029.md` 与用户明确说明：提供的模拟交易为完整交易，模拟不会拆单。这是现有受支持 TradingView 模拟报表的业务合同，不按文件名或摘要特判，也不增加人工确认步骤。其余来源不因该规则获得完整性结论。首次独立验收尚待安排，本记录不代表 UI、浏览器、视觉、完整统计或全项目验收。

## 行为和边界

- 真实来源经预检、保存、SQLite 重开和 v2 统计 route/client 后，在受支持来源、同一练习与当前 revision、原始来源及各组字段校验通过时，每个报表组的净额和费用只计一次；不是将报表编号当作原始委托。完整净额使用来源的已实现净额，费用独立展示，不再从净额重复扣除。收益率使用同一快照的有效本金，全局本金变化影响使用全局本金的练习，单练习覆盖不变。
- 缺组、无效字段、来源异常或精度无法安全求和继续明确未知；可证实的闭合组小计不等于完整练习净额。缺少权益轨迹时回撤仍未知，不虚构资金曲线、币种或时间。原始日期精度不能证明同日实际成交顺序，此切片不推断回放顺序。
- v2 新增 `practiceFees`。更新后的客户端接受旧 v2 的未知完整净额响应中缺此字段，并给出未知费用；已知完整结果须带可校验费用和一致收益率。旧客户端能否接受新的已知 v2 响应未验证，发布时须协调版本；v1 route 合同未更改。内存类型为兼容既有手工 fixture 允许可选费用，但本客户端读取后提供已知或未知结果。
- 身份及来源真实性依赖同事务快照和受信服务端；客户端核验响应一致性不能从 ID 字符串本身证明来源真实性。未改 UI、schema、业务库或原始 CSV。

## TDD 与验证

1. `TRADEREVIEW_DB_PATH=/tmp/i16-complete-unused.sqlite ./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/storage/practice-statistics-complete-trades.integration.test.ts --maxWorkers=1`：初次 RED，完整两组结果预期已知，实际为未知；同一测试的实现后 GREEN。后加旧 v2 未知响应缺 `practiceFees` 反例先 RED（`invalid-response`），兼容实现后 GREEN。
2. 补充部分组、伪造净额/费用/收益率拒绝；默认本金及单练习覆盖在全局修改前后、关闭重开均验证。既有专属测试此前有 5 项因旧未知假设或伪造响应不一致失败，已按新合同更新断言，保留原测试用途。
3. 最终命令（本测试每例在临时目录独立设置并清理 SQLite；环境路径不是业务库）：

```sh
I16_REAL_SOURCE_DIR='/Users/zhoulin/Documents/模拟交易复盘' TRADEREVIEW_DB_PATH=/tmp/i16-complete-unused.sqlite ./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/storage/practice-statistics-complete-trades.integration.test.ts app/lib/storage/practice-statistics-v2.integration.test.ts app/lib/storage/practice-statistics-financial.integration.test.ts app/lib/storage/practice-statistics-capital-integration.test.ts app/lib/storage/practice-statistics-http-client.test.ts app/lib/trades/practice-statistics-summary.test.ts app/lib/trades/tradingview-practice-financial-projection.test.ts --maxWorkers=1
```

结果：7 文件、81/81 PASS，21.08s；仅出现 Node `module.register` 弃用提示。六份授权 CSV 只读，经真实预检/保存/隔离 SQLite 重开/统计路由和客户端，六项练习净额、费用和默认本金收益率均匹配先前核算；回撤均未知。测试只输出汇总，不输出账户或交易明细。

4. `./scripts/native-node.sh node_modules/eslint/bin/eslint.js app/lib/storage/practice-statistics-financial.ts app/lib/storage/practice-statistics-v2-client.ts app/lib/trades/tradingview-practice-financial-projection.ts app/lib/storage/practice-statistics-complete-trades.integration.test.ts app/lib/storage/practice-statistics-v2.integration.test.ts app/lib/storage/practice-statistics-financial.integration.test.ts`：PASS。
5. `./scripts/native-node.sh node_modules/typescript/bin/tsc --noEmit`：本次 FAIL，报并行文件 `app/components/library/library-practice-detail.tsx:59,264,267` 的 `ready`/`partial` 类型不重叠；本切片不修改这些文件。此前添加兼容可选类型后一次全项目 typecheck 曾通过，最终冻结版本需排除并行问题后重新核验。

## 冻结 SHA-256

```text
29f0938ddfd15ea70b726784b91adffde4b0ab4d0160edfa911127242bcc29d1  app/lib/trades/tradingview-practice-financial-projection.ts
790b7015cdf81bd19d26a38344cb4a21733552ead59d65106fb2af6c5eb87158  app/lib/storage/practice-statistics-financial.ts
1fbef852ec39e618551f7d4c462da56ba8db2a88e65bfdea4bc39c6eb7cdb325  app/lib/storage/practice-statistics-v2-client.ts
ce6444a0aee4316ed496895aeea14092b6be4f64a18301ed280f0227e8bcddb1  app/lib/storage/practice-statistics-complete-trades.integration.test.ts
11a79c63f688b2b68eff67acf40c19cdf1c4ef27d7f1d71dbcc71e568209ca96  app/lib/storage/practice-statistics-v2.integration.test.ts
55bc0128f85dccb80e0e00dac62f55073301b292381d05d16dd2148168bce30f  app/lib/storage/practice-statistics-financial.integration.test.ts
d90746a1509754f5edd312c3252a1cd777062f95ea81cd0a84ada67cd2791fd0  app/api/storage/practices/statistics/route.ts（依赖）
9d8397cc1c521e2a0580d2c0babb928c96e38bddb787a14d917e49cead66d17c  app/lib/storage/practice-store.ts（依赖）
```

下一步须由未参与实现者验证上述冻结版本、六份来源与假设、异常/精度保护及 UI 与该合同衔接；真实网络、正式业务数据库、真实浏览器与同态视觉均 NOT VERIFIED。
