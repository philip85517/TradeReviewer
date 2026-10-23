# P3 搜索恢复：有限因果 RED

2026-10-23 04:20 CST。执行者 `/root/state_g61`，实际 `gpt-6.1-sol / ultra`。仅完成 root 授权第一阶段，**RED-ready；未改产品，未签 accepted，P3 正式仍 0/3**。此处不是 implementation-ready。

## 版本、范围与输入依据

新增且仅新增产品目录测试 `app/components/homepage-v25/search-recovery.test.tsx`。未改旧测试、Surface、CSS、host、session、S、Workspace、目录实现、依赖或配置；未启动/停止服务，未发 HTTP，未操作浏览器/数据库。唯一历史文件变动是 root 明确要求的 `control-review/REPORT.md` 末尾 NR04 追加更正；原文及旧冻结清单保留。

被测 Surface SHA256：`914f13c9cb429c40b76acf45a562168fbc4e309a6fdbaeb5248a52a2529f95b5`。S：`fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`。host 当时为 `85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`，本测试不挂载 host，不能据此签 host 修复。前后逐文件指纹见 `SOURCE-MANIFEST.red-before.json` / `SOURCE-MANIFEST.red-after.json`；测试与证据最终指纹见 `RED-FREEZE.json`。

已重新阅读 HP03 正文 130–160（`HOME-HP03-B019`）、manual 搜索章 370–455，及已批准 `P3/PRE-DISPATCH-STATE-CONTRACT.md` 搜索链 82–89；已直接查看精确 SVG 派生的 `P3/reference-readback/sheet-1.png`、`sheet-2.png`：`search.svg`、`search-detail.svg`、`search-motion.svg`、`search-overlay-open.svg`、请求失败 `search--empty.svg` / `search-error-frame.svg`。`search--detail.svg` 实为无匹配，不能按文件名错分。

| 覆盖 | 原稿/契约 | 当前 owner 与行为 |
| --- | --- | --- |
| CR01；HV25-07/08/09 | HP03:130–160；P3 契约“关闭保词与位置”、开启恢复上下文 | Surface 消费同一 S `search.resultsScrollTop`；同挂载、`restoreKey=17`，非零位置关闭/重开保 query/selected/焦点/范围 |
| CR02；HV25-08/09/47/48/49 | HP03:137–160；HP09:467–502；manual:431–435、446–454 | Surface 不允许加载/错误时 Enter 激活未显示的旧候选；保留旧 committed/catalog，不清空数据掩盖问题 |
| IME 相邻 | HP03:137；manual 搜索加载/键盘规则 | composition 中保旧查询且 Enter 不开详情；结束后 299ms 不提交，300ms 提交，之后 Enter 可用 |

`DESIGN-COVERAGE.md` 已由 root 在 04:16 追加 owner、原稿及证据映射，本代理不修改共享 tracker。

## 命令与原始结果

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/search-recovery.test.tsx --reporter=verbose --maxWorkers=1
```

唯一一次运行：04:19:24 开始，Vitest 4.1.10、Node v26.0.0、jsdom；**10 项，5 FAIL / 5 PASS，exit 1**。完整 stdout/stderr 未截断保存在 `01-red.log`，开始/结束/命令/退出状态见 `01-red.status.json`。失败均为预期行为断言，不是导入/构造/超时错误。保留既有运行器 `DEP0205 module.register()` 弃用警告，未动依赖消除它。

## 逐项结果与因果

| 测试 | 期待字面 oracle | 实际 | 结果 |
| --- | --- | --- | --- |
| CR01 同挂载、同 restoreKey | 结果 scrollTop=816；query=`META`，selected=`NASDAQ:META:stock`，输入焦点与 A 股日期范围保留 | S 已保存 816；详情返回同 DOM 仍 816；关闭后触发器获焦；重开 query/selected/输入焦点/范围均正确，但新结果 DOM 为 **0** | FAIL |
| CR02 `not-ready` | region 仅 loading，无候选；Enter 后无详情、selected=`(none)`、source 全 null | 确实没有候选 DOM，Enter 却打开 Meta Platforms，selected/returnState 变为该完整身份/detail 来源；全局范围与 query 未变 | FAIL |
| CR02 `global-pending` | 同上；真实 S refresh 请求 pending，region aria-busy=true | 同上，详情被打开（查看交易虽禁用，但错误打开/来源变更已发生） | FAIL |
| CR02 `global-error` | region 仅错误+重试；Enter 不变 selected/source | 同上，旧候选被打开，selected/returnState 被改写 | FAIL |
| CR02 `account-error` | region 仅错误+重试；Enter 不变 selected/source | 同上，旧候选被打开，selected/returnState 被改写 | FAIL |
| `not-ready → ready` | 同挂载、旧 query 保留，候选重现后 Enter 打开完整 META 身份 | 满足 | PASS |
| `global-pending → ready` | 同上，通过真实 S 请求成功接受恢复 | 满足 | PASS |
| `global-error → ready` | 同上，通过真实 S 新请求成功接受清错误 | 满足 | PASS |
| `account-error → ready` | 同上，账户状态恢复，query 未丢 | 满足 | PASS |
| settled 旧候选→IME→完成300ms | composition/299ms 不提交或开详情；300ms=`Meta Platforms`，随后 Enter 打开；来源/范围在等待时不变 | 满足 | PASS |

四个隐藏候选反例使用软断言同时保留“详情、selected、source”三处错误，共 13 个失败断言归属上述 5 个失败测试；不是 13 个独立问题。正例独立于失败断言运行，不以条件清理把失败隐藏。

Harness 使用真实 `HomeSurface`、`buildHomepageCatalog`、空真实持仓投影及已接受 S。仅通过 props/真实 S refresh 成功或失败构造前态；同一 React mount、同一 restoreKey、始终同一已接受目录。查询 debounce、详情选择、滚动事件、关闭、重开与 Enter 都走真实 handler。测试未 spy/mock 模块或断言回调次数；输出展示真实 S 的已提交搜索、选中、来源与范围用于观察。

CR01 最小根因仍是 `home-surface.tsx:143–150` 的 host restoreKey 去重边界无法覆盖 `:293` 搜索 DOM 关闭卸载后的重挂，`:193–196` 已正确保存滚动。CR02 最小根因仍是 `:100` 计算旧已接受目录结果，`:311` 隐藏候选，但 `:309` Enter 没有使用同一 ready/pending/error 可选择边界；`openSearchDetail:197–202` 随即改变 selection/source。本阶段没有修复。

## 证据边界与下一步

jsdom 不做真实滚动布局；测试赋值 816 只隔离“已保存 UI 到新 DOM 的消费”因果。真实 816/client406/scrollHeight9753 的关闭重开失败由 root 原 `control-review/root/scroll-before.*`、`scroll-reopen.*` 支持。本阶段没有创建新浏览器证据。CR02 错误态原 root 真实操作见 `enter-error-before.*` / `enter-error-after.*`；其余三分支新增的是组件 RED，不能写成真实浏览器 FAIL。

新测试未走 ordinary 导航、浏览器存储、actual IME、视觉/断点/动效或真实端到端恢复。这些仍由 root 按原清单在最终产品指纹验收；原 root 两 FAIL 和其余 NOT VERIFIED 均保留。

旧 host NR04 的原句已追加更正：root `P1/round3/ROOT-NAVIGATION-RECOVERY-DIAGNOSIS.md` 已证明其受控 cold-failure→返回 pending→实际打开搜索/onUi→实际硬 reload 的可达性。它不能反推原 Recall 原因或新 host 结果，也不能把 NR06 API 当浏览器 reload。

**在 RED 阶段停止。等 root 完成 host 实际复验后，才可由 root 另行授权唯一 Surface 有限补丁；当前未进入 GREEN。**
