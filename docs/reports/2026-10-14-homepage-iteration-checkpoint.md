# 首页迭代阶段提交 — 2026-10-14

本次按用户“提交当前代码至远端分支”的要求保存首页迭代代码、测试及本摘要。分支为 `codex/homepage-iteration-20261011`。这是供评审和继续迭代的检查点，整体状态仍为 **acceptance-failed**，不能据此认定发布或合并验收通过。

## 当前代码范围

- 首页金融组采用生产者拥有的发布边界：更新期间保留已接受的市值、盈亏、数量、覆盖和历史图表；满足终态、回执及读回条件后接受新组。取消和失败不以可读缓存冒充完成。
- 补充导入后的重试、刷新和范围切换接线；交易身份计算排除行情派生指标，避免把报价变化误判为新成交。
- 总体 CNY 与分市场查看保留现有金融口径；汇率提示展示实际日期及汇率，现金诊断和估值诊断按来源呈现。
- 调整首页筛选、搜索、通知、窄屏入口、错误描述及代表状态样板；修复本地回环地址的图标协议生成。
- 为上述行为增加组件、边界、导入及工作区测试。二进制 XLSX 导入使用合成夹具，不提交真实账单。

## 浏览器验收冻结结果

18 个登记问题中，14 个在已记录的限定范围内接受，1 个为误报，3 个达到用户规定的最多三轮修复上限后仍未通过。限定接受不等于全功能接受。

| 状态 | 问题 |
| --- | --- |
| 限定接受 | BR01、BR02、BR03、BR04、BR05、BR06、BR08、BR10、BR11、BR12、BR13、BR15、BR17、BR18 |
| 误报，复核后更正 | BR16 |
| P1 / FAIL，3/3 封顶 | BR07：下载进度在普通与取消路径局部通过，严格逐标的任务归属仍有源码缺口，竞争边界未验证。 |
| P1 / FAIL，3/3 封顶 | BR09：in-range 集成单测在补齐 Worker、FX 和覆盖夹具后仍未达到 complete，最终根因未确定；未证明真实浏览器具有同一故障。 |
| P1 / FAIL，3/3 封顶 | BR14：通知面板正常底部打开及键盘路径局部通过，320×600 缩窗后仍裁切。第三轮已拒绝并回滚到第二轮版本。 |

P0 的已接受浏览器路径包括真实导入、取消后连续导入，以及失败起点→手动重试→终态的一次金融组发布→返回→匹配稳定重载。保留早期快速重载的严格比较失败及元数据差异；未把稳定重载外推为任何时点的整页完全一致。

浏览器使用真实应用、Worker 和 SQLite，行情 HTTP 提供方受控。完整账户、期间、生产者和竞争矩阵、真实外部报价准确性、物理触屏、真实中文输入法及实际 TLS/IPv6 监听仍未验证。原始失败记录继续保留，不因后续局部通过而删除。

## 本次提交前新鲜检查

- `git diff --check`：退出码 0。
- `npm run typecheck`：退出码 0。
- 以下定向测试：**7 文件、108 测试通过**，退出码 0。

```sh
npx vitest run \
  app/components/dashboard/holdings-publication-boundary.test.ts \
  app/components/dashboard/use-accepted-holdings-snapshot.test.tsx \
  app/components/dashboard/review-dashboard.part-a-stability.test.tsx \
  app/components/dashboard/review-dashboard.publication-boundary.test.ts \
  app/components/dashboard/use-holdings-valuation-refresh.test.tsx \
  app/lib/import/dispatcher.binary-import.test.ts \
  app/layout.metadata.test.ts --maxWorkers=1
```

本次未重新运行全量测试、生产构建或完整浏览器矩阵；定向通过不覆盖 BR09 的失败，也不改变整体验收结论。

## 数据与证据边界

本地验收使用显式隔离数据库，正式共享业务库未写入。数据库、原始账单、浏览器载荷、运行日志、依赖缓存及原始截图留在本地，不包含在本次远端提交中。完整的历史台账和证据保存在本地任务目录 `.scratch/homepage-part-a-20261011/`；本摘要保留远端评审所需的结论和限制，不声称远端含有全部原始证据。

后续仍按项目工作流和原验收记录推进。BR07、BR09、BR14 不自动开启第四轮修复；需要新的范围决定后再安排。
