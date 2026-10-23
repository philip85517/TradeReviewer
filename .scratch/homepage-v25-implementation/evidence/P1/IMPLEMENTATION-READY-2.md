# P1 implementation-ready — 第二候选 / 待独立第2/3轮

产品已冻结，不再修改；本次不是P1接受。正式第1/3轮FAIL保留于acceptance-1.md，下一轮第2/3，不重置。P2–P4未实施；root可独立签有限首旅程/整页视觉依赖门，不能自动当整票通过。

冻结30个精确owner文件：source-manifest.freeze-2.json；聚合SHA256 **b5611a7a229ca1d661fe3a0533ac8729ec0761f265d673aa9a5830edc204a2d1**。算法在manifest内；逐文件hash/bytes及所有消费输入hash齐全。新增范围仅获批的broad trades route.test；route产品、F/S、shared-scope/账本、layout/globalCSS、deps/config未改。原seed及验收DB未写，服务未启动/重启，浏览器未操作。

## 入口及独立验收

- root现有服务 `http://127.0.0.1:3333/home?scope=live&market=a&accounts=p1-count-09&rangeMode=all`，仍由root管理的显式隔离`.data/tradereview-test.sqlite`。本候选无需新seed/重启；不据此声称已重新打开浏览器。
- 首个门：保非默认query/sort/page→准确account+episode详情（四核心卡/次级价账户天数）→owned read完成后唯一查看交易→准确普通集合，含execution-date内open、无queue/自动回合→返回home恢复完整UI且最新业务重读→reload/back/forward。真实保存/guard各动作另验，不以最小旅程覆盖。
- 两桌面1440×1000与1280×800按原reference同态比对；详情层级、Esc/close Eye焦点、已知数值无缺失reason、新Value Enter/Esc与空态下一步为本轮优先。
- 更新控件登记：controls/FROZEN-SOURCE-INVENTORY-2.md；原freeze1保留。动态实例/96公共状态不删分母；真实mouse/keyboard、emulated touch、physical touch分别记录。

## 实际检查

固定 `NODE=/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`；以下命令均从本worktree执行。

```sh
$NODE node_modules/vitest/vitest.mjs run app/components/homepage-v25 app/components/library/library-browse-state.test.ts app/lib/instruments/metadata-contracts.test.ts app/lib/instruments/providers/metadata-providers.test.ts app/lib/instruments/resolve-service.test.ts app/lib/storage/indexeddb-instrument-metadata-repository.test.ts app/lib/storage/sqlite-store.test.ts app/api/storage/instruments/metadata/route.test.ts app/api/storage/trades/route.test.ts
# 81-round2-targeted-final.log: 12 files /194 PASS, exit0
$NODE node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.test.tsx -t 'bare global browsing|nondefault homepage|genuine aliases|keeps the parent review mounted until a failed navigation|keeps a successful typed save observable|keeps the saved fact and read-only retry after repeated summary failures|returns to the library with its expanded stock context|connects the production homepage|opens stock entries in the shared workbench'
# 88-round2-workspace-original-three-frozen.log: 1 file /9 PASS /86 skipped, exit0
$NODE node_modules/vitest/vitest.mjs run app/components/library/trade-library.test.tsx app/components/library/trade-library.acceptance.test.tsx app/components/library/library-stock-rounds.test.tsx
# 86-round2-library-neighbors.log: 3 files /62 PASS, exit0
$NODE node_modules/typescript/bin/tsc --noEmit
# 87-round2-types-frozen.log: strict full repository, exit0
$NODE node_modules/eslint/bin/eslint.js app/components/homepage-v25 app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx app/lib/instruments/metadata-contracts.ts app/lib/storage/sqlite-store.ts app/api/storage/trades/route.test.ts
# 84-round2-lint-final.log: exit1, 1 error/14 warnings (same Workspace cash effect baseline error as60)
```

合计16files、265执行测试PASS；不是全部Workspace95例，86未运行。88是包含原三FAIL完整断言的最终GREEN；85仅8PASS，漏选原cash重复摘要失败例，不能用85称旧三全过。79尽管文件名green仍2FAIL；80仍1FAIL、82仍1FAIL，全部原样保留，根因/后续真正GREEN见ROUND-2-ROOT-CAUSES.md。66环境失败不算产品RED。

|门|第二候选owner证据|独立验收状态|
|---|---|---|
|功能|定向265PASS；metadata实际route+临时SQLite写盘重开与historical JSON read边界|NOT VERIFIED候选2浏览器；等待root|
|状态/持久化|host direct/reload/owned read/compensating indexed pop等自动证据；真实HTTP alias失败恢复|NOT VERIFIED真实save/return/reload/guard与源新数据|
|视觉|详情四核心结构与P1骨架有DOM/CSS证据|NOT VERIFIED两宽同态原图比较|
|严格类型|PASS log87 exit0|可由root复核|
|lint|FAIL log84 exit1；Workspace1998 cash effect既有错误，baseline60同根因|保留FAIL，不默认为豁免|
|输入/控件全集|新增值popover、空态动作、origin等已登记|实际mouse/keyboard待root；emulated/physical touch NV；不写100%|

## 版本/消费与明确边界

- S accepted v2：`ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`。
- F root accepted恢复3/3：`e91dce9cdddf83137370ef44647dda260336b03bd49b5082d201352664f762b0`，按完成exchange session；currentMV/netUF/openFees同源。US两正向夹具raw23→22，asOf/FX/CN23与staleUS15未变。
- A accepted准备输入，精确interfaces/controlmap/P1plan hash见manifest。
- Host `32fb69710d1bfdb86aef67253f39b162279473b4e70d375235e9ab0fa9f216a6`；Workspace `983f0b173ba0f29d9058237ab6f34e8b1722d33f70bdcc59f4d48639c5d5d657`。
- Session URL适配 `c930599635b8360d3fe380c2168f23314bda501a786ad1c905690bed24eaf16b`；Holdings `56c46875fbc678b93c484614e82341a83219013d2c84a03571a7af8ff1e93b27`；Surface `2c2c12f041666b8357e4756956feb30868479c9c4f8847e202e6dc3cc1158c1a`。
- 裸/trades global保留旧broker fallback混组；首页nav/CTA/detail/scoped URL带完整已应用market/accounts/date且严格explicit-live。测试不往源记录补live；模拟有真实simulationRunId和selection。
- 当前period=all保留scope显式date/custom，非all period优先。这是root批准P1兼容投影；P2/S后续需URL初始化period及用户显式全部时清scope日期的统一规则。本轮未改S或预作P2。
- 当前UI-only source snapshot不缓存业务。官方exchange新写入与历史读取分别runtime校验，未知待解析；无迁移自动修数据。
- 未独立验的几何、完整值遮挡/selection、0/1/5/8/9/50、全部CSV/账户/市场/guard和持久化仍NV。已知lintFAIL不隐藏。

root可按本冻结源启动第2轮；本owner停止产品修改，等待集中反馈。
