# 版本核对

本地复核：2026-10-06T10:05:26.746972+08:00。最近一次成功获取远端：2026-10-06T09:39:07.554064（北京时间）。随后远端获取失败，不能声称已验证该时间之后的远端状态。

各现存 worktree 和正式应用的 package.json 均为 0.1.0；这不能区分代码版本。下表采用 Git 提交号。

桌面启动服务：`ee76e830f548ef456f8e193d57d165889ac56412`；release `20260923-master-ee76e83`；监听 PID 42336；正式入口 `http://127.0.0.1:3022/`。完整提交由已发布源码与 Git 文件比对核实，旧 release 本身缺少 release.json。

最近核实的远端 master：`63690a494b8ad403081c7720985be54a95db60c7`。正式服务落后该版本 29 个提交。本次没有切换正式服务，最终只读进程/目录/HTTP 核验见 [formal-status-final.log](formal-status-final.log)。

| Worktree | 分支 | 提交 | 相对已核实远端 master（领先/落后） | 工作区条目 |
| --- | --- | --- | --- | --- |
| `/Users/zhoulin/Documents/TradeReview` | `master` | `63690a49` | 0 / 0 | 4 |
| `/private/tmp/tradereview-wayfinder.2fbUtR/templates` | `research/monthly-statement-templates` | `3bf1a0a3` | 1 / 129 | 目录已不存在，Git 残留记录 |
| `/private/tmp/tradereview-wayfinder.2fbUtR/time` | `research/monthly-statement-time` | `8d2f6062` | 1 / 129 | 目录已不存在，Git 残留记录 |
| `/Users/zhoulin/.codex/worktrees/04ee/TradeReview` | `codex/cms-a-share-import` | `bced4f0a` | 0 / 76 | 0 |
| `/Users/zhoulin/.codex/worktrees/2c43/TradeReview` | `codex/strategy-workbench-v1-design` | `9c2b3d20` | 1 / 10 | 9 |
| `/Users/zhoulin/.codex/worktrees/afc8/TradeReview` | `codex/local-native-deploy` | `63690a49` | 0 / 0 | 18 |
| `/Users/zhoulin/.codex/worktrees/cms-integration/TradeReview` | `codex/sync-master-cms` | `e4cafd91` | 0 / 93 | 0 |
| `/Users/zhoulin/.codex/worktrees/dbab/TradeReview` | `codex/control-audit-fixes-20260929` | `49c4fdbb` | 0 / 16 | 6 |
| `/Users/zhoulin/.codex/worktrees/home-data-root-fixes/TradeReview` | `codex/home-data-root-fixes-20260930` | `63690a49` | 0 / 0 | 35 |
| `/Users/zhoulin/.codex/worktrees/luna-hk/TradeReview` | `codex/hk-connect-import` | `3233a2ac` | 0 / 71 | 2 |
| `/Users/zhoulin/.codex/worktrees/review-dashboard/TradeReview` | `codex/review-dashboard-refresh` | `4df397a7` | 0 / 62 | 5 |
| `/Users/zhoulin/Documents/TradeReview/.worktrees/rule-based-pattern-insights` | `codex/rule-based-pattern-insights` | `d1171a47` | 0 / 308 | 0 |

所有已有工作区修改均保留；本任务分支为 `codex/local-native-deploy`，修改尚未提交。默认 `make deploy` 会拒绝发布未提交的应用源码；显式 ref 只发布其已提交快照。

旧 release 的 status 显示 `fullcommit=UNKNOWN`，同时 `consistent=true` 仅表示 current 指针、实际运行目录和 HTTP 健康一致，不能证明它与 master 一致。

## 后续只读观察：2026-10-06 10:16–10:20 +08:00

正式端口 3022 此时已无监听，HTTP connection refused；此前运行状态为当时的历史证据。Docker 引擎同样未运行，实际镜像和容器版本未验证。正式业务库迁移版本 14，旧 Docker 历史库为 6；正式部署源码迁移上限为 7，当前工作区为 14。详见 [Docker 与数据库核对](DOCKER-DATABASE-AUDIT.md)。本次没有启停服务、迁移或修改数据库。

2026-10-06 10:23–10:28，用户授权正式运行后核对：Docker 引擎与原正式原生服务已启动；正式 listener PID 98660，源码 1,182 个文件精确匹配 ee76e830f548ef456f8e193d57d165889ac56412，HTTP 200。真实 Docker inspect 发现既有容器仍挂旧 schema 6 库/4317，镜像源码 schema 3；正式源码/接口 schema 7 与正式库 schema 14 不一致。见 [正式运行后核对](FORMAL-RUNTIME-VERSION-AUDIT.md)，包括启动前备份与启动后两个表字段变化的观察。
