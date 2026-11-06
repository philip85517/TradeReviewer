# 第5轮：后台已接通，完整页面一秒仍未通过

**结论：接受部分基础模块，暂停原问题的继续修改。** 写入后能创建待办，由独立进程计算并保存结果；结果有效时，首页现有内容可以快速读取。但更新后仍需等待完整计算，交易库和超时退出也未通过。恢复阶段已用5/5轮，旧5轮记录保留。

|用户操作|预期|实际|结论|
|---|---|---|---|
|打开已有结果的首页|完整内容≤1秒|现有内容约0.29–0.71秒；卡片为“—”、曲线不可用、历史未接线|完整页FAIL|
|改名后立即打开|从保存成功起≤1秒|页面约22.8秒才显示现有持仓|FAIL|
|首页进入交易库|完整记录≤1秒|1秒及16秒后仍加载，后来显示超时|FAIL|
|切换A股|到15秒停止等待并明确报错|15.966秒仍更新中，之后持续返回202|FAIL|

[预览首页](http://127.0.0.1:4397/home)使用隔离副本。未访问原业务库、提交、推送或合并；财务规则、Bars和并发继续暂停。下列展开项供技术复核。

<details>
<summary>实现、测试及数据保护</summary>

## 1. 已完成与未完成

真实写入触发持久待办；独立Node进程以独立连接读取快照，事务外计算，复核版本后原子发布。重启恢复待办，过时结果不替代当前版本。接口未准备时返回202，HTTP内不再执行完整构建。普通分组的原币结果持久复用，再按当次全库资格、汇率和时点组合；复杂情况回原路径，没有复制公式、猜测性质或把缺失填零。

**仍有大量全量工作。** 较宽的全局失效范围，以及准备、历史、持仓和来源证明，使写入后的第一次读取继续等待。批量接口还缺逐对象进度，取消也不能撤销已经入队的全局计算。后台化已接通，不等于实现了安全局部增量计算或一秒目标。

|检查|结果|证据与边界|
|---|---|---|
|队列、恢复、发布|root及Luna各125项通过|[后台审查](luna-backend-review.md)；完整Spec仍FAIL|
|分组持久结果|Luna专属41项、回归356项通过|[分组审查](luna-native-review.md)；只接受该模块|
|最终取消四文件|root及Luna各107项通过|[独立复审及浏览器反例附录](luna-cancellation-review.md)；真实15秒截止FAIL|
|生产构建|PASS|[日志](root-build.log)，Node26.0.0/SQLite3.53.0|
|集成全量|5773通过、97失败、6跳过，退出1|[摘要](root-full-suite-summary.json)、[独立分诊](luna-full-suite-triage.md)；在取消修复前30文件版本运行，最终34文件版本未重跑全量|
|Recovery身份刷新|最终版本仍FAIL|[当前单例](root-recovery-current.log)；[换回旧host仍失败](recovery-old-host-only-result.json)，完整根因未定位|
|95%分支覆盖|NOT VERIFIED|没有实际覆盖率统计，不虚报比例|

两个代表案例在归档旧源上也失败，不能把97项全称为旧问题。Recovery全旧源通过、当前失败；只换回旧host仍失败，说明新host不是必要原因，不能由此断定求值器有错。已保留失败，停止继续改动。

真实副本固定时点，原/候选业务字段逐项相同。原构建20.50秒；候选冷24.20秒、已有分组结果19.69秒。另一受控开关对照总耗时17.875→17.898秒，投影2.128→1.387秒：局部减少工作，全程未显著加快，样本少，不作统计结论。[等价记录](real-equivalence-v2-candidate.json) · [成本记录](cache-cost-v2.json)。

验收库来自已有隔离基线的WAL在线备份，原业务库没有打开。浏览器前62张原有表一致；浏览器后59张一致。1866条成交、213批导入内容未变，236个标的名称已还原，138条复盘业务内容一致。

隔离副本实际有变化：45条标的元数据更新resolvedAt或exchange/resolvedAt，另1条只改更新时间；1条复盘只改更新时间；设置trading-room.fx更新。因此不能称测试副本全库未变。隔离基线仍与备份清单一致；[最后再次复核](final-handoff-integrity.json)与浏览器后62表摘要完全相同（对最初副本有上述三表差异，检查退出1为如实报告）。[字段对照](final-data-diff.json) · [元数据差异](final-data-field-summary.json)。

</details>

<details>
<summary>桌面性能、控件与视觉证据</summary>

## 2. 计时口径和传输量

真实Chrome156、CDP鼠标/键盘输入；1440×1000、1440×900、1280×800，DPR1、100%缩放，生产构建。Codex内置浏览器连接两次失败，不能称内置验收通过。

下列时间仅是“现有期间区及持仓结束加载并绘制”，**不是批准设计的完整首页**。卡片未知、曲线不可用、历史未接线，完整一秒均FAIL。

|场景|现有内容绘制|证据及限定|
|---|---:|---|
|关闭HTTP缓存访问|706.90ms|[cold](final-cold-1440.json)；服务端结果已存在，不是数据库冷启动|
|再次访问|512.80ms|[second](final-warm-1440.json)；脚本默认仍关闭HTTP缓存，warm标签不能作真正热缓存证据|
|启用HTTP缓存的最终预览|364.50ms、收尾293.90ms|[warm](final-http-warm-preview-1440.json)、[handoff](final-handoff-preview-1440.json)；明确cold:false，仅两次样本|
|1280×800|429.50ms|[1280](final-desktop-1280-1280.json)|
|1440×900另一访问|29973.70ms|[900](final-desktop-1440x900-1440.json)；目录连续202，不能归因于宽度|
|本服务重启后首读|628.80ms|[restart](final-server-restart-1440.json)；保留有效持久结果，排除进程启动，未HTTP预热|
|保存名称后的首次打开|22765.00ms|[write](final-write-first-read-1440.json)、[写入回执](write-first-read.json)；目录等待约22.34秒，随后view约26ms|

保存名称耗时约129ms；保存成功到探针结束约23.0秒，22.8秒从导航计时。快速场景API合计约42.8KB为压缩后传输量（含网络头部），homepage-view原始JSON约269KB。写后场景48次API约83.5KB，时间主要用于等待。响应里的生成阶段timings是历史构建数据，不能当成本次SQL时间；写后命中当前读取约8.3ms，build=0。

每组20样本尚未完成，已有反例即停止，统计验收NOT VERIFIED，不报P95。原始CSV真实UI导入、确认、保存、返回与重载仍NOT VERIFIED；API改名不替代该闭环。

## 3. 实际操作和独立视觉

账户弹层打开/Esc、标的搜索无结果/Esc、持仓20→0→20、首条详情打开/Esc、分页1→2→3→1通过限定操作。首条详情不代表20条金额或全部控件通过。全部选项、全部控件和触屏没有完整证据。[桌面旅程](final-ui-journey.json) · [控件总记录](../CONTROL-AUDIT.md#8-恢复第五轮最终版本审计)。

交易库实际1秒及16秒后仍加载，后来出现超时；错误页真实返回首页及随后刷新仍未达到一秒。A股切换15.966秒后仍忙碌，16.460–18.509秒仍多次homepage-view/202；切回全部才200。具体根因尚未证实，不以推测继续修复。[取消网络记录](final-browser-cancellation.json)。

最新参考为`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`。Luna直接对照截图：主图表底部约639px，参考约547px，相差约92px；持仓标题约680px，参考约585px，首屏少约两行。旧版相同状态未齐，回归归因NOT VERIFIED。独立结论：**Spec FAIL / Quality Changes requested**。[视觉审查](luna-desktop-review.md)。

</details>

<details>
<summary>冻结版本、启动与暂停记录</summary>

## 4. 版本与预览

基线HEAD：`8c8c66c715be46e1e8a53d61d02b82f4fa13b22c`。最终1198个产品文件，较本轮基线34处变更；构建后、浏览器前后、收尾指纹均为`2a94e2aa6b58d5c15499581184ced492ab27bee103436c61dc1814b2c4e26ef0`。[冻结清单](final-prebuild-manifest.json) · [收尾清单](final-close-manifest.json)。

服务127.0.0.1:4397显式使用本目录acceptance-real.sqlite；3333属于其他工作树，未停止或复用。最后已用真实Chrome打开预览，服务保留运行。重启继续使用此隔离副本：

```sh
cd /Users/zhoulin/.codex/worktrees/38a0/TradeReview
PATH="$PWD/node_modules/.bin:$PATH" TRADEREVIEW_DB_PATH="$PWD/.scratch/homepage-db-optimization-20261105/write-precompute/acceptance-real.sqlite" ./scripts/native-node.sh scripts/start-local.mjs --hostname 127.0.0.1 --port 4397
```

端口占用先核对本服务，不改用原库。生产构建已存在；若重建，以相同隔离路径运行`./scripts/native-node.sh node_modules/vinext/dist/cli.js build`。

原HOME-DB-COLD保持open / acceptance-failed，Execution=paused。恢复5/5耗尽，不通过拆票重置次数；不再修改产品，下一次恢复需用户新授权。技术上仍有改进空间，此次停止来自已约定的轮次上限。

</details>
