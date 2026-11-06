# Luna 独立验收：Task 1 可持久化的 native 分组结果

## 结论

- **Spec：✅ PASS（仅限本票 Task 1）**。冻结候选满足本票的结果保存、失效、回退、全库门与机械生成要求。
- **Quality：Approved（本票 scratch 原型范围）**。未发现 Critical 或 Important 问题。
- 本结论不关闭原票或扩大范围：原失败 **5/5** 保留，当前候选仍为恢复阶段 **4/5**。未连接原业务数据库，未改产品文件、服务、依赖或旧证据，也未提交。

冻结候选 SHA-256：`9ebf07d269f7ec6d00ddd3bff0f950717e3a186f0cfb9904c2d90e88baf8fbae`；冻结 worker SHA-256：`6f2e016b737055a1cd9c67062d33d65d584a09731b0256e46345417984ebe5c1`。机械还原结果与源逐字相同。

## 发现

- **Critical：无。**
- **Important：无。**
- **Minor（非阻塞，已有运行警告）：** pinned Node 在原始与候选两边都输出 `DEP0205`，涉及 `module.register()` 弃用；本次候选日志 [candidate/run.log](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/luna-review-run-20261106/candidate/run.log:10) 与原始日志 [original/run.log](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/luna-review-run-20261106/original/run.log:10) 均记录该警告，二者均通过，不影响验收断言。

## 规格核对

| 要求 | 预期 | 独立实测 |
| --- | --- | --- |
| 原完整 builder 与候选业务结果深比 | 除允许排除的运行身份、阶段计时和内部诊断外，金额、理由、资格、业务时钟、有效期及非空 series 相同 | 主批 **19 个完整 builder + 51 个原边界投影，共 70/70 相同**；跨进程 seed/resume 再比较 4 对，**4/4 相同**。比较器见 [prototype.test.ts](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/prototype.test.ts:40)。 |
| A 的持久结果与全库资格相互独立 | B 新增或 B 来源缺口时 A 可从磁盘恢复；fresh 全库门仍可拒绝总值 | 主批观测 **29 次 native 恢复、52 次原求值**。B 新增和 gap 时 A 命中；gap 输出仍为 `value:null`、`available:false` 和 `universe:storage-projection-gap` / `universe:unknown`。对仅观察到 A 的完整全库 gap 也核对原币 CNY 720 保留，见 [prototype.test.ts](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/prototype.test.ts:90)。 |
| 独立进程恢复和 cursor 绑定 | 首进程退出后，另一 Node 进程从同一 SQLite 结果库命中，并绑定新请求 cursor | PID **85991 → 86021**；两个候选进程使用同一 `luna-review-run-20261106/cross-process.sqlite`。seed 2 写入、0 命中；resume 2 命中、0 求值。恢复前后依赖与 payload digest 相同，但 evidence cursor 从 `08:00:00` 更新为 `08:00:01`；两组业务结果仍与新鲜原始 oracle 相同。 |
| 变更、行情与时间失效 | 成交截止、收盘、业务日变化必须 miss；行情内容及顺序不能改变两个原 selector 的语义；FX fresh | 未来成交越过 cursor、收盘、Shanghai 换日均 miss。收盘 fixture 先清空本测试缓存以隔离先前 post-close 状态，随后直接断言 `completedSession` 改变且收盘后 miss；见 [prototype.test.ts](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/prototype.test.ts:124)。重复交易日行情调整顺序导致原 quote 选择变化并 miss，后续相同顺序可命中。FX 7→8、报告币种 CNY→USD 和 FX knowledge 到达均重新组合，缓存只恢复 native 金额。 |
| 账户及复杂证据隔离 | A 修订、B 删除、账户/标的迁移、模拟 run、费用/冲突均保持原规则 | A 卖出 40 改 20 后为数量 80、市值 960、浮盈 160；A miss 而未变 B 命中。删除 B 后其行不残留；迁移 miss；simulation run 隔离。账户附加费用、冲突及非 ordinary 证据回原计算。 |
| 损坏与资源失败 | 不得组合错误金额，安全回原求值 | JSON、摘要、schema、code、policy、NaN 形状损坏，以及 SQLite 实际读写失败、关闭连接、容量拒绝和淘汰均通过断言；参见 [prototype.test.ts](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/prototype.test.ts:190)。 |
| 生成唯一性与保护 | 唯一公式源机械包装；锚点/非权威 source 漂移拒绝且不覆盖旧输出；保护范围无变化 | `mechanicalReverseExact:true`；漂移及非权威输入均拒绝、既有输出 SHA 不变。975 个产品文件与旧冻结 44 个文件未变；独立保护检查没有新增或删除产品文件。worker/root 冻结分别检查 **127/128** 个文件，均未变化。 |

候选中的核心包装位于 [candidate/homepage-v25-performance.ts](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/candidate/homepage-v25-performance.ts:683) 与 [同文件 projectedCurrent](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/candidate/homepage-v25-performance.ts:1050)：依赖摘要保留原数据顺序，包含完整 collected group、该标的全部原始 candles、保守 account evidence、版本/政策与实际业务时钟；附加证据及冲突组回原路径。命中后仍执行 `fxFor` 和 `sharedMetric`。恢复的对象是 native 金额、evidence 和 quote coverage，不是完整公开持仓行。

修正后的 A/B 遍历断言仍明确按账户验证 A 命中、B miss（[prototype.test.ts:94](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/prototype.test.ts:94) 和 [prototype.test.ts:117](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/prototype.test.ts:117)）。收盘用例也仍断言前后 `completedSession` 不同并验证 miss（[prototype.test.ts:137](/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/prototype.test.ts:137)）。因此测试顺序/污染修正没有删掉所需的恢复和失效证据。

## 独立命令与结果

预期：70 主对照与 4 跨进程对照全部业务相同；新 Node 进程实际读到持久结果；机械还原、漂移保护、类型检查及冻结保护通过。实际结果符合预期：

```sh
./scripts/native-node.sh .scratch/homepage-db-optimization-20261105/group-results/prototype-run.mjs out=/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/luna-review-run-20261106
```

退出 0：Node 26.0.0 / SQLite 3.53.0，70/70 主对照相同，29 恢复、52 求值，seed/resume PID 为 85991/86021。

```sh
./scripts/native-node.sh .scratch/homepage-db-optimization-20261105/group-results/prototype-verify.mjs out=/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/luna-review-verify-20261106
```

退出 0：candidate SHA 与冻结值一致；机械反向还原精确；975 产品文件、旧冻结 44 文件无变化；两种漂移拒绝且 sentinel 输出未变化。

```sh
./scripts/native-node.sh node_modules/typescript/bin/tsc -p .scratch/homepage-db-optimization-20261105/group-results/prototype-typecheck.json
```

退出 0，无诊断。

另独立运行冻结只读校验：`./scripts/native-node.sh .scratch/homepage-db-optimization-20261105/group-results/worker-freeze.mjs check=/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/worker-freeze.json`（127 unchanged，manifest SHA `6f2e…e5c1`）及相同命令改用 `root-worker-freeze.json`（128 unchanged）。`python3 .scratch/homepage-db-optimization-20261105/group-results/root-check-protection.py --output=/Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/group-results/luna-review-protection-20261106.json` 退出 0，`pass:true`，HEAD 与基线相同。

## 验收边界

- **95% branch coverage：NOT VERIFIED**。没有 coverage provider；本轮未安装依赖或将聚焦用例冒充覆盖率。
- 这次只验证 scratch 候选的 native 结果存储接口。原 acquisition/selection、全库门、FX、历史/canonical、`ownHomepageFinancialSource`、`projectHomepageFinancialView` 与 holdings builder 仍每次走原链路；持仓完整行、后台接线、并发、原全库耗时及真实整页 **≤1 秒均未通过本次验收**。
- 无产品 UI、控件或页面状态改动，因此 UI 检查 **N/A**；原完整首页 1 秒 **FAIL 保持**。财务规则、Bars 和并发专项仍暂停。

