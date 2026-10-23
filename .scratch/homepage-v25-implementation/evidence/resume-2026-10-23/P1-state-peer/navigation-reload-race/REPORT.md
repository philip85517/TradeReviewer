# P1 返回 pending / reload 只读诊断

实际模型：`gpt-6.1-sol / ultra`。观察及测试时间：2026-10-23 03:51:24–03:51:47 +08:00。HEAD：`5a94ee3ff76e32993fe2c4791a83b40e877a7344`。

## 结论与范围

**不能把 root 先前 Recall 返回后立即浏览器刷新最终落 all 的现象，归因为“返回先裸 /home”。** 在当前 host 上，正常已提交 A 股全部账户、保留 ROKU 查询 → 普通库 → 返回首页 pending → 立即内存硬重挂载，仍恢复 A/ROKU；pending 中发生一次 UI 回调也相同。裸地址的来源由 `history.state.hpSource` 保留，挂载会先读取它。

**另已复现一个有额外前提的来源覆盖窗口，以及一个不同的 API 抢占窗口。** 冷 `/trades` 的首次 owned read 失败后，host committed 仍为默认 all，readonly source 则为 A/ROKU。此时返回首页，navigation(A) 尚未完成期间：

1. `onUi` 把旧 committed all 编码回 source/history/storage，随后硬重挂载最终落 all、空查询（NR04）。
2. 直接调用 `host.reload()` 将 navigation(A) 替换为 refresh(committed all)，完成后写 all；旧 A 响应正确失效（NR06）。它不是浏览器刷新，当前可点击重试按钮有 pending 禁用，因此只记 API 可复现，未证明 root 当时调用了它。

这两项是确定的局部机制，不是原 Recall 事件已确认根因。root 最新稳定 A→ROKU 普通库→返回路径属于通过的对照。未修改产品、原测试、依赖或配置；未启动服务、访问浏览器/HTTP/业务数据库。request-body 候选仍未激活。

## 版本绑定与原始证据

完整前后指纹、命令和合成源副本见 [manifest-2.json](./manifest-2.json)、[source-2/](./source-2/)。所有所测文件前后相同，`stable:true`。

| 文件 | SHA-256 |
| --- | --- |
| use-homepage-host.ts | `74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2` |
| use-homepage-host.test.tsx | `327c1c9ce4b0587abf9618e70bb961f0c520defe8485c173689cc82cc5262caa` |
| session-model.ts | `828162fd03dcba7d4632a189444e54e1c4f0761d937c7bf0b4e4ad96abb4766e` |
| session-model.test.ts | `587f467f2aa78000f4d81ef6ee198373d05b3cd390e56de34b955c13c694be06` |
| home-surface.tsx | `6e79152cb0fd02b370a61f047dec3610cdaa946efea0bb76c0fdf9089aa8a6d1` |
| trade-review-workspace.tsx | `6d255f0e1ed1a0af1d094cedb769cfe7fd33c6164c87b46a8ba8f57944581d22` |
| homepage-v25-state.ts | `fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e` |

已完整读取当前 host、host test、session-model 和 session-model test；追踪 S 的 begin/complete/restore 与 surface/workspace 实际消费点。未重跑产品全量测试。

运行：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer/navigation-reload-race/run-2.mjs
```

固定 Node `v26.0.0`、Vitest `4.1.10`、单 worker、精确 include、实际 hook、jsdom 内存 sessionStorage/history、延迟合成数据。结果：[run-2.log](./run-2.log) **4 PASS / 2 FAIL，exit 1**；完整逐阶段输入输出：[traces-2.json](./traces-2.json)。`run-2.mjs` 故意拒绝覆盖同名证据；重验需使用新的证据输出标签/目录。

首轮 [run.log](./run.log) 与 [manifest.json](./manifest.json) 原样保留。其六项同样 4 PASS / 2 FAIL，但额外有证据采集 afterAll 的 `import.meta.url` 非 file scheme 错误。第二轮仅将证据输出改为 cwd 绝对文件路径；产品源未变，额外错误已消失。首轮源副本仍在 `source/`，没有将 harness 错误冒充产品失败。

## 真实调用链

所有行号绑定上述版本。

| 边界 | 当前行为 | 对本问题的含义 |
| --- | --- | --- |
| host:34、39 | 初始 session/route 从 DEFAULT_SCOPE all 创建 | 冷挂载最初有一个默认 committed；URL 尚未处理 |
| host:147–162 | ready 后优先 history.hpSource，否则 storage v3/v2；acceptAddress 后发首个 owned read | 源只载 UI；有来源不代表冷 trades 已提交它 |
| host:131–134 | `/trades` acceptAddress 只设 route 后返回 | 冷 trades 的 UI snapshot 可继续 all，route 则是 A |
| host:135–140 | `/home` 若裸地址或来源与地址等价，采用来源 scope；read=true 时发 navigation，read=false 时立即创建来源 UI | 裸 /home 有合法 hpSource 时不会仅因无 query 自动扩大到 all |
| host:198–218 | guard 允许后 push `/home`，hpSource 原样带入；acceptAddress 发 navigation；openHome Promise 在读取完成前返回 | root 观察到裸 /home / 目录 loading 的短阶段符合当前设计执行顺序 |
| S:258–263、303–309、378–380 | navigation 准备 draft/请求，保留旧 snapshot 直到成功；refresh 从 applied 建 token | 目标 A 与旧 committed all 可在 pending 中并存；不能预先改 applied 来遮掩 |
| session:12–16；host:100–108 | 匹配响应成功，先 complete，再恢复捕获的 sourceBytes；提交匹配数据后规范化 `/home?...` 并 persist | 正常完成后恢复 A/ROKU；source 与结果由请求闭包携带 |
| host:114–122 | 初始化读失败保旧 committed；清 pending、设 initialized，可显示恢复入口 | 可产生 route=A / committed=all / source=A 的有效失败态 |
| host:193–196 | onUi 更新当前 committed snapshot 的 UI 字段；只判断 initializedRef 与 home，即写 source/storage/history | 未区分“正在恢复来源”与“当前已接受首页”；NR04 的直接覆盖点 |
| host:220–223 | home reload 不取 source；无错误时 begin refresh，从旧 applied 取 target | NR06 的 navigation(A)→refresh(all) 抢占点 |
| host:82–83；S:323–325 | requestId、pending generation、scopeKey 校验 | NR06 迟到 A 正确拒绝；这里的失效机制不是坏掉的部分 |
| host:225–232 | focus/visibility refresh 明确要求 !pending | 没有证据支持“浏览器聚焦刷新自动抢占”这个归因 |

## 独立反例与精确序列

合成 source UI 一致为 `market=a,accounts=["*"],rangeMode=all`，search=`ROKU`、selectedSymbol=`NASDAQ:ROKU:stock`、search.open=true。目标普通库 URL 仍是 A 市场与该 NASDAQ identity 的交集，不切市场；探针不模拟业务行，不宣称它验证了普通库真实空集合。

| ID | 唯一关键序列 | 结果/排除能力 |
| --- | --- | --- |
| NR01 | A 首页 owned 成功 → openTrades(ROKU) → openHome navigation 未完成 → 立即卸载/重挂载 → 新 owned 成功 | PASS：未完成前后均 A/ROKU，最终规范 URL market=a。排除裸 /home 单独导致丢来源 |
| NR02 | NR01 加 pending onUi(scrollTop=25) → 硬重挂载 | PASS：旧 committed 本身 A，因此同回调不导致范围或查询丢失 |
| NR03 | 冷 `/trades` 首读失败 → openHome navigation(A) pending → 不发 onUi → 硬重挂载 | PASS：即使旧 committed all，只要 hpSource 未被覆盖仍恢复 A/ROKU |
| NR04 | NR03 加 pending onUi(scrollTop=25) → 硬重挂载 | **RED**：onUi 之前 history/storage=A+ROKU；之后二者立刻 all+空查询，route/导航请求仍 A。重挂载最终 `/home?scope=live&market=all&accounts=*&rangeMode=all` |
| NR05 | 冷首读失败 → openHome → 先接受返家 A 响应 → onUi → 硬重挂载 | PASS：窗口随来源恢复成功而结束 |
| NR06 | 冷首读失败 → openHome navigation(A,g4) pending → host.reload() → refresh(all,g5) 先成功 → 旧 g4 迟到 | **API-only RED**：g5 提交 all+空查询、source 同步 all，g4 不再提交；data 保持 newer-refresh |

NR04 最小跨层字面事实：

```json
[
  {"stage":"return-read-pending","url":"/home","committedMarket":"all","committedQuery":"","request":{"purpose":"navigation","targetMarket":"a"},"historySourceMarket":"a","historySourceQuery":"ROKU"},
  {"stage":"pending-ui-callback","url":"/home","committedMarket":"all","committedQuery":"","request":{"purpose":"navigation","targetMarket":"a"},"historySourceMarket":"all","historySourceQuery":""},
  {"stage":"hard-remount-accepted","url":"/home?scope=live&market=all&accounts=*&rangeMode=all","committedMarket":"all","committedQuery":"","historySourceMarket":"all","historySourceQuery":""}
]
```

**单一最小假说 H1（已验证）**：当导航将从 source 恢复不同于旧 committed 的首页时，pending UI 写入仍把旧 committed 当作新 source。NR03/04 仅差一次 UI 回调；NR05 仅将该回调移到成功提交后，失效现象消失。无须更改 S 或引入第二状态模型解释此结果。

**独立 H2（已验证 API，真实触发 OPEN）**：home 显式 reload 未保留 pending navigation 的目标/来源，按 S 正确的 refresh(committed) 语义发起不同目标。NR06 的迟到失效反而证实 token 校验在工作。不能把它与浏览器刷新混称。

## UI 可达性、现有测试缺口与待证部分

Workspace `5801` 的“我的交易室”导航调用 `openHome`；`6058` 已 initialized 的普通库“返回首页”、`6059` 错误恢复入口也调用它。初始化失败会设 initialized=true，因此 NR04 的“失败后返回”有对应产品入口，不需伪造业务 source。

Surface `248` 的搜索 trigger 没有 pending 禁用，会调用 onUi；`252` 主滚动容器和 `310` 搜索结果滚动也调用 onUi。NR04 使用它们共用的 `onUi({scrollTop})` 边界。**没有实际点击/滚动浏览器**，也没有断言打开显示区域会自动触发 scroll；这些事件的自然时序与 root 原现场是否吻合仍 NOT VERIFIED。要确定用户旅程，只需 root 在有合法来源的 cold trades 首读失败/超时后返回，pending 中操作搜索或滚动，再刷新，检查上述三阶段。

`host.reload` 消费点是 Workspace `5994` 的 onReload 和 `5997` 更新数据 Promise 完成回调；Surface `254` 首页错误重试在 pending 时禁用，`311` 目录重试被 pending loading 分支遮住，`327` 更新数据按钮也 pending 禁用。尚未证明用户可以在这个窗口直接点击 NR06 对应动作；已有更早 repair Promise 后续完成是否可触发，也未注入探针，不作推定。

当前 host 原测试“direct collection read failure recoverable”先成功 retry，再返回，故返回前 UI 已恢复来源，避开 NR04；“direct homepage date through reload”未开启 readOnInitialize，亦不能覆盖冷 trades default committed 的窗口。原测试有效，缺的是不同失败态和 pending UI 写入的组合反例。

内存卸载/重挂载只模拟 browser reload 保留地址/history.state/sessionStorage、新 JS owner 重新初始化的边界；旧挂载未完成的合成 Promise 故意不再 resolve，以避免把 React 卸载后仍存活的测试闭包误当已销毁浏览器上下文。真实浏览器 entry 持久性、刷新中断、React/surface 效应、Recall 保存流程均由 root 验证，本报告不签 P1 正式接受。

原 Recall 事件仍 **OPEN**。若 root 重现时已确认 pending 前 committed=A 且 history.hpSource=A，NR01/02 是直接反证，不能套用 NR04；应记录首次从 A/ROKU 变更的 source writer、挂载边界与读结果。最小观察点为：openHome 前、acceptAddress 后、每次 persist 前后的 UI scope/query 与 pending purpose/generation、reload 后初始化选取的是 history 还是 storage。只需 UI 值与相关 generation，不需读取请求 body 或业务行，不需激活 request-body 观察器。

供 owner 后续裁定的约束是：pending 返家时来源的存续应独立于旧 committed，读取失败应继续保留合法来源；不要通过预先提交未成功范围、重置 S 或隐藏 unknown/错误来消除该状态。本任务仅给已证实边界，未实施修复。
