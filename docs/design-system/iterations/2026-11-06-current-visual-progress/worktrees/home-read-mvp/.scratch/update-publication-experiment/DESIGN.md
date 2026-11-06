# 候选 1：同库源模型与投影原子发布

授权依据：协调者 2026-10-29 派发及接受设计消息。原规格引用：`../page-reading-mvp-wayfinder/issues/05-update.md` 的历史补录、跨页版本、失败及重启问题；`../real-data-fact-experiment/README.md` 的静态绑定、真实更新与并发 NOT VERIFIED 边界。当前项目 workflow 与 task-decomposition 已读。无 UI 元素、画板或浏览器旅程。

## 来源与边界

冻结 seed SHA256 为 `176beaee3afe356984a3407f3ee99d276dd25862e2edc284eceafbbb9b6993e6`。seed 只通过只读文件句柄散列。run-02/prepared.sqlite 在确认 WAL 为零后只读散列并复制；复制摘要须相同，原文件和空 WAL 在复制前后、实验结束均复核。SQLite 仅打开私有副本并 integrity_check。此路径依赖冻结文件静止条件，不是活动库在线备份。事实按现有排序求摘要，须等于 run-02 的 `e50a59fb0d6d43dc8f052b8bba3fdcbf5422e682d6a3bb143ea0e031b849cd24`。冻结 seed/run-02 不通过 SQLite 打开，以免创建其 WAL/SHM。

新库的 source_facts 是十字段实验源事实和 withdrawn 标记，绝不冒充原产品 executions。初始真实投影作为基数；变化由明确 synthetic 标记描述。对比两个方法：full 事务中写 delta 后删除并重建所有投影/摘要；incremental 在同事务只重写受影响事实，并重算 all、旧新账户及旧新市场摘要。组合范围仍现查轻表。增量摘要通过受影响分组 SQL 重算，并非逐计数 O(1) 加减；all 摘要依然扫描全部活动事实。

## 版本与读写契约

identity 包含 seed SHA、原投影 SHA、规则版本、候选代码 digest。sourceVersion 为单调整数 CAS。每次成功发布原子变更源模型、版本、投影、摘要及 binding；失败事务回滚全部。游标绑定完整 binding、筛选、排序和页大小，成功后旧游标拒绝，失败后旧游标仍有效。规则/代码/源绑定不一致拒绝读取，需显式重建，不隐式读旧投影。

实际 CAS 路径是同步 `BEGIN IMMEDIATE` 后核对 expectedVersion，再在该写事务内构建和提交。慢 v1 保存 delta/expectedVersion 后，v2 先提交，v1 再调用 publish 会被拒绝。实验没有异步预备库切换架构，没有证明任意预备文件的发布安全；锁等待/超时、并发写者调度不在本轮验收。

读取必须在同一 deferred 读事务中取得 source version、binding、摘要、页内容；写事务 before commit 不可见。实验提供持有 WAL 快照的 reader worker（独立线程、连接）以及 writer 主线程，Atomics 屏障确保事务真实重叠。reader 在 source 写后、projection 写后、commit 前与 commit 后未结束旧快照时均只见旧/旧；释放快照后见新/新并拒绝旧游标。再展示不包读事务时两次查询跨提交能得到 mixed 读，界定契约必要性。一次串行调用不能当并发验收。

另一确定性屏障在 read 的 metadata 查询后暂停 worker，主线程另一连接提交新版本，再恢复 worker 的摘要/行查询；返回必须保持完整旧 payload，后续新事务才取得新版本。屏障通过 Atomics 与独立 SQLite 连接落实，不依赖计时碰撞。

## 可观察实验与负例

历史新增影响旧页边界；修订同时改变账户/市场/日期/检索字段及 null；withdrawn 排除影响 summary；同 ID 复活；精确时间平手以 id 排序。每一步逐页内容、排序、无重漏、总数、四项缺失计数与 pageSize=8/17 统计，既比较 full/incremental，也比较独立 source SQL + JS 字段统计 oracle 及冻结旧候选的独立全量 prepare 实现。受影响和未受影响分组一并核验，最小夹具覆盖旧账户/市场最后一条移出、新分组第一条移入。冲突 sourceVersion、非法 delta、三个失败点（source 后、projection 后、binding 后 commit 前）、连接关闭后重开、旧请求 version 回写拒绝纳入检查。连接重开不是独立进程重启或崩溃恢复。

id/executedAt 排序键明确限制为非空可打印 ASCII；非 ASCII 两个键显式拒绝，并保存测试先失败后通过的证据。否则 JS UTF16 与 SQLite UTF8/BINARY 次序可能不同。本轮不证明 Unicode 排序。symbol 可包含 Unicode，但检索沿用 JS lowercase 字面包含语义；不证明语言区域排序、归一化或用户预期的国际化搜索。日期是存储字符串前缀比较，不做时区折算。

## 成本与限制

单次轻量验证记录 wall、一次 cpuUsage delta、主/WAL/SHM、更新后首次读与 JSON 字节；identity/复制/初始化/检查点成本单列。非独占机器，已有多项服务（含 3333/4393）不停止不操作；没有 OS 冷缓存控制。正式耗时重复测量另需授权，最多三候选轮，保留失败及原始数据。结果仅说明本实验事务模型与非财务投影成本，不能证明产品更新通知、真实导入、完整首页性能或断电恢复。

名称、localized_name、accountLabel 均不在十字段合约；现有 bookVersion 不覆盖它们，本实验不扩容，也不得将 bookVersion 单独作为未来完整页面统一版本凭据。实验 identity 是这份有限投影的绑定，不是产品统一版本方案。
