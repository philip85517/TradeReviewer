# 首页交互修复与诊断规范：提交版本验收摘要

日期：2026-10-06。协调者 root 独立接受；本记录冻结于任务分支推送与 PR 合并之前，不冒称已完成远端操作。任务分支 `codex/home-click-repairs-20261006`，基线 `63690a494b8ad403081c7720985be54a95db60c7`。

## 接受范围

| 范围 | 结果与证据边界 |
| --- | --- |
| R01 趋势点击 | PASS：屏幕距离命中、完整币种/时期身份、重合候选、预览与提交分离。先前已接受的实际浏览器复验为当前隔离数据集月 28、周 109、日 742，共 879 个目标中心点击；不能称当前新版所有首页控件 100% 普查。 |
| R02 范围清除 | PASS：清附加筛选保留性质（含 unknown）和模拟运行；明确清运行后，返回及 reload 不复活；原 null/undefined 接线保留。 |
| R03 空态空间 | PASS：真实范围无交易/无趋势点时仍保留舞台；1440、1001、1000 三个桌面宽度的数据/选中/空态/恢复高度差为 0px。 |
| R04 筛选布局 | PASS：等宽顶对齐网格、币种基线与独立动作 footer；已接受断点两侧视觉及实际操作。 |
| EX05 窄屏日期详情 | EXCLUDED：用户本轮明确不修复，历史 FAIL 保留；不写为 PASS，也不作为未来默认排除。 |
| D01–D08 可复用规范 | PASS：[统一审计规范](../../docs/agents/frontend-control-audit.md) 包含登记、覆盖率、真实操作、跳动/布局/无响应诊断、修复设计及验收表；接入 8 个现行项目入口，按检查语义及前端开发影响面默认执行。 |
| I02 runtime 测试维护 | PASS：唯一变更为 `tests/local-dev-storage.test.mjs` 的 schema 预期 13 → 14，匹配基线已存在的 migration 14；保留真实隔离库、HTTP 200、服务终止与清理。没有改动迁移或产品行为。 |

## 本次提交前新鲜验证

| 命令 / 检查 | 结果 |
| --- | --- |
| `npx vitest run app/components/dashboard/review-dashboard.test.tsx app/components/dashboard/room-performance.test.tsx app/components/dashboard/room-performance-chart.test.ts` | PASS：3 文件，89 项，exit 0。 |
| `npm run typecheck` | PASS，exit 0。 |
| `npm test` | 初次 FAIL：构建过，5 项中 1 项 schema 14 !== 13；最小修订后 root 重跑，构建成功，5/5 全部通过，exit 0。历史失败未改写成初次通过。 |
| 文档校验 | PASS：8 入口、91 个实际相对链接、围栏、差异与内容指纹；仅精确的模板占位符显式排除。 |
| 独立静态审查 | PASS：merge_readiness_review 未发现新增 P1/P2；追加审查 I02 一行修订正确，`node --check` 与差异格式通过。 |
| 改动 TypeScript 的 ESLint | FAIL：1 个既有 effect error、2 个既有 warning；独立审查者用 HEAD 源码与同配置 stdin 实际复现相同诊断，没有新增 lint error。 |

本次复验时 7 个原产品源码/回归文件和 9 份规范文档的内容 SHA-256 全部与此前接受版本一致。原产品合成指纹 `c1732327640004cfd5743a2a0120f6d0b53894b7287fa22ad2901d51bd74bf30`；新规范 SHA-256 `ff09338e1e4605cec2682076ec1f5ceedcb56fd2fd1dcbcc96b91ab3f40e9777`。I02 新测试 SHA-256 `6099269629e34209cdee1161f81f8638cd8d31374ce61e38156a9755cf2808c2`。

## 数据与验证边界

原 UI 旅程、独立视觉、原业务库逻辑摘要和无交易明细的版本指纹已在本地任务记录中接受；本轮集成保持原产品文件内容。核心交易写入不属于该 UI 修复，运行时测试只创建并清理自己的唯一临时 SQLite。`conf/runtime.json` 未变。

公开远端提交代码、规范及本摘要；原交易截图、浏览器原始 JSON、数据库及 WAL/SHM、基线源码副本保留本地，不上传。原本地审计及最终验收记录保留，不用摘要替换完整原始证据。

此前全仓 lint、unit、workspace 检查的 FAIL 与时序/负载根因未验证边界仍保留；本摘要不能写为全仓通过。原 build/runtime schema 断言失败由 I02 的最终 `npm test` 5/5 证据更新，其他失败未被取消。浏览器 hover-only 仍未验证；模拟/物理触控非本轮要求，窄屏排除保持。

规范触发是代理读取执行的项目工作流要求，没有安装运行时关键词监听器；六类语义场景的文档走查不能冒称未来会话 100% 自动触发实测。后续集成遵循[项目远端流程](../../docs/agents/development-workflow.md)，通过 PR 合并并核对远端 master；当前记录不预签 GitHub 必需检查结果。
