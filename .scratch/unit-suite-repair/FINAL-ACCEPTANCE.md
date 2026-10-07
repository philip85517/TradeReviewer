# 全仓单测修复验收

State: closed
Status: accepted
Coordinator: /root
Accepted: 2026-10-06T22:39:08+08:00
Worktree: /Users/zhoulin/.codex/worktrees/afc8/TradeReview
Branch / HEAD: codex/local-native-deploy / 63690a494b8ad403081c7720985be54a95db60c7 (uncommitted candidate)

## 实际范围

测试侧六处修复：持仓日期fixture固定asOf；Vitest并发上限2；工作区长流程的实际容器查询、受控autosave timer和导入完成同步；legacy SQLite测试adapter并行读取真实IDB fixture；别名恢复后等待原有canonical偏好持久化断言；native调试非端口用例通过现有seam隔离真实3333监听状态。保留原有用例、用户操作、断言和超时。

前一任务未提交的native部署工作完整保留。本次未修改产品实现，未部署、重启服务、写正式SQLite、提交或操作远端。

## 最终验收门槛

| Gate | Evidence | Result |
| --- | --- | --- |
| 默认全仓 `npm run test:unit`，无CLI worker/timeout覆盖 | [最终日志](reports/full-unit-final-v2.log); [冻结清单](reports/frozen-candidate-final-v2.json) | PASS: 322文件收集，319通过/3原有语料文件跳过；3064测试通过/0失败/6原有跳过；449.66s |
| 原失败三例，原5s预算 | reports/workspace-three-frozen-one.log; reports/workspace-three-frozen-two.log | PASS: each3/3；88条按名称筛选未运行，非新增skip |
| 完整工作区文件 | reports/workspace-full-frozen.log; reports/full-unit-final-v2.log | PASS: 原91/91通过；最终同步修复后完整91也由全仓覆盖 |
| 导入与别名同步修复定向回归 | reports/workspace-alias-synchronization-v2.log | PASS: exact import+complete4 alias cases，5/5；90条名称筛选未运行 |
| `make deploy-test` | [最终日志](reports/deploy-test-final.log) | PASS: 57/57，0失败/0跳过 |
| `make debug-test` | [最终日志](reports/debug-test-final-v2.log) | PASS: 15/15，0失败/0跳过；11debug+4environment；原node51308监听3333保留 |
| 全仓类型检查 | reports/typecheck-final-v2.log | PASS: `npm run typecheck` exit0 |
| 变更文件ESLint | reports/lint-final-v2.log; reports/lint-debug-port-final.log | PASS: both exit0 |
| 原用例/断言/预算保留 | reports/case-inventory-final.json; reports/debug-case-inventory-final.json; four independent reviews | PASS: 原声明、名称、模式、预算保留；debug原11声明/37断言；无新增skip或放宽timeout |
| 独立Spec/Quality审查与协调者整体验收 | reports/independent-review-scoped.md; reports/independent-review-final.md; reports/independent-review-synchronization.md; reports/independent-review-debug-port.md | PASS: 四份独立审查无未解决问题；root直接复核实际源代码/日志并执行集成命令 |
| 最终源代码冻结、whitespace与任务闭环 | reports/final-consistency.json; `git diff --check`; DESIGN-COVERAGE.md; issues/ | PASS: 最终哈希匹配测试/审查候选，R01–R13及全部任务同时关闭 |
| UI/浏览器/正式数据库验收 | 仅测试侧及runner修改，产品UI/数据库路径未变更 | NOT APPLICABLE: 基于实际范围，不以此替代产品验收 |

Native deploy/debug两次命令均包含同一组4个environment测试，按各入口报告57和15，不将二者合计为独立用例数。七个原有Vitest native排除文件通过这两个入口覆盖，详见reports/unit-entrypoint-audit.md。

## 保留的失败历史

| Historical run | Evidence | Recorded result / closure |
| --- | --- | --- |
| 初次全仓 | ../native-debug-baseline/reports/full-unit.log; reports/prior-failure-census.json | 65FAIL/2999PASS/6原有skip；默认7workers资源竞争及fixture/同步问题，经最终全仓关闭 |
| 九个原失败完整文件probe | reports/affected-files.log; reports/affected-files.json | 270PASS/3FAIL；剩余三例独立失败，随后保留实际流程进行修复 |
| 第一轮冻结全仓 | reports/full-unit-final.log | 3062PASS/2FAIL/6原有skip，488.87s；导入toolbar就绪和alias持久化同步失败，最终v2全仓关闭 |
| 第一轮native debug | reports/debug-test-final.log | 10PASS/5FAIL，15total；非端口用例受真实3333监听影响，现有测试seam隔离后v2全部通过 |

原有定向红色日志、detached DOM和时钟兼容性实验均保留于reports。历史FAIL不是当前门槛失败；没有通过删除用例、弱化断言或提高timeout获取通过。R13只修改被Vitest排除的native测试文件，未修改任何冻结的Vitest/编译源，因此最终全仓与类型检查证据仍有效，无需重复执行同一全仓命令。

## 明确限制

原6条外部语料测试仍为opt-in：monthly1条需BROKER_CORPUS_ROOT，china-merchants1条需CHINA_MERCHANTS_CORPUS_ROOT，tradingview4条需TRADINGVIEW_SAMPLE_DIR；当前未提供真实外部语料，不计为通过。这是原有3个文件/6条skip，没有新增skip。

并行fixture读取保留真实记录、独立readonly transaction、返回字段和错误拒绝传播。多个getter同时失败时，先拒绝者决定错误，原串行错误优先级未保留；无此优先级契约，原adapter也不提供跨getter原子快照。完整consumer和现有deferred/late-read安全测试已在最终全仓通过。

Coordinator /root accepts the working repair after all applicable commands and independent reviews pass. No remaining in-scope FAIL or NOT VERIFIED gates.
