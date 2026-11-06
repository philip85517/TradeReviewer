# 展示缓存失效与重启复用实验

candidate-01：实现者16/16轻量检查通过，等待独立审查及协调者接受。仅两条合成成交、私有SQLite，未接产品。

用成交版本加factDigest、presentationDigest、规则/代码身份识别持久缓存。三个展示字段分别变化时，成交版本和十字段摘要不变，旧缓存明确拒绝；显式刷新后只更新展示。真实独立进程重开未变数据时构建计数不变，同一child连接total_changes差值为0。双连接WAL屏障证明本原型持有读事务时旧/新快照一致，无事务负例能够复现混读。

当前产品启动fresh read，完整source payload已有digest；本实验没有证明当前产品存在旧名称bug。每次复用仍扫描并计算展示摘要，可能昂贵；不证明完整首页1秒。

## 可复核入口

在该worktree根目录，先核对协调者收到的SNAPSHOT.json SHA，再核对清单。清单核对只读文件，不打开数据库。

```sh
cd /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview
shasum -a 256 .scratch/display-cache-restart-experiment/SNAPSHOT.json
shasum -a 256 -c .scratch/display-cache-restart-experiment/SHA256SUMS
```

轻量检查命令如下。每次自行创建全新的.data/display-cache-restart-worker/sample-*私有库；不覆盖旧证据。该直接测试入口没有自动冻结门禁，审查者必须先执行上面的只读核对；未声称工具具备防篡改安全保证。

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/display-cache-restart-experiment/cache.test.mjs .scratch/display-cache-restart-experiment/restart-snapshot.test.mjs
```

DESIGN.md为边界，DESIGN-COVERAGE.md为版本绑定覆盖，RESULTS.md为通俗结论和原始证据索引，results/candidate-01为不可覆盖保存的最终证据。SNAPSHOT.json冻结代码、直接只读依赖、支持文档和历史/最终证据；SHA256SUMS不含自己及SNAPSHOT以避免循环。issue.md是可续写任务账本，不在冻结身份内。后续独立审查用新文件保存，不改冻结文件。

无产品代码修改、正式库、真实导入、财务、Bars、重复导入、浏览器或性能基准。真实跨表/跨进程接线、名称删除/显示优先级、HTTP缓存、分页游标、崩溃恢复、非ASCII排序均NOT VERIFIED。
