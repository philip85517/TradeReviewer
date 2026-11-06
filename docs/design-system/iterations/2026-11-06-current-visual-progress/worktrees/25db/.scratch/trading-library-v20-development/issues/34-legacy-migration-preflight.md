# 旧数据迁移只读预检（第一阶段）

ID: TL20-I34
State: closed
Status: accepted
Assignee: migration_preflight_terra (gpt-6.1-terra, ultra)
集成负责人: root

2026-10-27 用户调整：**仅本预检脚本暂不要求达到 95% 分支覆盖率**；整体单测目标不变。独立验收使用 Luna 5.6，不再限定 Max；不得将其他模型冒充为 Luna 5.6。下方历史记录保留当时的要求与测量结果。

2026-10-28 用户进一步要求采用独立 Agent 验收；独立审查和协调者核验已完成，见下方证据。实际模型身份未核实，不记作特定模型验收。

## 用户入口和范围

用户确认先开发“运行迁移预检→查看问题清单→确认原库未变化”，测试只用自行创建的隔离数据库。预检不执行迁移、修复、创建目标库或切换数据库。它必须区分发现的问题与尚无法判断的事项，不能猜练习身份、日期或复盘归属；不能把预检本身当成迁移已准备就绪。

## 规格和设计覆盖

- [V2.0 第四章：独立练习身份、交易、复盘及人工成果](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md#chapter-BT04)；以用户后续确认的一练习仅一个账户和标的、旧数据迁新库且旧库不变为准。
- [旧库迁移总任务](33-legacy-database-migration.md)及[旧库映射事实](01-legacy-contract.md)。该任务是后端/命令行数据预检，不添加、更改或声称验收任何视觉元素；图片和 UI 控件为不适用，完整 V2.0 页面验收仍必需。
- 负责人仅拥有 `scripts/legacy-migration-preflight.mjs` 和对应 `.test.mjs`。协调者负责跨文件集成和实际检查。禁止操作业务库，禁止启动产品写入、提交、推送或派发代理。

## 测试驱动实现合同

1. 公开只读入口 `inspectLegacyMigration(sourcePath)`，同时提供 `node scripts/legacy-migration-preflight.mjs --source <path>`，明确传入路径，不从配置或环境变量选择业务库；输出 JSON 问题清单。无效参数、缺失或损坏的库清晰失败，不创建文件。
2. 使用 SQLite 只读连接与一致的读取事务，不调用会初始化或升级 schema 的生产打开函数。统计已有表及原始记录/复盘相关可判定信息，检查声明的外键异常；缺少必要的旧结构应报告，不能误报健康。输出不包含账户、交易或复盘正文等敏感内容。
3. 显式列出尚未核实的来源完整性、练习归属/日期和复盘业务关联，明确结果不能证明迁移安全；不能把数据库外键检查当作全部业务关联检查。存在实际可判定的异常时给出类别及数量；不编造日期或 ID。
4. 合成隔离数据库中依次先写失败的公开入口行为测试，再最小实现：缺路径/损坏库、不完整结构、正常表及数量、外键孤立、未验证事项、读取前后原始数据一致；包含命令行行为。仅清理测试自身创建的临时目录。记录每轮红绿证据、范围和剩余限制，不以覆盖率凑重复用例。
5. 开发完成后由独立 Agent 审查，协调者独立核验；实际模型身份未核实，不冒称特定模型验收。

## Blocked by

- None（本票为已接受的隔离预检切片；不代表正式迁移的依赖已解除。）

## 验收证据

[独立代理验收](../evidence/I34/independent-agent-acceptance.md)及[协调者验收](../evidence/I34/coordinator-acceptance-2026-10-28.md)均为本预检切片 PASS。隔离库测试 17/17、定向 ESLint 通过；未执行真实库预检或实际迁移。此前指定 Luna 5.6 的[审查记录](../evidence/I34/independent-luna56-review.md)保留，实际模型身份未核实。

### 协调者检查记录

- I34-TEST-RUNNER，修复第 1/5 轮：开发者以 Node 单独执行 11 项通过，但协调者运行项目 Vitest 入口 `./scripts/native-node.sh node_modules/vitest/vitest.mjs run scripts/legacy-migration-preflight.test.mjs` 返回 `No test suite found`，退出码 1。已交原负责人修复并重验；在回归入口通过前不得记为通过。
- I34-TEST-RUNNER 第 1/5 轮已修复：协调者目标 Vitest 17/17、定向 ESLint 通过；单文件分支覆盖 77.77%，未达约 95% 目标；[范围及证据](../evidence/I34/coordinator-check.md)。独立指定模型验收 NOT VERIFIED，票保持 open / in-progress。
