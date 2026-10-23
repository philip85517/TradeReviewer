# S 同票恢复第2轮 implementation-ready

状态：**implementation-ready，等待 root 独立第2/3轮验收**。不自签 PASS，不推进 P3。原历史3/3 FAIL与恢复第1/3轮 PASS、原暂停/RED证据均保留。实际模型 `gpt-6.1-sol / ultra`；2026-10-23 02:40 CST 冻结。

只写授权的 S 源/test 和本新证据目录。未写 host/session/surface/Workspace、F/shared types、现有历史证据/共享追踪；未启浏览器/服务、未访问 DB、未新增代理、未提交推送。按 systematic-debugging 的现有已证实边界根因及 TDD 实施；批准设计是 [P3 合同](../../../P3/PRE-DISPATCH-STATE-CONTRACT.md) `016580e865e3e0be2bcab814dbdf62292836c7a16071ddbba98a7b40de618057`，以及 root 对显式 navigation、失败保旧 committed 的裁定。

## 冻结版本与改动

|文件|本轮 SHA256|前一接受版本|
|---|---|---|
|homepage-v25-state.ts|`fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`|`ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`|
|同名 test.ts|`4f474e134ed06d19e2961df7aa66d65356a4a3c537749a6584429479e7d6759a`|`25c0af4452056c1763017a96f76fe45fd5a375159dde10013b98c32a80b19a68`|

见 [source-freeze.json](source-freeze.json)；原始副本和逐行 diff 同目录保存。本轮保留现有导出；beginHomepageApply 是 apply-purpose 兼容包装；新增单入口判别 intent 和 committed 导航投影。

- snapshot v3、pendingReview 双选与 v2 严格迁移；仅否/双选/全不选往返保留，贡献本地 openOnly 不变，nested UI 白名单不放宽。
- 原生 URL date/custom 初始化 period；显式 All 成功清所有 route 日期；v2 不一致明确迁移，v3 不一致拒绝。scope 是同一 period 的校验投影。
- identity/apply/refresh/navigation 单入口；普通 identity 保 period/history，navigation 成功原子切 URL scope+period；refresh 使用 C 并保最新 D；terminal 后 retry 保 purpose/URL 目标；旧请求/错 payload/超时/取消不提交。
- period/history 的 key 不误依赖 scope 投影日期，仍按 global identity+attachments 独立；global 完整 key 保留日期依赖和 purpose。restore 不带请求或 retry 元数据。

## TDD 与新鲜验证

所有命令使用固定 Node：

```sh
NODE=/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node
$NODE node_modules/vitest/vitest.mjs run app/lib/reviews/homepage-v25-state.test.ts
$NODE node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --types vitest/globals app/lib/reviews/homepage-v25-state.ts app/lib/reviews/homepage-v25-state.test.ts
$NODE node_modules/eslint/bin/eslint.js app/lib/reviews/homepage-v25-state.ts app/lib/reviews/homepage-v25-state.test.ts
$NODE node_modules/vitest/vitest.mjs run app/components/homepage-v25/session-model.test.ts app/components/homepage-v25/use-homepage-host.test.tsx
$NODE node_modules/vitest/vitest.mjs run app/lib/reviews/dashboard-browse-preferences.test.ts app/components/library/library-browse-state.test.ts
```

TDD RED 分别在相同 S 精确路径加 `-t 'S recovery round2 v3 attachments'` / `'S recovery round2 period authority'` / `'S recovery round2 read intents'`。没有全量测试、build、服务或 DB 操作；工具链既有 DEP0205 warning 原样保留。

|证据|结果/退出|证明范围|
|---|---|---|
|[00 baseline](00-baseline.log)|67 PASS / 0|本轮开始的原 S 基线|
|[02 v3 RED](02-v3-RED.log)|13 FAIL、3 PASS、67 skipped / 1|旧 bool/version 不支持合法选择；先红后实现|
|[03 v3 GREEN](03-v3-GREEN.log)|83 PASS / 0|严格迁移、嵌套防注入与完整往返|
|[04 period RED](04-period-RED.log)|9 FAIL、83 skipped / 1|初始化/All 清除/一致性与投影 seam 缺失|
|[05 period GREEN](05-period-GREEN.log)|92 PASS / 0|同一期间权威和独立 history|
|[06 intent RED](06-intent-RED.log)|13 FAIL、92 skipped / 1|统一 purpose API 缺失，真实完整 transition 反例|
|[07 intent GREEN](07-intent-GREEN.log)|105 PASS / 0|四目的/失败/timeout/cancel/retry/晚响应|
|[08 boundary GREEN](08-boundary-GREEN.log)|109 PASS / 0|加4个错 payload、history 并发、规范化 key、恢复无请求边界；全部 S|
|[09 strict types](09-scoped-typecheck.log)|0|仅授权两文件严格类型检查|
|[10 lint](10-scoped-lint.log)|0|仅授权两文件|
|[11 consumer](11-adjacent-consumers.log)|13 PASS、3 FAIL / 1|已保留准确未接线断点，非整页通过|
|[14 adjacent pure](14-adjacent-pure-state.log)|26 PASS / 0|既有 dashboard 偏好/library browse 状态|

原六检查**原文件未改**：其 direct draft `pendingReview:false` 按 v3 严格类型拒绝，[12 原样输出](12-original-v2-input.log) 退出1。新 [迁移输入副本](coordinator-original-six-v3-input.mjs) 只改 import 位置及 false→[]；六项断言原样，[13 新鲜结果](13-original-six-v3-input.json) 6/6 PASS、退出0，并绑定 source hash。真正外部 v2 bytes 的 true/false 迁移由 S 新红绿用例独立覆盖，不把旧 direct bool 容错冒充版本迁移。

## 已满足的纯边界与剩余 owner 责任

本轮109测试覆盖完整 apply→commit→encode→read/restore，v2→v3，native URL→period→普通目标投影，显式 All 成功/失败，四 read purpose，late/cancel/timeout/retry，跨域乱序，以及原完整 UI 字段回归。业务事实、完整 bundle 与 UI 的真实原子接线仍是 integration 唯一 owner。

相邻3 FAIL 的具体根因是 `session-model.ts:homepageTradeUrl` 旧 `period!==all` 分支把 native 单日 date 改成 custom。S 新初始化使该旧分支首次命中；新 `homepageNavigationScope` 已保留正确 date/All 投影。没有改现有消费者测试来掩盖此断点。修复和后续真实检查由 integration 在 root 接受 S 后接线。

准确 API、v2 key 迁移、navigation vs identity、refresh 保 D、单次 accepted UI+data 提交、最小调用方 diff 与边界见 [INTERFACES.md](INTERFACES.md)。S 不写 route/storage/browser，也没有业务 cache 或第二状态模型。P1 真实 catalog/返回/URL/guard/back-forward、storage 异常、全页附件业务投影、真实持久化和 reload、DOM 焦点、视觉/物理触摸全部 **NOT VERIFIED**；不由纯模块109 PASS代替。冻结后不再改 S，等 root 独立第2/3轮结果。
