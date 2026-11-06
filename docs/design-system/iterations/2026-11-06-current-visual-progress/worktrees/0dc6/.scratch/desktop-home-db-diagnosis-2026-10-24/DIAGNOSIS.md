# 当前桌面首页：数据库已连接，首页数据尚未成功发布

协调者 /root，2026-10-24。按 systematic-debugging 先取证、再分层归因；本轮未执行产品修复、数据库写命令或运行配置变更。现存页面可能存在自动保存，不据此断言整个浏览器会话数据库完全无变化。

## 当前版本与真实浏览器

- 工作树 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`，detached HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，包含此前未提交开发。
- [内容 manifest](CONTENT-MANIFEST.json)：887 个产品、配置及工作流文件；与上一轮冻结内容相比无变化。manifest SHA256 `6b7b03e19087fff38309a4eb0e946ab61fb0b6324d0c805f08a0e7915592d78f`。
- 实际检查 URL：[当前首页](http://127.0.0.1:3333/home?scope=live&market=a&accounts=*&rangeMode=all)。读取用户已打开的页面，没有主动刷新或更改 URL。
- manifest 冻结的是磁盘内容；本轮未逐模块核对 dev server 的内存编译版本，当前页面未重新初始化。不能把该内容清单解释为完整新构建/刷新验收。
- 2026-10-24 10:24:30 +08:00 固定 CSS 视口 **1440×900**、DPR 1、visualViewport scale 1；截图像素也为 1440×900。原视口为 347×694，不作为本轮桌面证据。收尾已清除临时视口覆盖；清除后测得 1440×900 / DPR2，不声称已恢复原尺寸，见 [恢复记录](VIEWPORT-RESTORED.json)。
- 页面 `window.scrollX/Y=0`；实际滚动容器 `.hp-home-scroll` 为 1353×836，scrollHeight 1813、scrollTop/Left 0。[完整环境](BROWSER-ENVIRONMENT.json)、[桌面截图](DESKTOP-HOME.jpg)、[DOM](DESKTOP-DOM.txt)。
- 本轮只检查数据加载、终态反馈与只读原因弹层。完整设计视觉比较、全部控件、键盘/触控、写入/返回/刷新不在本轮诊断范围内，不能据此宣称首页交付通过。

## 1. 真实数据库连接成立

当前 3333 listener PID **29149** 的 cwd 为该工作树，lsof 确认其打开 `conf/runtime.json` 所指向的共享业务库及 WAL/SHM：

`/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`

新鲜只读业务快照与 10:25:56–57 +08:00 的 `/api/storage/status`、`/api/storage/trades` 相互核对：

| 数据 | 业务库 | API | 完整 ID 多重集合摘要 |
| --- | ---: | ---: | --- |
| 成交 | 1866 | 1866 | 一致 |
| 导入批次 | 213 | 213 | 一致 |
| 标的 | 236 | 236 | 一致 |

两个 API 均 HTTP 200、`Cache-Control: no-store`。`status.databasePath` 是脱敏文件名，真正路径结论依赖进程打开文件证据。见 [API 取证](runtime-api-approved-attempt.json) 和 [运行审计](RUNTIME-AUDIT.md)。

**因此，当前首页空白不能解释成服务未打开真实数据库。** 连接成功也不能证明首页财务数据已被接受并渲染。本轮未主动调用可能填充汇率缓存的 FX 接口。

## 2. 当前直接失败：首读超时，首页没有接受财务数据

桌面页面实际显示：

- 顶部“读取已超时，新范围未应用。”；四张指标为 `—`，状态为 `timeout`。
- 期间按钮禁用，仍显示“期间数据读取中”；曲线提示“期间数据尚未就绪”。
- 持仓为 0，同时显示“当前范围暂无持仓”。

代码链路由协调者复核：

1. `trade-review-workspace.tsx:2233–2276` 的 `readHomepageBundle` 同时读取原子 stored snapshot 和 FX，等待 aliases，再对**全部** summaries 读取日线状态，构建 entries 并完成 acquisition。当前调用未向这些读取传递 host 截止取消信号；日线读取直接使用 `Promise.all`。
2. `use-homepage-host.ts:138–172` 在结果及全局 domain 提取后分别核对截止时间；`296–313` 的 15 秒定时器将超时请求结束。过期结果不能发布，这是数据安全门，不能靠延长预算消除症状。
3. `trade-review-workspace.tsx:2288` 的初始 domain 为 `view:null`、空 holdings。首读失败没有新 domain 提交，`2346` 仍取该空初始结果。
4. 超时会让 host 初始化结束；`6245` 给 HomeSurface 的 `ready` 只检查 `homepage.initialized && storageState === "ready"`，并不代表财务 source 已接受。因此空初始结果被 `home-surface.tsx:331` 显示成真实“暂无持仓”。**这个 0 不是已核对的真实持仓数量。**
5. `period-surface.tsx:58–70` 将 `view:null` 一律呈现为“读取中”和“尚未就绪”，即使全局已是 timeout；卡片收到全局 error，因此同一页面同时出现终态错误与加载文案。

指标“查看原因”鼠标打开后，真实弹层显示“期间数据尚不可用”“timeout”“当前范围没有可计算指标”；关闭按钮正常关闭并回焦。[弹层 DOM](METRIC-REASON-DOM.txt)、[截图](METRIC-REASON.jpg)。这进一步证明当前 UI 没有拿到可展示的 view，不证明没有数据库记录。

### 当前尚不能确定的性能细分

本轮读取的是已经打开并处于超时状态的页面，未捕获其初始网络时序/当前版本 CPU profile。能够确认超时终态和阻断发布的机制；**不能断言本次全部耗时都来自 SQLite、网络、日线或 SHA 中的某一项**。[浏览器日志](BROWSER-LOGS.json)没有已捕获 error/warn，不等于全程没有错误。

此前 19.245 秒分段、12.121 秒 Node 发布前路径以及编码/摘要 CPU 结果是已保存的诊断线索；历史分段记录的 workspace hash `acf7d…` 与当前 `4a653d…` 不同，不能当作本轮新性能测量。后续性能修复需在隔离快照上冻结同一版本、分别测 I/O、prepare、complete、own、projection、UI publish，并按原预算验收。

## 3. 独立口径差异：旧券商交易不满足首页严格 live 资格

API 返回的 1784 笔旧券商成交没有 `source.tradeNature` / `source.tradingNature`，另有 82 笔明确 simulation。结合 `types.ts:207–208` 的实际领域函数，分别为 1784 unknown、82 simulation；不是仅凭 SQL NULL 得出结论。

普通交易库 `displayTradeNature` 会把富途、老虎、招商的旧记录推导显示为 live；首页 `explicitLiveEntries` 则要求成交通过 `tradeNatureOf` 明确为 live，不能沿用普通库的显示推导。于是当前库存没有满足该严格条件的成交；账户目录、资格分组和后续 holdings 都受影响。见 [完整源码链](SOURCE-TRACE.md)。

这解释了为何普通交易库能显示旧券商交易，而首页严格范围可能仍为空。[当前两个实际函数的纯探针](source-policy-probe.json)确认 unknown→display live 为 1784 条；探针没有网络或数据库操作。但**当前桌面 0 行首先来自超时未提交的空初始结果，不能把它当作已经完成严格筛选的结果**。修复性能后，这一口径差异仍需处理；应保留来源证据并明确统一资格规则，不能为显示数字而把所有 unknown 无条件改为 live。

## 4. 历史区确实尚未接线

`home-surface.tsx:337` 硬编码“历史统计与贡献将在后续阶段接入”；workspace `2306` 的 `reloadHistory` 恒抛出“历史财务读取尚未接线”。该区无数据是当前实现边界，不能通过切换数据库或更改桌面宽度解决。另有 `all` 期间的来源完整性缺口：当前 acquisition 传入空的 lifetime coverage 与历史 FX observations，不能用首笔成交代替完整生涯边界；详见源码链。

## 后续统一处理边界

应共同处理来源读取/取消和性能、终态传播、严格 live 来源资格及历史接线，再逐项独立验收。数据库路径不需要再次切换。保留金额、来源验证、15 秒、核心性能和缓存原合同；不能用假空值、跳过校验或延长 deadline 作为通过依据。

本轮仅完成诊断。P1/F07、ContributionBars 原 **3 / 3 FAIL / 暂停** 和原任务失败证据继续有效，本次不产生第 4 轮。真实库初始化曾存在自动复盘/metadata 写入；本轮没有主动刷新真实库或绕过此前的刷新审批拒绝。后续需要重新初始化取证时应使用 WAL-aware 隔离快照及显式 DB 路径，先验证其写入边界。
