# 解析与完成凭据单测补充记录

日期：2026-10-28。执行代理：coverage_tests。范围已冻结，交由主代理独立复验；本记录不代表功能完成或浏览器验收。

## 修改范围

- `app/lib/import/file-fingerprint.test.ts`：新增 14 例，验证字节视图、真实 SHA-256、空内容与不安全/畸形持久化标识。
- `app/lib/import/import-completion.test.ts`：新增 35 例，验证已认可忽略规则、未证实/错配规则仍待处理、月结不完整凭据与畸形持久化结构。
- `app/lib/import/tradingview-completion-boundaries.test.ts`：新增 42 例，验证无效行/配对/重复角色不会变成成功凭据，独立有效交易保留，顺序/证券上下文、持久化解码证据重放、手续费空值和精确大整数。

新增共 91 例；连同已有指纹 2 例及 TradingView 8 例，定向运行共 101 例。测试通过公开操作与可观察结果断言，无 mock、无生产代码修改。三个生产源码的 SHA-256 均与 CANDIDATE-05 一致，见 `COVERAGE-TESTS-HASHES.json`。

## 最终验证

命令（在本 worktree 根目录执行）：

```sh
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/import-exact-file-block-2026-10-27/browser-isolated/coverage-tests.sqlite ./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/import/file-fingerprint.test.ts app/lib/import/import-completion.test.ts app/lib/import/tradingview-simulation.test.ts app/lib/import/tradingview-completion-boundaries.test.ts --maxWorkers=1 --coverage.enabled --coverage.provider=v8 --coverage.include=app/lib/import/file-fingerprint.ts --coverage.include=app/lib/import/import-completion.ts --coverage.include=app/lib/import/tradingview-simulation.ts --coverage.reporter=json --coverage.reporter=json-summary --coverage.reporter=text --coverage.reportsDirectory=.scratch/import-exact-file-block-2026-10-27/coverage-tests-final
```

结果：4 文件、101 例全部通过，退出 0。证据：`COVERAGE-TESTS-FINAL.log` 与 `coverage-tests-final/coverage-summary.json` / `coverage-final.json`。保留 Node DEP0205 废弃提示。

覆盖口径为上述 3 个完整生产源码文件，V8 分支，无排除未覆盖分支，无仅变更行分母：

| 源码 | 分支命中/总数 | 分支覆盖 |
| --- | ---: | ---: |
| file-fingerprint.ts | 11/11 | 100% |
| import-completion.ts | 38/38 | 100% |
| tradingview-simulation.ts | 169/184 | 91.84% |
| 合计 | 218/233 | 93.56% |

总计语句 244/247（98.78%）、函数 55/55（100%）、行 201/202（99.50%）。本分工完整文件分支覆盖未达 95%，不缩小分母宣称达标。

TradingView 尚余 15 个未命中分支：L121/131 首 sheet 名称兜底；L122/132 无 sheet 返回；L138 无首行兜底；L150/152 空表头置信度与诊断兜底；L234 无源行号诊断；L309 无检测诊断兜底；L340 无解码表头兜底；L398/439 非 Error 抛出兜底；L463-466 最后源行排序及 L464 两侧无 sourceTradeId 兜底。唯一未覆盖行 L163。停止补充未证实业务价值的构造用例，保留原始分母。

`git diff --check` 对本分工测试文件通过。全项目 `tsc --noEmit` 退出 2，日志为 `COVERAGE-TESTS-FINAL-TYPECHECK.log`：其他分工 `import-confirm-dialog.test.tsx:419` 缺 accountLabel，以及 `trade-import-plan.test.tsx:96` 的 rawRun.kind 类型推宽。主代理已获知并协调原所有者修复；本分工 3 文件无类型错误。最终全项目结果由主代理重新验证。

## 安全与环境

本分工为纯解析/标识单测，不加载 SQLite、不访问浏览器、不操作共享业务数据库。最终运行显式设置上述 `browser-isolated/coverage-tests.sqlite`。最早纯指纹/凭据运行曾设置 feature 根目录的 coverage-tests-isolated.sqlite 路径，在收到进一步目录约束后全部改为 browser-isolated；该早期运行未加载数据库模块且未产生数据库文件，不作为数据库写入证据。

覆盖 provider 已有实体位于 feature scratch 的 `coverage-tool/node_modules/@vitest/coverage-v8`。为 Vitest 解析创建过 `node_modules/@vitest/coverage-v8` 临时符号链接；结束时核对其绝对目标与 lstat 类型后，仅 unlink 该自有链接，确认当前链接不存在，provider 实体保留。未触碰或清理他人文件。

保留失败证据：`COVERAGE-TESTS-BASELINE.log` 为 provider 解析失败，不是有效基线；`COVERAGE-TESTS-TRADINGVIEW.log` 曾有空 CSV confidence 断言错误，后改为契约要求的 matched:false/blocked 断言，未修改生产代码。不得将这些早期运行表述为通过。

浏览器、桌面实际持久化和整个重复导入模块覆盖率均不在本分工验收范围，未运行；财务与 Bars 维持暂停。主代理需执行统一测试与覆盖测量后判断用户目标。
