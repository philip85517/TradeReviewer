# 冻结诊断：直达首页来源 ordinary 集合为空

2026-10-23 03:26 CST；仅诊断，产品源码/产品测试冻结，不是 P1 第3候选或 P3 implementation-ready。

## 已确定的根因

P3 将首页来源 ordinary 集合的数据入口改为 `homepage.data.entries` 后，暴露了 host 对直达 `/trades` 没有初始化其 owned bundle 的分支。真实外部 bootstrap 虽已加载，host 的 `session.data` 仍是第一次 render 的空对象。这个原因足以造成 root 冻结全重载所见的 0 标的/0 回合；不依赖 HMR、不依赖 class 或 exchange 被拒绝。

准确链路（本目录 manifest 绑定的源码）：

1. `use-homepage-host.ts:35`：`useState` 创建 session，数据来自首次 `options.data`。冷启动时 Workspace `importedExecutions`/`storedInstruments` 尚为空。
2. Workspace `:2177` / `:2203`：legacy bootstrap 后构建了真实 `homepageData`，`storageState/aliasRecoveryState` ready，外部 accounts/identities 校验也能通过。
3. host `:115–118` 的 `acceptAddress(page === "trades")` 只设 `route` 后立即 return，既不 seed ready 时的数据，也不发 owned read。
4. host `:143` 仅对 `page === "home"` 执行 `readOnInitialize`。因此冷启动 `/trades?...` owned read 次数确定为 0。host `:153–155` 明确拒绝后续任意 `options.data` 整包覆盖，这个保护本身应保留。
5. Workspace `:2216` 的 catalog 与 `:2240` 的 strict ordinaryEntries 都消费 owned `homepage.data`，因此获得空目录/空集合。其他页面使用外部 entries，所以全库/待处理数量仍能显示。
6. Workspace `:2223–2237` 的 collection 投影按 `route.key` 只提交一次。若修复只补异步读而不协调完成代的 route/catalog 投影，首轮还可能在空 catalog 下把 symbol filter 写成 null；应一并用同代 accepted bundle 建立 collection，不能以当前空投影当完成。

P3 前 ordinaryEntries 使用外部 `tradeLibraryEntries`，所以没有暴露 host 这个冷启动分支；此次改入口构成真实回归，应修复，不能归为旧夹具。

## 最小动态 RED 与对照

命令（当前工作树根）：

```text
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P3/frozen-direct-trades.vitest.config.ts
```

证据测试 `frozen-direct-trades.test.tsx` 使用生产 `createSqliteHttpClient.getBootstrap` → `buildInstrumentTradeSummaries` → `buildTradeLibraryEntries` → `buildHomepageCatalog` → `useHomepageHost` → `explicitLiveEntries/filterEntriesBySharedScope`。HTTP 返回内存中、与 root seed 同形的真实类型 bootstrap；没有读取服务或数据库，也不是实际 DB 导出，不能声称它独立验证了已存数据。

- `09-frozen-direct-trades-red-settled-control.log`：3 项，2 PASS / 1 FAIL，exit 1。直达 `/trades?scope=live&market=a&accounts=p1-count-09&rangeMode=all&symbol=SSE%3A600100`，ready false/空 → ready true/真实 bootstrap 后：`entryCount=0, collectionCount=0, ownedReads=0`；期望均为 1。
- 同输入 `/home` 控制：1 次 owned read，pending 清除，真实 entries=1，PASS。
- seed 同形 CN instrument 无 metadata，仍有 `SSE:600100 -> [CN-SH:600100]`，collectionInstrumentId 正确，live/account 集合=1；assetType 保留 unknown，PASS。因此旧两段 alias 并未被新 class 规则删除。
- 原始 `08-frozen-direct-trades-red.log` 保留。它的 /home 控制过早只等待 seed entries=1，尚未等 owned request 完成，导致额外时序 FAIL；09 仅将这个控制的等待条件改为 pending=null，不改产品、不改变 direct-trades RED。

root 已另行真实冻结全重载复现集合为空，和以上小反例指向同一入口；此报告不将测试当成 root UI 接受。

## 拟申请的有限修复边界（尚未实施）

仅 `homepage-v25/use-homepage-host.ts` / 相应测试及 Workspace strict ordinary 投影/相应测试，必要时使用已允许的 session helper，既不改 S/F，也不改 catalog 的身份规则。

1. 首次 ready 的 scoped `/trades` 也以其 URL scope 发一次 tagged owned navigation read，仍复用 `readHomepageBundle`，由该请求持有完整 bootstrap/market/FX bundle。不能重新启用任意外部 latest bundle 回写。
2. 读取成功时同一同步提交段发布 accepted data、fresh catalog 对应的 collection 路由代；ordinary 投影在该 accepted 代建立，而不是 pending 时从空目录落定。失败保 URL/来源与明确错误，不能展示一个貌似完成的空库；迟到/取消不提交。
3. 传入并保留有效来源首页快照；只恢复 UI。direct trades 读取不能用 trade symbol 覆盖已保存首页 scope/search/scroll；返回首页仍从来源恢复并重新 owned read。
4. 裸全局 `/trades` 保留其既有 shared-scope/legacy 数据目录，不把首页 explicit-live 或新 class 限制扩到全局；首页来源的严格集合则继续只含 explicit-live。
5. 定向回归至少包括：本 RED、两段旧身份与三段搜索身份的冷直达/refresh、同 identity 多 instrument IDs、无效/删除 fresh catalog 的 fail-closed、带来源搜索/非默认日期的返回、A→B 迟到 bundle、原 accepted FX 不被旧外部值覆盖。保留现有 guard/URL 日期断言。

## Recall 自动换证券：尚未确定根因

Workspace `:2743–2753` 的 bootstrap 完成路径会无条件选 `storedSummaries[0]` 和其 newest episode，effect 依赖在 `:2803`。P3 本轮最后一次 Workspace 写入为 03:20:41，root 随后观察到选中兵红箭，因此 HMR 重跑此 effect 是待验证假设；这不是已确定解释。此报告不把 direct-trades 空集合原因扩张为 Recall 自动换证券原因，不修改旧 replay/Recall 选择语义。root 正在冻结重载独立复现。没有证据显示错写其他 episode。

## 冻结与剩余状态

`frozen-ui-0321-manifest.jsonl` 保存 6 个产品输入的 SHA256/mtime；与 03:21 报 root 的值一致。最后产品写入：Workspace 03:20:41，host/session 03:20:15，surface/CSS 03:17:07，catalog 03:14:42。此次仅新增/更新本 P3 证据目录内的测试、config、日志、manifest、报告。

direct scoped cold ordinary：FAIL，根因已证实。旧 seed 同形 alias：PASS。Recall 自动换证券：NOT VERIFIED，待冻结稳定复现。P3 全切片/视觉/真实持久化：未交付，继续冻结等待 root 有限裁定。
