# 真实生产应用隔离浏览器验收

Result: PASS（部署后启动、数据加载与重新加载）
Coordinator: /root
Last observed: 2026-10-06T02:08:00.047Z / 10:08 +08:00
Browser: Codex In-app Browser，真实页面，已标记交付保留。

入口：[http://127.0.0.1:61739/](http://127.0.0.1:61739/)。应用快照 63690a494b8ad403081c7720985be54a95db60c7，发布工具来自最终工作区。独立 npm ci/build、同端口切换、安装后目标 Make rollback 均执行，见 [部署](production-deploy-accepted-final.log)、[回滚](production-rollback-final.log)、[status](production-status-final.log)。实际 PID 95630、release 20261006T020332Z-05fdf32bd1，healthy=true / consistent=true。

最终回滚后 reload，短暂 SQLite 连接/加载，随后可见标题“我的交易室”。DOM 有主导航、交易性质/账户筛选及持仓区域；全部账户、当前空仓、持仓数 0 符合唯一隔离空库。浏览器 error 日志 `[]`。只执行加载/重新加载，没有 UI 写入。此记录不声称视觉保真、交易持久化、图表回放或触屏验收。

运行目标：`/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/tradereview-production-smoke-h3m9zqd7/target`。
独立数据库：`/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/tradereview-production-smoke-h3m9zqd7/isolated.sqlite`。
正式 3022 / PID 42336 未改变。隔离实例保留运行；临时验收目录不替代正式位置。

停止隔离实例：

```bash
make -C /var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/tradereview-production-smoke-h3m9zqd7/target deploy-down
```

之后从 Git 工作副本重新部署：

```bash
env -u TRADEREVIEW_DB_PATH -u TRADEREVIEW_RUNTIME_CONFIG \
  make deploy REF=63690a494b8ad403081c7720985be54a95db60c7 \
  DEPLOY_ROOT=/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/tradereview-production-smoke-h3m9zqd7/target
```

目标已有配置保留，仍使用隔离数据库与端口。正式使用见 [发布指南](../../../deploy/DEPLOYMENT.md)。
