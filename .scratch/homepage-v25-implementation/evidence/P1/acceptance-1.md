# P1 独立验收第1轮 — FAIL / 1 of 3

- 验收人：/root，未参与所审UI实现；2026-10-23 01:48–01:58 CST。
- 版本：source-manifest.freeze-1.json 的29文件聚合SHA256 `766c4cc69c7075be36ef61abe772129c04950b3cb7c5a2ce6966563a8a0fed9f`；F行情依赖另在修复，不属于P1冻结源。
- 环境：本隔离worktree；root服务127.0.0.1:3333 / PID85569 / session85604；显式隔离库 `.data/tradereview-test.sqlite`。业务库未作为服务目标。
- 实际入口：`http://127.0.0.1:3333/home?scope=live&market=a&accounts=p1-count-09&rangeMode=all`。候选报告中的live/range参数别名没有用于本次接受；不据此确认别名正确。
- 触发：整页开发后frontend-control-audit；本轮P1控件及必要普通交易库往返；P2/P4占位不接受为已实现。55需求、96公共状态原始分母不变。实际冻结源登记见controls/FROZEN-SOURCE-INVENTORY-1.md。重大FAIL后停止扩展本轮执行，未测项保持NOT VERIFIED，不能宣称完整控件覆盖。

## 独立真实浏览器结果

|ID|操作/状态|观察|证据|结论|
|---|---|---|---|---|
|P1-R1-J01|1280×800，9行，第2页600108；mouse打开详情→外点|身份和数量对应来源；外点未关，背景inert|acceptance-1/visual/detail-1280.png及既有CUA记录|PASS（限定该状态）|
|P1-R1-J02|详情唯一查看交易|进入普通/trades，准确SSE:600108，无queue、无自动选择episode|acceptance-1/ordinary-symbol-library.txt|PASS|
|P1-R1-J03|普通库返回首页|重读完成asOf更新17:50:12Z，恢复第2页、scroll615.5及来源Eye焦点|CUA返回观察；同轮截图|PASS（未做受控写入）|
|P1-R1-J04|局部查询P1→名称降序→第2页600100；键盘Return打开、ShiftTab|打开准确行，首尾焦点约束生效|同轮CUA；detail截图为之前同结构|PASS（限定键盘打开与trap）|
|P1-R1-F02|Esc关闭；再次打开后close button关闭|两条路径activeElement均BODY，未恢复来源Eye|home-surface.tsx closeDetail在setDetailId后同步focus，背景此时仍inert；root真实浏览器复现|FAIL|
|P1-R1-F03|数值完整title|已知成本100仍title“100 · 暂无可信成本”；已知价110仍附“行情待更新”|冻结home-surface.tsx Value传参及root AX|FAIL：已知数据被误标缺失|
|P1-R1-F04|空账户/真空持仓|无批准设计的导入/下一步动作|owner明确报告，冻结源码登记和源码确认|FAIL（未使用browser假装点击缺失控件）|
|P1-R1-M01|交易所身份贯通|broad trade merge的validateInstrument仅浅校验，可绕过narrow官方exchange校验；不可信证据可能成为identity|P1-state-peer/SECONDARY-STATIC-REVIEW.md及冻结源链，root独立读源确认|FAIL source-level；实际HTTP持久化未验证|
|P1-R1-T01|旧Workspace相邻回归|3 FAIL，地址/存储隔离复跑仍同失败；根因未全部证明|53-workspace-journey-regression.log、59复跑；peer追加诊断中|FAIL，不能凭缺nature全部豁免|
|P1-R1-T02|F新行情完成时段合同|旧P1两US fixture把同日未完成quote当已知；F报告2FAIL|F新合同源/日期夹具待固定后一起回归|NOT VERIFIED依赖|

输入方式：mouse与keyboard如上；组件合成事件仅peer15/15，不替代真实浏览器；emulated touch / physical touch NOT VERIFIED。没有实际保存→返回→reload、guard取消/继续、0/1/5/8/50计数、完整CSV、全部市场/账户、390窄屏及完整动态实例操作证据，本轮均NOT VERIFIED。

## 独立视觉比较

/ root直接观看批准detail参考图与实际截图，另检查1280×800及1440×1000 DPR1桌面画面。对照图位于原稿images/detail及本轮visual目录；完整引用映射仍以DESIGN-COVERAGE和visual-contract为准。无用户授权视觉偏差。

|ID|原稿/契约|实际|证据|结论|
|---|---|---|---|---|
|P1-R1-V01|详情数量/成本/市值/浮盈四张核心指标卡一行，核心28/34；当前价和账户/天数次级|760宽plain两列七项，18/24，全体近似同层级；缺四卡视觉结构|参考integration-debug/visual-readback/detail.png；actual acceptance-1/visual/detail-1280.png；CSS .hp-detail-values|FAIL，重大信息层级偏差|
|P1-R1-V02|固定8槽48px，head40，toolbar/footer48；列25/8/10/11/11/15/14/6|两宽8×48、head40；toolbar/footer border内47；列比相符；table520固定|holding-1280-complete.png、holding-1440.png及*-geometry.json|PASS限定持仓结构；1px边框不作重大偏差|
|P1-R1-V03|导航72、顶栏64、外24、C内联摘要|两宽对应尺寸与层级大致符合；P2/P4只是占位不能接受|home-1280.png、home-1440.png与table geometry|PASS限定P1骨架；完整首页仍NOT VERIFIED|

详情CTA居中遵从当前原文，参考旧图左对齐不作为缺陷。证券示例/曲线内容不机械像素比较；上述四卡层级是结构性要求。

## 集中修复范围及下轮准备

原owner保持P1同票负责，不新增任务重置轮数。先逐项复现并保存RED，再最小修复：关闭焦点延后到inert解除后的commit；已知数值不带缺失原因；恢复四核心卡及次级信息结构；补批准空态下一步并接既有导入入口；在共享instrument写入边界复用官方metadata validator，证明原始invalid exchange RED与valid保留；三个Workspace失败先读peer根因并逐个修，不能把unknown source统一填live；按F新完成时段修正无效测试夹具并留old/new理由。完整值Enter/Esc/touch行为原规格仍必需，不以native title作为最终证据。

范围仍issue04允许文件；若空态需调用既有导入入口，可增加受控onImport callback并接原Workspace导入入口，不改导入业务/全局导航含义。metadata broad route test可有限新增 `app/api/storage/trades/route.test.ts`，route产品仅证据表明确需修改时报告root，优先修已有sqlite-store边界。不改F/S、共享账本、全局CSS、layout或业务DB。

|门槛|结果|理由|
|---|---|---|
|功能正确性|FAIL|焦点、缺失reason、空态动作、metadata边界及3相邻回归|
|端到端/持久化|NOT VERIFIED|最小ordinary往返PASS；真实保存、受控变更、reload、guard完整链尚未执行|
|视觉还原|FAIL|详情四核心卡层级偏离；两宽持仓骨架限定PASS|

P1使用1/3轮，交回原owner。P2–P4产品实施仍BLOCKED。下轮先完成集中修复与自检、冻结新指纹后由root独立接受；不清除本轮FAIL和未执行项。
