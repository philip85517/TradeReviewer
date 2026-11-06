# 数据库世代与运行切换

State: closed
Status: accepted-local-runtime-scope
Assignee: /root/dbb_activation
Attempts: 2/5

## 结论

候选 1/5 已实现并冻结：受控恢复与调试克隆在未发布副本上通过唯一初始化实现完成迁移、轮换及校验，失败阻止候选启动并保留原库回退。实施者离线/克隆 23 PASS、部署编排 65 PASS、Task3 回归 86 PASS、初始化定向 tsc 0 diagnostics。等待独立 Luna Max 与协调者验收；此处不作整体通过结论。

报告：`.superpowers/sdd/2026-10-26-database-b-implementation/task-9-report.md`。冻结副本、hash、baseline.diff 和所有 RED/GREEN 原输出：`.scratch/database-b-development-2026-10-26/evidence/task-9/`。

Docker 实际构建与容器运行边界 NOT VERIFIED；全量 tsc 有域外 Recall 测试及 snapshot 类型诊断，已报协调者。未运行真实部署、make dev 或读取/复制/写入业务库。财务/Bars 保持暂停。

## 已有证据

- `deploy/ops/restore-db.sh` 在恢复临时库后直接替换并启动，未更换业务世代。
- `scripts/debug-local.mjs` 使用在线备份克隆，原路径未建立新世代。
- `db/sqlite.ts` 原初始化只遍历已知迁移，不拒绝未知未来迁移。Task3 已收到此项检查要求。
- 无法仅靠库内状态识别任意绕过项目入口、直接在文件系统覆回旧备份的行为；受控操作入口及明确的启用前置条件必须记录，不能声称检测所有外部替换。

## 验收要求

1. 受控恢复在新库上线前轮换世代，失败不得启动候选库；普通重启不轮换。
2. 测试克隆在副本换世代，原库不写；本任务演练只创建自己的临时库，不读取配置指向的业务库。
3. 不兼容版本明确阻止新进程启动；激活说明明确停旧写进程、备份、迁移、校验、新版启动的顺序和边界。
4. 原有恢复失败回退及路径保护不退化。独立 Luna 审查和协调者验证。

## 依赖

- [Task3](03-task.md)：BookVersion 及 rotateBookEpoch 接口。


## 候选1独立验收 FAIL；候选2处理中
Luna确定两个Critical：主库已隔离而WAL/SHM移动失败或信号中断会丢失旧sidecar；回退破坏性文件操作前未检查候选和隔离原文件的外部消费者。报告 task-9-luna-review-1.md。保留原23/65/86通过证据，但不能代替这两个边界。原Sol恢复candidate2，以真实临时WAL和外部进程反例先复现，再一次处理状态与占用检查。

## 候选 2/5 已冻结；等待 scoped 独立复验

按两个 Critical 合并诊断，先保留真实未 checkpoint WAL 丢失与外部原 WAL 持有者反例，再修复 rename 前状态记录、按实际隔离文件恢复，以及候选/原件/未发布副本三组 main/WAL/SHM 共 9 路径的回退占用检查。lsof 运行错误和警告一律 fail closed、保留文件及维护锁。

中间完整 79 PASS 后，第 15 个清理失败分支真实 RED 发现 trap 的最终清理仍可能删除隔离原件；同一候选 2 加一行 `recovery_failed == 0` 条件修复。原 79 PASS 和新增 RED 均保留，前者不能覆盖此分支。

最终完整部署编排 **80/80 PASS**（18:07:32，276.83s），含 15 项新故障边界；真实 `initializeSqlite` 关闭/重开专项 **1 PASS / 55 skipped**。固定 Node 26.0.0 / SQLite 3.53.0，bash/Node 语法与拥有文件 diff 检查均 0。Vitest DEP0205 警告保留。

仅 `restore-db.sh` 与 `deploy.test.mjs` 相对候选 1 改变，精确差异 `fix.diff` SHA-256 为 `4fc1569c81aea8da620f9dfcadbe6d7f01e9f938fa15f7d69d0cf36bb71e92fc`；源码快照/manifest、累计差异、依赖 hash、所有原日志和 append 报告已冻结。候选 1 的 11 个快照全部未变。statement-market-repair.ts 仅候选 1 机械清理已移交 Task 5，本候选不编辑其后续逻辑。

独立 Luna scoped 审查与协调者验收尚待执行；不得把实施者 PASS 当作整体接受。真实 Docker/跨 namespace/生产恢复 NOT VERIFIED；既有全量 tsc 域外 FAIL 未修复，未操作业务库或真实部署。

## 协调者最终局部验收
候选2/5本地后端ACCEPTED。专属Luna逐项关闭两Critical及第15项cleanup分支，spec/quality Approved；协调者已读完整fix.diff与复验报告，独立15PASS/65skip（155.54s）、冻结10live及移交snapshot hash全部匹配，bash/Node语法检查0。实施者完整80PASS及真实initializer restart1PASS支持本地范围验收。原候选1FAIL及中间失败不覆盖。

DEP0205和debug测试名称偏宽两Minor保留给Task8全局审查。真实Docker构建、镜像runtime、跨namespace lsof、实际部署/业务库恢复继续NOT VERIFIED；本次关闭只代表获授权本地实现与临时库验证，不代表生产放行。整体数据库B尚未完成。
