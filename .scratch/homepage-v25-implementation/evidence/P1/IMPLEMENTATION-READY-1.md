# P1 implementation-ready — 第1轮候选冻结

2026-10-23；唯一实现 owner `/root/integration_g61`，gpt-6.1-sol / ultra；root 独立接受。提交此候选进入恢复第1/3轮，**不是交付通过**。按 root 指示已停止产品修改，等待集中反馈；P2–P4没有实施。

29个本票源/测试文件精确指纹见 `source-manifest.freeze-1.json`。文件集合 SHA256：`766c4cc69c7075be36ef61abe772129c04950b3cb7c5a2ce6966563a8a0fed9f`。host=`67ca968a215963a648c09033ac76f65a2c321b23f88e896f71aa18693c2ca4b9`；workspace=`55e40ada6ba54e64fe1e714eeca7af7a267822471fff5169ce1761b6af52db8c`；session=`45e73c3b315b75f1660d6829694272d0d5bfcd1f51452a95fcacd2accf652973`；holdings=`8fe5dd40ad258f48bbc3cddee16f925798b8ecb089caf03f6991a2f7ab45621c`。

S消费已接受v2源 `ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`；A为准备合同接受。F current additive消费合同为 `1e9757d35b09ade0debdc6ef08c6a49ffa78bb607383ce49d16efd5cbe79abf5`；root已证明完成交易时段截点的新反例，F正在有限修复，**该依赖重开/NV，早前F2 PASS不能覆盖**。manifest记录本次实际读取的输入哈希；F后续更改不属于P1 owner冻结源。

## 可运行首旅程

服务由root管理，现有 `http://127.0.0.1:3333/home?live=true&market=a&accounts=p1-count-09&range=all`（参数别名由S归一化）。无需新服务或共享layout改动。root此前已在明确隔离 `.data/tradereview-test.sqlite`运行种子并确认首个owned读取可得到真实持久化报价；本owner没有操作浏览器/服务/数据库。

1. 选P1 09账户；设非默认查询/名称降序/第2页及持仓附近滚动位置。8槽/摘要保持固定，检查同证券不同账户实例与明确unknown。
2. 鼠标或键盘打开该行详情，核对account+episode、可信交易所、数量、真实行情日期、当前净UF。外点不关；Esc/关闭回准确行；唯一“查看交易”进入同身份普通`/trades`集合，无queue/自动首回合。
3. 用成交日期URL范围覆盖未平仓成交；列表含open且保完整回合复盘上下文，统计继续按close-date投影。主动选回合后走既有真实保存和离开guard。
4. root在隔离数据上做受控新数据/保存；返回首页，owned read重新读取bootstrap/行情/FX，再恢复完整S白名单UI。分别验证显式返回、reload、back、forward与取消guard；不能以测试fixture恢复代替。
5. 两宽1440×1000 /1280×800、100%及真实DPR独立原图比较；当前P2/P4区域明确未接入，不计作那些业务区PASS。

种子 `seed-isolated.mjs` 拒绝默认/业务路径，必须显式`--db`且写入时`TRADEREVIEW_DB_PATH`相同；原83 fills/52 candles已由root运行。最新版新增已查官方SEC AAPL exchange记录，若验美股可信identity需root**显式重跑**：

```sh
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.data/tradereview-test.sqlite /Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --experimental-strip-types .scratch/homepage-v25-implementation/evidence/P1/seed-isolated.mjs --db /Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.data/tradereview-test.sqlite --as-of 2026-10-23 --fx complete
```

该命令供root执行，本owner未运行写入。此前dry-run日志56只验证计划，没有打开DB。官方依据见`official-exchange-source.md`，未知US保持待解析。

## 实际检查与精确命令

以下Node均为 `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`，cwd为本worktree。保留01–64所有RED、失败和修正前日志；不覆盖历史。

|检查|实际结果|证据|
|---|---|---|
|home+library state+metadata/providers/resolve/IDB/SQLite/API定向|11文件175 PASS|52-targeted-final.log|
|冻结后全部home模型/会话/host/surface|4文件24 PASS，含真实补偿pop事件顺序、首owned读、乱序归属、fresh目录、详情刷新/移除、IME与unknown显示|64-home-frozen.log|
|库相邻真实组件3用例|3 PASS、45未选择|57-library-neighbor.log|
|Workspace首旅程及4个既有回归|2 PASS / **3 FAIL** /87未选择|53-workspace-journey-regression.log；加地址隔离复跑59仍同3FAIL|
|冻结strict tsc|exit0|63-types-frozen.log|
|冻结home+Workspace lint|exit1：仅Workspace既有cash effect 1 error/10 warnings；home新增错误已清|62-lint-frozen.log|
|HEAD Workspace同命令baseline lint|同cash effect 1 error/10 warnings，未豁免或改无关cash语义|60-workspace-baseline-lint.log|

```sh
NODE_BIN=/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node
"$NODE_BIN" node_modules/vitest/vitest.mjs run app/components/homepage-v25 app/components/library/library-browse-state.test.ts app/lib/instruments/metadata-contracts.test.ts app/lib/instruments/providers/metadata-providers.test.ts app/lib/instruments/resolve-service.test.ts app/lib/storage/indexeddb-instrument-metadata-repository.test.ts app/lib/storage/sqlite-store.test.ts app/api/storage/instruments/metadata/route.test.ts
"$NODE_BIN" node_modules/vitest/vitest.mjs run app/components/homepage-v25
"$NODE_BIN" node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.test.tsx -t 'connects the production homepage|keeps the parent review mounted until a failed navigation|keeps a successful typed save observable|returns to the library with its expanded stock context|opens stock entries in the shared workbench'
"$NODE_BIN" node_modules/typescript/bin/tsc --noEmit
"$NODE_BIN" node_modules/eslint/bin/eslint.js app/components/homepage-v25 app/components/trade-review-workspace.tsx
git show HEAD:app/components/trade-review-workspace.tsx | "$NODE_BIN" node_modules/eslint/bin/eslint.js --stdin --stdin-filename app/components/trade-review-workspace.tsx
```

## 3个FAIL与已知边界

- **`keeps the parent review mounted until a failed navigation save is retried successfully`**：实际未到guard步骤，在`renderGoldReplay`查找`复盘自由黄金-DRS`按钮失败。已确认fixture的source缺tradeNature（测试:872），首页→新普通库路径是explicit-live；这解释候选数据被过滤，但**不据此宣布fixture可豁免**，全局普通库与来源范围是否应分开仍由root本轮裁定。不是保存失败已被验证。
- **`keeps a successful typed save observable when summary refresh fails, then retries with reads only`**：保存后找不到`现金状态`（测试:1363）；此前该状态属于旧room呈现。当前只确认失败点，是否为首页替换影响旧信息可达性、请求次数变化或真正持久化回归尚未定性，不能声称保留了实际现金保存流。
- **`returns to the library with its expanded stock context after opening a library round`**：点击主导航后等待`交易库`region超时（测试:5439）。fixture亦nature缺失，但**route/catalog/初始化时序是否另有因果未证明**，不把缺nature当完整根因。地址和sessionStorage逐测试清空后依旧FAIL（59），原“测试串场”假设已被反例否定。

state peer在冻结时报告broad trade-merge可绕过narrow metadata validator，可能把不可信exchange传至首页identity。其静态链指向sqlite-store.validateInstrument/putInstrument，需独立源绑定报告/RED；本轮已知待审风险，未以narrow API测试PASS覆盖。只读报告未授权继续改源，按root要求等待集中反馈。

空账户当前下拉只显示“暂无实盘账户”，尚无设计要求的导入动作；真空持仓仅说明、无独立下一步按钮。该已知实现缺口明确**FAIL/待本轮裁定修复**，不从控件分母移除。标题和值完整读数目前使用原生title/focus，Enter/Esc说明交互和触屏可达性未通过真实浏览器验收。

## 三门槛

功能：**FAIL（3既有回归+上述已知缺口）**，新定向PASS仅限定测试范围。完整真实旅程/持久化：**NOT VERIFIED**。两宽视觉、窄屏、mouse/keyboard完整控件、emulated/physical touch：**NOT VERIFIED**。root进行正式第1轮集中接受，state peer已收到精确冻结指纹。未启动服务、未改F/S/依赖/共享ledger/业务DB、未提交推送。
