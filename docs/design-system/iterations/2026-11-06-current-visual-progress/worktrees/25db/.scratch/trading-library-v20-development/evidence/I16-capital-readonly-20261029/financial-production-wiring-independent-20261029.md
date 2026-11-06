# I16 财务数据层独立验收（2026-10-29）

验收者未参与该财务数据层实现；范围是冻结版受支持 TradingView 模拟报表的导入、隔离 SQLite、进程内统计 route 与 V2 客户端及纯财务计算。不访问或更改业务数据库、不修改产品代码；只读六份此前授权的模拟来源。局部结论 **PASS**，未发现本范围内已复现的数值缺陷；不能据此判定 I16 页面或整个产品通过。

## 依据与判断

- 当前批准原文 `docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md:176–200,202–206`：模拟样本按练习，费用只计一次，已含费净额不重复扣；本金无效时净额可显示而收益率未知；缺权益轨迹不能造出回撤。
- `.scratch/trading-library-v20-development/USER-DECISIONS-2026-10-27.md:5,14–20`：默认 100000 CNY；无单练习覆盖随全局变更而重算，单练习覆盖保留；用户明确受支持模拟报表完整、不拆单，重复显示的组费用和净额各计一次，损坏组不获得完整性结论；日期不能编造时刻。
- `app/lib/storage/practice-store.ts:166–208` 同一事务读来源、修订及有效本金，重验原始字节和当前关联；`app/lib/storage/practice-statistics-financial.ts:35–79` 验证组后按来源完整性决定结果；`app/lib/trades/tradingview-practice-financial-projection.ts:285–295,297–319,337–427` 每个有效组只取一个净额和费用，费用/净额矛盾、重复、缺失和异常不作已知完整额；`app/lib/trades/practice-metrics.ts:155–183` 含费净额不再减费，本金非正排除收益率；`app/lib/storage/practice-statistics-v2-client.ts:63–69,119–141` 对聚合/费用/收益率一致性复核并限定旧未知响应缺字段兼容。客户端一致性校验不等于独立证明来源身份。

## 运行及结果

1. **PASS**：作者冻结 SHA 的 8 文件及另外 7 个重要依赖，运行前快照见 `financial-independent-before.sha256`；两次运行后 `LC_ALL=C shasum -a 256 -c` 全部 OK，覆盖后列表中保存对应版本。并行工作区中其他未列文件未作全仓冻结。
2. **PASS**：以下原作者 7 文件在单 worker 隔离配置复跑 81/81，17.44 秒，日志 `financial-independent-20261029.log`。文件内各 SQLite 测试自己 `mkdtemp` 并设置、清理 `TRADEREVIEW_DB_PATH`；六份来源仅只读，预检、保存及重开均发生在临时库。六份实际值断言为排序后的六元组集合，并非逐练习身份与特定值映射，不夸大为逐身份财务对账。

```sh
I16_REAL_SOURCE_DIR='/Users/zhoulin/Documents/模拟交易复盘' TRADEREVIEW_DB_PATH=/tmp/i16-independent-unused-20261029.sqlite ./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/storage/practice-statistics-complete-trades.integration.test.ts app/lib/storage/practice-statistics-v2.integration.test.ts app/lib/storage/practice-statistics-financial.integration.test.ts app/lib/storage/practice-statistics-capital-integration.test.ts app/lib/storage/practice-statistics-http-client.test.ts app/lib/trades/practice-statistics-summary.test.ts app/lib/trades/tradingview-practice-financial-projection.test.ts --maxWorkers=1
```

3. **PASS**：独立新增证据目录专用探针 11/11，3.06 秒，见 `financial-independent-probe-20261029.test.ts` 和 `financial-independent-probe-20261029.log`。两组非零费、巨大正负精确抵消只计一次；另逐项检查费用冲突、缺失、负数、净额冲突、数量不符、多空不符、重复进场、非法日期、极端指数；一个有效组的小计保留，完整练习费用保持未知。独立隔离库还从真实 preview/commit route 导入有效组合，手工损坏单练习本金覆盖后重开，V2 route/client 保留已知净额和费用、收益率与回撤未知。探针只写新建临时 SQLite 与证据文件。

```sh
TRADEREVIEW_DB_PATH=/tmp/i16-independent-unused-20261029.sqlite ./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/trading-library-v20-development/evidence/I16-capital-readonly-20261029/financial-independent-vitest.config.ts
```

4. **PASS（限定）**：作者测试经 route/client 测默认 100000、全局修改 200000、另一练习覆盖 50000、连接关闭重开后各自收益率；其本金修改通过 `PracticeCapitalStore` 直接进行，未证明用户设置页面操作与返回刷新。旧 V2 未知结果没有 `practiceFees` 时客户端返回未知费用；对伪造净额、费用和收益率拒绝。

## 限制及待办

- **NOT VERIFIED**：真实用户设置 UI → 保存 → 返回统计 → 重载；真实浏览器、真实网络、全局/单练习可访问入口以及整页视觉。仅隔离测试，不对业务库进行写验。
- **NOT VERIFIED**：旧 V2 客户端消费新已知完整结果；其兼容与发布协调须单独验证。旧 V2 未知响应兼容不代表所有版本双向兼容；六份测试以值集合断言，建议补配身份与逐文件财务结果断言。
- **NOT VERIFIED**：真实完整权益轨迹、回撤、跨币种换算，以及所有畸形数据排列与快照并发。无依据时仍未知。
- 作者报告最终全项目 TypeScript 检查 **FAIL**（并行 `library-practice-detail.tsx:59,264,267`），本审查未重新运行全局检查，原失败不可被本切片通过覆盖；作者报告此前全局通过不等于冻结版通过。整页负责人须在共享代码稳定后重验。
- 以下是对独立测试和日志的固定指纹：probe `d0327ba11e51346f845d548a5833265c0b2a372b5d55b681760ec1c723fb2ccc`；config `0a82766f631275050d6d1e29239371e585fe9e570a0468706f7014c256c5ff43`；7 文件日志 `bdb2bd6e47d371102b895e557d4a41b9c4ff08d21ad2c660c9d1662f20add34a`；探针日志 `c38abfd5fc2019c2baee69d30af1c3f17ba4d0e12be6370f086e93b5df3380a2`；用户决策 `82aa2609cf640a6719a534bb720c8399c09078ebe07576b8e6072a6e1a344193`。
