# CR01 / CR02 有限 Surface 候选：implementation-ready

2026-10-23；执行者 `/root/state_g61`，实际模型 `gpt-6.1-sol / ultra`。**源码与新测试已停止修改并冻结，等 ROOT-CHECKPOINT 独立验收。P3 正式仍 0/3；本报告不签 accepted。**

## 范围与原稿

本候选只修改 `app/components/homepage-v25/home-surface.tsx`，并新增 `app/components/homepage-v25/search-recovery.test.tsx`。先保留因果 RED，再实施一次有限产品补丁。CSS、尺寸、旧测试、host、session、S、Workspace、目录、依赖均未由本代理修改；未启动/停止服务、发 HTTP、操作浏览器或数据库。root 唯一明确要求的既有证据更正，是在 `P3/control-review/REPORT.md` 末尾追加旧 NR04 的真实可达性更新，原文及冻结证据保留。

已重读 HP03 `visual-design.candidate.md:130–160`（`HOME-HP03-B019`）、manual 搜索章 `370–455`、批准的 `P3/PRE-DISPATCH-STATE-CONTRACT.md:82–89`；直接查看精确参考 `search.svg`、`search-detail.svg`、`search-motion.svg`、`search-overlay-open.svg`、错误 `search--empty.svg` / `search-error-frame.svg`，及派生 `P3/reference-readback/sheet-1.png`、`sheet-2.png`。`search--detail.svg` 实为无匹配，已按内容分辨。CR02 同时涉及 HP09 `467–502` 的失败保旧数据/最新请求边界。root 在 DESIGN-COVERAGE 的 04:16 追加已映射 CR01/CR02 与 HV25-07/08/09/47/48/49；本代理不改共享 tracker。

| 缺陷 | 已有真实 RED 与最小因果 | 唯一候选行为 |
| --- | --- | --- |
| CR01 关闭重开丢结果位置 | root 真滚动至 816，关闭后重开 query 保留但 DOM=0；S 已保存位置，旧 restoreKey 去重 effect 不覆盖同挂载搜索 DOM 重挂 | `home-surface.tsx:132–136` 在搜索打开、结果可交互并已挂载时，将同一 S `resultsScrollTop` 消费到 DOM；不造第二份 UI 状态、不改 host restoreKey |
| CR02 loading/error 的 Enter 打开隐藏旧候选；方向键将 retry 当候选 | root 错误区域实际 Enter 打开旧 HKEX:2600；独立组件 RED 覆盖四种 rendered loading/error 分支，并捕获 error 分支方向键错误聚焦 retry | `:117–119` 统一 loading/failed/canSelect；`:206` 共享打开入口、`:310` 方向键、`:319` 输入 Enter 使用同一可交互边界，`:320–321` 渲染仍消费同一边界 |

既有 query、selected、trigger/input/result 焦点、源返回、IME composition 与 300ms 提交规则保留。既有 ArrowUp 索引公式未改；未扩大未复现规则修复。新增 layout effect 只同步已保存位置，不改变尺寸/布局/markup。

## 冻结源码

| 输入 | SHA256 |
| --- | --- |
| Surface 原始 RED 版 | `914f13c9cb429c40b76acf45a562168fbc4e309a6fdbaeb5248a52a2529f95b5` |
| Surface 最终候选 | `c6e14890fe36eb99e2dd03ba43608f7ced1ad482bdb57a757e09b8884f4d30b6` |
| 新测试原始 RED 版（保存在 `search-recovery.red-v1.tsx`） | `a78904f85eef64882bb9139b244539d596d88fa54faad1ff6f8c85f6394a82d3` |
| 新测试最终版 | `840df3f07bf2debfc5da27bb043ce523292b5fe45dc4a45c9984bac379e72ff5` |

产品完整差异见 `10-surface.diff`，新测试从原 RED 的演进见 `11-test-evolution.diff`。`SOURCE-MANIFEST.freeze.json` 绑定最终实际源码和受保护输入；`IMPLEMENTATION-FREEZE.json` 绑定本报告与相关证据。原 RED 清单、日志、`RED-FREEZE.json` 均未覆盖。

host 并行 SHA 从 `85731c88…` 变为 `3218407b84c45656989bc0a2ac700c9741e6c55135f55ed2873e7ed2b968b167`，准确归属为 **financial_g61 已授权 deadline 候选**，本次 Surface 组件测试不挂载/导入 host。`12-input-drift.json` 的旧 integration 归属推断有误，追加更正见 `13-PROVENANCE-CORRECTION.md`；原历史记录保留。不能由本报告推导 host/组合旅程已通过。

## RED → GREEN 与检查

全部采用固定 Node v26.0.0：`/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`。完整 stdout/stderr 与子进程退出状态逐次保留；`run-check.mjs` 的外层进程不代替 `.status.json` 中的真实子进程状态。

| 阶段 | 原始证据 | 结果与保留说明 |
| --- | --- | --- |
| 首次因果 RED | `01-red.log` / status | 10 项，5 FAIL / 5 PASS，exit 1；CR01 816→0、四种阻塞分支 Enter 改 selected/source；不是构造或导入失败 |
| 方向键相邻 RED | `02-red-direction.log` / status | 同 10 项，5 FAIL / 5 PASS，exit 1；error/account-error 下旧键盘 handler 聚焦 retry 的断言保留 |
| 单一产品候选初次 GREEN | `03-green.log` / status | 29/29 PASS |
| 初次有限 tsc | `04-tsc.log` / status | exit 2：仅证据 tsconfig 误列不存在的 next-env.d.ts；更正证据配置，无新增/修改产品生成文件 |
| 初次有限 lint | `05-lint.log` / status | exit 1：新测试 Harness effect 同步 setUi 触发规则；仅新 Harness 改为有条件的 render-time prop 调整，仍调用真实 S；产品候选未再改 |
| 最终定向 GREEN | `06-green-final.log` / status | **29/29 PASS，exit 0**；2026-10-22 20:24:56.617Z–20:25:25.286Z（04:24:56–04:25:25 CST） |
| 最终有限 strict tsc | `07-tsc-final.log` / status | **exit 0**；extends 项目 strict，noEmit/incremental=false，只列 setup 与两 owned 文件及其依赖 |
| 最终两 owned 文件 lint | `08-lint-final.log` / status | **exit 0，0 error，1 既有 warning**：Surface `detailId` hook dependency |
| 原 Surface 独立 lint 基线 | `09-lint-baseline.log` / status | exit 0，补丁前源码存在同一 `detailId` warning；无压制规则或额外产品改动 |

运行器既有 `DEP0205 module.register()` 弃用警告保留。未运行全量测试。

新 10 项使用真实 HomeSurface、真实 catalog/空持仓投影、已接受 S；同一 React mount、固定 restoreKey=17；无模块 mock，不以回调计数代替 UI 状态。独立 settled 旧目录跨 props/S 请求态保留，避免清空旧数据掩盖错误：

| 组 | 数量 | 可观察 oracle |
| --- | --- | --- |
| CR01 同挂载关闭/重开及详情源返回 | 1 | query=META、完整 selected 身份、保存 offset=816、DOM=816、result/trigger/input 焦点、A 股/账户/日期范围均保留 |
| CR02 not-ready/global-pending/global-error/account-error | 4 | region 只有 loading 或 error，无候选按钮；方向键不夺输入焦点；Enter 不打开详情、不改 selected/source/query/scope |
| 四种阻塞分支恢复 ready | 4 | 同挂载保 query，候选重现后 Enter 打开 META 完整身份；不使保护变成永久禁用 |
| settled 旧候选→IME→完成 | 1 | composition 与完成后 299ms 不提交/不打开；300ms 提交后 Enter 正常 |
| 既有 Surface/搜索/目录 | 19 | 原 `home-surface.test.tsx` 11、`search-surface.test.tsx` 4、`catalog-model.test.ts` 4，全通过，旧文件未改 |

最终命令（以下 `node` 均指上述固定绝对路径）：

```sh
node node_modules/vitest/vitest.mjs run app/components/homepage-v25/search-recovery.test.tsx app/components/homepage-v25/search-surface.test.tsx app/components/homepage-v25/home-surface.test.tsx app/components/homepage-v25/catalog-model.test.ts --reporter=verbose --maxWorkers=1
node node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P3/search-recovery-fix/tsconfig.search-recovery.json --noEmit
node node_modules/eslint/bin/eslint.js app/components/homepage-v25/home-surface.tsx app/components/homepage-v25/search-recovery.test.tsx
```

## 独立实际验收边界

root 原 `control-review/root/scroll-before.*`、`scroll-reopen.*` 与 `enter-error-before.*`、`enter-error-after.*` 仍是旧 Surface 的真实两个 FAIL，不以本次组件 GREEN 覆盖。root 需在新 Surface 与其独立冻结 host 的实际组合上复验；本代理没有浏览器权限，未创建或判定 root 正在追加的新真实证据。

jsdom 赋值 816 证明已保存 UI→新 DOM 的消费，不证明真实 scrollHeight、布局、动效或视觉；composition 事件验证逻辑，不等于物理输入法。实际键盘/鼠标、滚动/焦点/inert、原稿视觉比较、host 期限保护与 ordinary source-return、浏览器 storage/reload、真实错误与恢复均留给 root 的有界实际清单，仍 **NOT VERIFIED 于本候选报告**。不能将容器可见或 29 项通过写为整页/P3 accepted。

旧 NR04 真实可达性已在只读报告末尾更新：root `P1/round3/ROOT-NAVIGATION-RECOVERY-DIAGNOSIS.md` 提供 cold failure→返回 pending→search/onUi→实际 reload 的旧 host 受控 RED；不是原 Recall 原因或新 host 结果的证明。原结论与证据保留。

**此候选 implementation-ready；Surface 与新测试冻结，不再编辑。等待 root 独立验收，不推进其它 P3 实施，不自行签 accepted。**
