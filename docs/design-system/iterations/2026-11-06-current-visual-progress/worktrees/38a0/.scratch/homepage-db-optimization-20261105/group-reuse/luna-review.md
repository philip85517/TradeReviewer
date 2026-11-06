# 独立验收：分组准备复用原型（第 3/5 轮）

## 结论

- **有界 prepare seam：PASS。** 对 unchanged ordinary 组复用 normalized rows、canonical handle 与 ordinary checkpoints，真实跳过本段计算；每次仍重新 collect 全库、重建费用/行情/FX/资格和页面组合。独立 baseline/candidate 逐字段对照通过。
- **原 07 票：保持 OPEN。** 严格的 A 行结果对象复用、持久组结果、后台发布/页面接线、真实页面性能与 95% 分支覆盖均未证明。prep-only 不能记作完整 group-result 通过。

## 冻结边界与独立复跑

- 原产品源 SHA：`9f834ee3009252b21668717e9172665c6590653d02f93ea27bc48e7a38fa1ba3`；候选 SHA：`a9426fa5ba5d8f3cbb469df782c70abf3270cf3bf5f12de83d15523e2463f77d`。候选/源与 root freeze 匹配；44 个冻结文件复核无变化，975 个产品文件相对 root 初始快照为 0 差异。
- 独立运行使用 `luna-*` 测试副本，只把 oracle/evidence/verify 输出文件名改为 `luna-*`；算法断言未变。机械差异见 [luna-test-adapter.diff](luna-test-adapter.diff) 与 [luna-verify-adapter.diff](luna-verify-adapter.diff)。未覆盖任何 `worker-*` 证据；冻结的 `worker-baseline-values.json` SHA 前后相同。
- Pinned Node `v26.0.0`：baseline **7/7，退出 0**；candidate **7/7，退出 0**。18 个完整 builder case 与 16 个真实 financial projection case 共 34 项，输入 SHA 与未改 builder 深比较均 **34/34 相等**，无首差异。结果见 [luna-baseline.log](luna-baseline.log)、[luna-candidate.log](luna-candidate.log)、[luna-baseline-evidence.json](luna-baseline-evidence.json)、[luna-candidate-evidence.json](luna-candidate-evidence.json)。
- 聚焦 TypeScript 检查退出 0；安全副本的机械反向校验退出 0、产品文件差异 0，故意源漂移以预期退出 1 且候选输出不变。校验结果见 [luna-verification.json](luna-verification.json) 与 [luna-typecheck.log](luna-typecheck.log)。95% 分支覆盖：**NOT VERIFIED**（coverage provider 不可用）。
- 只用内存 SQLite 合成事实；未读写业务库、未操作产品服务。复跑命令从仓库根目录：

```sh
PROTOTYPE_MODE=baseline PROTOTYPE_EVIDENCE=./luna-baseline-evidence.json ./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-db-optimization-20261105/group-reuse/luna-prototype.config.ts
PROTOTYPE_MODE=candidate PROTOTYPE_EVIDENCE=./luna-candidate-evidence.json ./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-db-optimization-20261105/group-reuse/luna-prototype.config.ts
./scripts/native-node.sh node_modules/typescript/bin/tsc -p .scratch/homepage-db-optimization-20261105/group-reuse/prototype-typecheck.json
./scripts/native-node.sh .scratch/homepage-db-optimization-20261105/group-reuse/luna-prototype-verify.mjs
```

## 原 07 验收标准

| 标准 | 判定 | 独立证据与限制 |
|---|---|---|
| 1. 全局凭据、分组事实、基础结果、页面组合的对象/字段/版本；不加第二套公式 | **PARTIAL** | MODEL/DEPENDENCIES 明确四层与依赖，机械候选沿用产品公式；没有可持久化基础结果 schema/version，也没有从持久组结果到页面的组合契约。 |
| 2. 买 100 卖 40、修订 40→20 与原完整计算逐项一致 | **PASS（本原型范围）** | `60/720/120`、`80/960/160` 均命中；34 项保留业务字段深比较相等，包含 reasons、scope/policies、clock、validUntil 与非空 series。数值一致不代表行结果对象被缓存。 |
| 3. B 来源缺口下 A 可复用且全局资格一致 | **PARTIAL** | B 缺口变化时 A ordinary prepare 真命中；A 行仍 `60/720/120`，全库 totals 变 `null`，保留 `universe:storage-projection-gap`/`universe:unknown` 与 CNY 720。**严格 A 行结果对象复用 NOT VERIFIED**：行投影每次重新生成。 |
| 4. 无关组、账户费用、模拟盘、展示字段、时间到期等失效规则明确 | **PASS（测试过的内存准备范围）** | simulationRun 隔离；费用/证据冲突、名称、复盘、行情、FX、到期保守 miss；fallback/重复冲突不缓存；修订/移除无幽灵行；容量/淘汰/reset 有界测试。coverage95 仍 NOT VERIFIED。 |
| 5. 实测复用/重算工作量；不把小样本说成真实全库性能 | **PARTIAL** | A+B 中 A 复用 2 transitions，B 重算 1；修订 A 时 B 命中；gap 下 A 命中，fresh prepare sweep/feeSteps 为 0。只证明 prepare 段工作量。key 把精确 `Date.now()` 纳入依赖，测试固定业务时钟，跨真实请求命中率未知；没有全库/≤1 秒证据。 |
| 6. 实施、独立 Luna 与协调者接受有证据 | **PARTIAL** | worker 冻结报告与本独立复跑/代码审查齐备；root 报告其独立复跑完成。root 的最终验收及票状态仍由协调者记录。 |

## 审查发现与保留限制

1. **Minor / deferred：验收脚本可能覆盖冻结证据。** 原 [prototype.test.ts](prototype.test.ts:135) baseline `afterAll` 硬写 `worker-baseline-values.json`，candidate 也读取它；原 [prototype-verify.mjs](prototype-verify.mjs:33) 写 `worker-drift-source.ts`、`worker-drift-rejection.log`、`worker-verification.json`。直接复跑会覆盖/触碰 `worker-*`。本轮用机械改名副本规避，worker SHA 未变；没有候选正确性风险，无需消耗实现轮次。后续可将 oracle/evidence 路径参数化。
2. `prototypeKey` 将精确毫秒 `Date.now()` 与 metadata、quotes、FX、复盘、账户证据纳入 guard（候选约 714–721 行）。这是安全的保守失效，但本测试 pin 了时钟，不能估算真实请求命中率或提速。
3. 缓存内容含 `position-ledger.ts` 私有 WeakMap canonical handle，不可 JSON/跨进程持久化。候选内存容量是 64 项/8 MiB 的**估算预算**，不是实测堆上限。持久模型需另定可恢复事实/版本并仍调用原计算规则。

未发现本次受测 prepare seam 的业务等价缺陷。保留原产品整体一秒/完整内容 **FAIL**，不覆盖财务规则、Bars、并发、真实库、持久重启、后台原子发布或 UI 验收。
