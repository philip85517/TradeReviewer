# Navigation recovery：有限候选冻结

状态：**candidate-frozen，等待 root 独立接受**。实际 `gpt-6.1-sol / ultra`。本次仍属原任务：P1 正式第 2/3 轮 FAIL、P3 0/3 均保留；不提交新的整票 implementation-ready，不宣称 P1/P3 完成。原 Recall 错证券根因 **OPEN**。

## 范围和直接依据

本次仅修改 `app/components/homepage-v25/use-homepage-host.ts`，新增 `app/components/homepage-v25/navigation-recovery.test.tsx`。原 `use-homepage-host.test.tsx` 与 session/S/Workspace/Surface/CSS/目录模型均保持输入字节不变。未访问 HTTP、浏览器、服务或任何数据库；没有启动/重启、seed 或依赖改动。证据仅写本目录，旧 RED/历史接受记录均保留。

批准设计为 `../navigation-recovery-design/DESIGN-AND-RED-PLAN.md`（SHA `266e50e3862a23dde17a4dbb9d9d9505f457a451a7f7bd76fcc1256aaa8bef3b`），对应批准正文来源返回、完整 UI 快照与最新业务重读、失败/15 秒超时保旧状态、generation + scope 匹配的合同。root 已在真实 UI 复现 NR04，原现场见本级上层 `navigation-cold-read-failed`、`navigation-return-pending`、`navigation-return-pending-search`、`navigation-reload-search-lost` 图/AX 和 `navigation-fault-requests.jsonl`；本报告没有把 hook API 测试升级为浏览器接受。

根因：冷 `/trades` 首读失败后 committed 仍为旧 all/空查询，而合法 readonly source 是 A/ROKU。返回 navigation 未完成期间，onUi 与主动出站来源捕获曾把旧 committed 写成新 source；失败/超时清空 pending 后仍可继续误写。另 host.reload/focus 以旧 applied 发 refresh，会替代 navigation 的正确目标。S 的世代匹配对旧响应拒绝是正确行为。

## 唯一产品候选

相对本次 baseline 的精确补丁见 `candidate.diff`。没有第二次产品补丁。

1. host 的内存 `sourceRecovery` 只持有恢复 UI 字节及当前 generation，不保存另一份 applied/scope 或任何业务数据。navigation 建立该上下文；失败/超时保留它，当前匹配 owned success 提交其 UI+bundle 后才释放。
2. 恢复未完成时，onUi 仍更新旧画面临时 UI，但不能写 source/storage/history。openTrades/openGlobalTrades 不重新捕获旧 committed；继续沿用现有 protected source，目标 URL 仍按原 committed 规则产生，guard 仍在写入前完成。
3. recovery pending 时 reload 合并为无新请求；失败/超时后的手动 retry 用 S 保留的 purpose/target、新 generation 和 captured full source。focus/visibility 在恢复未成功时不自动抢占，接受后正常刷新恢复。
4. 新 identity 是更高用户意图：更新当前 generation，保留旧来源的写保护。identity 成功提交 B 自有 bundle；identity retry 不把 A 的 UI 恢复到 B。A 的晚到 resolve/reject 不能释放 B 的保护。

`readOnInitialize=false` 的种子初始化路径、目标 URL 解析、source 存储格式、S/F/session、业务读取/缓存、Recall、既有导航 guard/pop 算法均未更改。pending 阶段临时 UI 输入不与来源强行合并；成功仍恢复该请求捕获的完整来源，遵循本次已批准设计。

## 先 RED 后 GREEN

|记录|实际结果|证据与版本|
|---|---|---|
|01：R01/R03/R05 最小第一批|**3 FAIL**|`01-required-red.log/json`；host `74d765fe…`，运行前后稳定；精确测试源在 `baseline/navigation-recovery-red-01.test.tsx`|
|02：全部因果护栏，产品未改|**15 FAIL / 2 PASS**|`02-causal-baseline.log/json`；R08 cancel/throw 原样通过；其余失败均保留；完整测试源在 `baseline/navigation-recovery-red-02.test.tsx`|
|03：唯一 host 候选 + 原 host|**39 PASS**|`03-recovery-green.log/json`；17 新测试 + 22 原 host 测试|
|04：新恢复 + 既有 26|**43 PASS**|`04-affected-26-and-recovery.log/json`；17 新测试 + 原 host 22 + 原 session 4；verbose 保留逐名结果|
|05：项目严格类型|**exit 0**|`05-strict-types.log/json`，`tsc --noEmit`|
|06：有限文件 lint|**exit 0，0 error/warning**|`06-host-lint.log/json`，host、原 host test、新 recovery test|

Vitest 有 Node `DEP0205 module.register()` 运行时 deprecation 提示，未将其删去。没有更改 lint 规则、原测试断言或 fixture 来获得 GREEN。

执行程序统一为固定 Node：

```text
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node
```

在仓库根目录，`run-check.mjs` 包装执行下列精确 Node 参数并保存 stdout/stderr、exit、运行前后输入 SHA（每个 json 中可完整重放）。

```text
node_modules/vitest/vitest.mjs run app/components/homepage-v25/navigation-recovery.test.tsx --maxWorkers=1
node_modules/vitest/vitest.mjs run app/components/homepage-v25/use-homepage-host.test.tsx app/components/homepage-v25/session-model.test.ts app/components/homepage-v25/navigation-recovery.test.tsx --maxWorkers=1 --reporter=verbose
node_modules/typescript/bin/tsc --noEmit
node_modules/eslint/bin/eslint.js app/components/homepage-v25/use-homepage-host.ts app/components/homepage-v25/use-homepage-host.test.tsx app/components/homepage-v25/navigation-recovery.test.tsx
```

## 版本绑定控件/事件覆盖

触发：本次改变首页返回/重试及其 source 写入状态接线，适用 frontend-control-audit。范围为下列受影响路径；未新增或移除可见控件。测试使用真实 host/S/session、jsdom history/sessionStorage、deferred synthetic owned bundle；不以回调通过证明真实业务持久化。

|ID / 控件或事件|本次自动化断言|结果与独立接受|
|---|---|---|
|R01：返回首页 → pending 搜索触发/scroll 的 onUi → hard remount|不预提交目标/data；source/history/storage 字节保留；重挂后完整 query/页/selected/focus/scroll + 新 bundle|自动 PASS；真实鼠标/键盘复验由 root，候选 **NV**|
|R03/R03b：返回读失败 → UI 回调/无回调 → 手动 retry|同 navigation 目标、新 generation，完整来源仍恢复，accepted callback 仅自有 bundle 一次|PASS；真实错误/重试 **NV**|
|R04：15 秒 timeout → retry → 旧 resolve/reject|旧请求不清 retry/context、不写 source、不发布 callback|2 PASS；真实计时/网络 **NV**|
|R05：pending reload|reader 数与 generation 均不增长，原 navigation 完成同代提交|PASS；这是 API 防御，未无证声称是原现场 UI 触发原因|
|R06：失败/timeout 后 focus/visibility、成功后 focus|恢复中维持手动；接受后正常 refresh，保留新 scroll UI|2 PASS；真实窗口事件 **NV**|
|R07：同 scope 的不同 UI source|不以 scope 相同放行旧 query/page/focus 覆盖|PASS|
|R08：scoped/global 出站、guard cancel/throw/stale|目标原规则、commit/地址/source 原子；允许出站不捕获旧 all；取消/throw/stale 不写入|5 PASS；真实保存/guard/返回 **NV**|
|R09：恢复中显式 identity B、B 失败后 retry、A 晚到|B 高意图仍生效，失败保 source，retry 保 identity，不恢复 A 到 B；A 不释放保护|3 PASS；真实身份切换 **NV**|
|既有 26：direct/ready/日期/URL/来源/callback/freshcatalog/pop/v2/guard/session|原文件原断言，包含 readOnInitialize=false 对照|26 PASS；不等同整页或持久化接受|

R02 的实际控件可达性已有 root 原缺陷复现；本次不扩大 Surface 文件范围，未增加 click 命名的假 touch 测试。mouse/keyboard 候选真实操作、emulated/physical touch、视觉均为 **NOT VERIFIED**。host 改动没有视觉样式，仍由 root 复验受影响恢复状态；不能用单元通过替代该检查。

## 冻结指纹与未完成项

完整输入 baseline、候选与未改输入对照见 `baseline-manifest.json`、`candidate-source-manifest.json`。本次产品/测试 SHA：

|文件|SHA256|变化|
|---|---|---|
|use-homepage-host.ts|`85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`|唯一产品修改|
|navigation-recovery.test.tsx|`1f8e62d6d8ab1a1e4a59657c9e1e0ffdc644fd31e9351c8257d54be693ebbf09`|新增 17 项|
|use-homepage-host.test.tsx|`327c1c9ce4b0587abf9618e70bb961f0c520defe8485c173689cc82cc5262caa`|原样|
|session-model.ts|`828162fd03dcba7d4632a189444e54e1c4f0761d937c7bf0b4e4ad96abb4766e`|原样|
|homepage-v25-state.ts|`fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`|原样|

自动化状态接线：本范围 **PASS**。真实功能/来源浏览器持久化/窗口恢复/视觉：候选 **NV，待 root**。原 Recall 根因 **OPEN**，不是本修复解决项。P1/P3 整票与原轮次未改变。产品现在冻结，等待 root 按相同故障路径和正常往返独立核验，不继续叠加补丁或扩展附件/P2/P4。
