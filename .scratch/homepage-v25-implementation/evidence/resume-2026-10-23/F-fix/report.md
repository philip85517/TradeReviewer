# F 恢复修复交接：implementation-ready（待协调者独立验收）

2026-10-23；owner `/root/financial_g61`，GPT6.1 Ultra。历史三轮 FAIL 原样保留；恢复验收仍 0/3。本报告不把 worker 通过叫 accepted，不关闭 F 或整页票。UI/页面消费/数据库/持久化/视觉 NOT VERIFIED。

## 实际变更

只修改 `app/lib/reviews/homepage-v25-performance.ts` 与同名测试；新证据仅在本目录。未修改通用 ledger/导入/页面/依赖，未开服务、访问业务数据库、提交、推送或再派代理。

依据已审查的 F-debug/ROOT-CAUSE.md，移除“canonical 平均成本 seed → 本地 FIFO 重算”桥。真实入口 required asOf，scope 默认 live 并严格 `tradeNatureOf`；按账户/证券/nature/run/id 去重原成交，保留 attached statement 证据，避免 episode 反向拆单重复使用整单 settlement。三个边界分别回放 canonical 数量、平均成本和毛实现；本模块只做费用归属和期间桥。未知数量/成本/费用分别参与依赖门槛，报价和 FX 先验证可见候选再计算。

新增边界与证据输出：effectiveEnd/asOf、nature/run/scope 排除统计、三边界原成交 IDs/knowledgeCursor/quantity/costKnown/feesKnown/openFees/quote/reasons；每个指标保留原币小计和 FX 来源/状态。真实入口/兼容边界及字段追踪见 [INTERFACES.md](INTERFACES.md)，原始管线实值见 [interface-traces.json](interface-traces.json)。模块仍未被页面消费，不能据此声称整页已交付。

## 环境、版本与命令

- cwd `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`
- HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`；本模块原本未跟踪，版本以 SHA256 为准。
- 固定 Node `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`，v26.0.0，darwin/x64；Vitest4.1.10；Intl Asia/Shanghai；无 DB/服务。
- 修前源码 SHA256 `81038783d8d2f8b7c5c680f6fd6179ebfceba6f960147cdda66076d474d99345`；修前测试 `dd947dfaf7c2f6816e254c2a581a3ba8de03e10f281e1084945cdf935696e3ce`。
- 最终冻结源码 SHA256 `f1b493d77e6963f35a99ca15b4b5ac8756577c327205a82f87617c76b12ce2d1`；同名测试 `fa853b632b6d7c01b8e9befa7abef60ec56c48c96e703a8666e364cbf656f6f8`。
- 修前原样 [source-before.ts.txt](source-before.ts.txt)、[tests-before.ts.txt](tests-before.ts.txt)；修后哈希、受保护依赖哈希对比、环境及证据绑定见 [source-manifest.json](source-manifest.json)。

完整重跑定向合同（非全量）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-fix/focused.vitest.config.ts
```

必要邻域（仅 ledger/episodes/library/scope/statement-evidence 五文件）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-fix/neighbors.vitest.config.ts
```

类型与目标文件 lint：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --noEmit --incremental false
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/lib/reviews/homepage-v25-performance.ts app/lib/reviews/homepage-v25-performance.test.ts --no-cache
```

冻结时全项目类型检查 exit2，只余并行 `app/components/homepage-v25/home-surface.test.tsx:16:202` 的 Mock 回调类型不满足 `onSelect(row)`。未改该范围外文件。另以 [tsconfig.f.json](tsconfig.f.json) 继承根 strict/options、仅收 F 源码与同名测试及其依赖，`tsc --noEmit --incremental false --project .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-fix/tsconfig.f.json` exit0，不能用此代替全项目通过。

最终定向配置 [focused.vitest.config.ts](focused.vitest.config.ts) 精确包含6文件98项：同名测试69、F-debug/invariant-red 10、coordinator/F-contract 4、历史coordinator-round3-boundaries 4、interface-trace 1、ipo-fee-contract 10。config/source/test哈希与日志绑定在manifest。

## RED → GREEN 原始链

所有历史证据不覆盖。新日志编号为过程顺序，不把中间 FAIL 改写为 PASS。

|证据|完整实际结果|说明|
|---|---|---|
|01-red.log|55项：40FAIL/15PASS，exit1|未改产品源代码；同名 fixtures 补真实 nature/asOf/生产FX，新增合同RED，并含诊断10RED、原4真实pipeline、root4接口测试|
|02-green-attempt.log|54PASS/1FAIL，exit1|首实现后纯入口缺当前快照仍漏报；保留过程|
|03-green.log|55/55，exit0|上述核心合同GREEN|
|typecheck-01.log|2个TS错误，exit2|Decimal变量类型与不合法 raw fixture 已修；非财务成功证据|
|04-boundary-red.log|65项：8FAIL/57PASS，exit1|10项补查：日内完整日线、未来空期间、malformed证据、lineage、真空仓UF、费用冲突、FX partial/零额；其中2项已正常|
|05、06、08、09、10 对应green日志|逐项目标GREEN|依次修日内raw候选、未来空集合、原lineage、异常/真空仓、fee与FX|
|07-malformed-evidence-green.log|1FAIL，exit1|发现初版异常fixture在上游episodes抛错，未到F；没有把它算成F红绿证据|
|07b-malformed-evidence-red.log|1FAIL，exit1|修正为真实entries构建后注入异常再传F，确认F原Decimal错误；09证据变GREEN|
|11-statement-boundary-red.log|5FAIL，exit1|真实statement开期/current/历史期末、date-only股票事件、IPO现金知识，全部先RED|
|12-focused-green.log|70/70，exit0|将物理cursor改上海15:59Z，保留源证据知识排序；5反例GREEN|
|13-typecheck.log|exit0|当时类型复核|
|14-eslint.log|1 prefer-const错误，exit1|已显式修；后续lint通过|
|15-neighbors.log|174/174，exit0|5个必要邻域，无全量套件|
|16-historical-fixtures.log|原14项：8PASS/6FAIL，exit1|历史缺nature/asOf契约不再放宽，逐项解释如下|
|17-final-contract-red.log|3FAIL/5PASS/70SKIP，exit1|未覆盖明确close-short与其后generic buy、日内FX日末知识先RED；另外5个合法契约替代例已PASS|
|18-final-focused-green.log|78/78，exit0|上述3反例GREEN|
|19-final-typecheck.log / 20-final-eslint.log|均exit0|对应当时源版本|
|21-fee-evidence-red.log|1FAIL，exit1|unknown-fees虽然PNL不可算，输出openFees仍0；先证实证据字段问题|
|22-final-focused-green.log|79/79，exit0|openFees=null、feesKnown=false，暴露实际knowledgeCursor|
|23-interface-final-green.log|80/80，exit0|新增1个真实接口trace测试，保存5组完整输入输出/canonical对照；含61个同名测试+10诊断+4root接口+4历史真实边界+1trace|
|24-typecheck.log / 25-eslint.log|均exit0|IPO/peer增补前的完整类型、目标文件lint复核|
|26-ipo-red.log|6项3FAIL/3PASS，exit1|IPO覆盖short全平漏费，部分覆盖和反转分项错分；canonical六组均可算；原始实值ipo-traces-red.json|
|27-ipo-expanded-red.log|9项6FAIL/3PASS，exit1|再补晚退款后出售与跨期分项，保存ipo-traces-red-expanded.json|
|28-ipo-green-attempt.log / 29-ipo-focused-green.log|9项GREEN；完整89/89，均exit0|fee pool扩展至canonical IPO movement prefix，不改成本/毛实现|
|30-duplicate-inventory-red.log|6项3FAIL/3PASS，exit1|数量/方向/时间冲突仍按首条发布MV；纯price/fee差异和identical控制已正常|
|31-ipo-duplicate-green.log|95/95，exit0|按冲突字段依赖阻断quantity/MV；保留成本未知但数量可信的MV|
|32-ipo-execution-backed-red.log|1FAIL，exit1|真实IPO buy覆盖short且allocation重复记载，before-prefix未使用相同去重知识导致fee pool5应0/net20应15|
|33-final-focused-green.log|96/96，exit0|67同名测试+10诊断+4root合同+4历史真实pipeline+1接口trace+10 IPO；IPO每一实现/UF/pool独立断言|
|34-final-typecheck.log / 35-final-eslint.log|均exit0|最终源码完整类型与双文件lint|
|36-final-scaling.log|1PASS，exit0|同合同20/100/200笔有限真实pipeline；正确net80/400/800；非全量性能结论|
|37-cost-evidence-red.log|2FAIL/96SKIP，exit1|数量和canonical成本已知、仅费用非法/冲突时，costKnown被净PNL不可用误清空|
|38-final-focused-green.log|98/98，exit0|69同名测试+10诊断+4root合同+4历史真实pipeline+1接口trace+10 IPO；成本/费用证据分离，未知成本控制仍false|
|39-final-typecheck.log|exit2，3项类型错误|并行home-surface.test.tsx的缺失模块/implicit-any两项；另本次fee表空对象联合类型一项，已用显式commission0修正|
|40-final-eslint.log|exit0|该次双文件lint|
|41-final-scaling.log|1PASS，exit0|最终冻结版本重测20/100/200笔约15/98/197ms，net80/400/800|
|42-final-focused-green.log|98/98，exit0|fee表改为显式commission0后最终同名测试再次通过；不修改页面任务|
|43-final-typecheck.log|exit2，1项范围外错误|并行home-surface.test.tsx:16:202 Mock回调签名；F类型错误已消除，已告知协调者|
|44-final-eslint.log|exit0|最终源码与同名测试双文件lint|
|45-f-typecheck.log|exit0|继承根strict/options，仅F源/同名测试及其依赖的完整类型检查；不代替全项目43结果|

原始命令均使用上面相同固定Node/config；筛选循环另加 `-t`，目标名写入对应日志。曾误拼一个不存在的配置路径导致 Vitest startup failure，未运行测试/未产生业务写入；没有将它当作红测。`git diff --no-index` 输出差异的 exit1 是正常差异退出，不是验证失败。过程快照差异见 source.diff。

## 原14项历史结果不改写

历史的4项真实 pipeline 曾全部 FAIL，现在4项全部 PASS，仍原文件/原配置。其余旧10测试有多个非规范fixture，保持字节不改，结果明确分离：

|历史用例|当前原样结果/原因|同名测试中合法合同对应证据|
|---|---|---|
|round2 valuation inventory mismatch|PASS，但旧输入缺asOf，null来自required，不能称业务已验证|`classifies valuation inventory mismatch with an explicit current cutoff`，断言具体mismatch|
|round2 current future quote|PASS；有asOf，仍正确拒未来|原测试继续；eligible raw回选与未来current控制另测|
|round2 period-start execution|FAIL；手造真实entry无nature→unknown排除|`uses Shanghai dates for precise fills...` 与原4真实pipeline；显式live来源|
|round2 missing opening cost|PASS但缺asOf，非有效成本证明|`classifies unavailable opening cost with a valid asOf`|
|round2 invalid settlement fees|PASS但缺asOf，非有效费用证明|`classifies invalid settlement fee text with a valid asOf`|
|round3 100/150/0→50|FAIL；缺asOf|`keeps opening mark, realized sale, and zero closing inventory in the net bridge`，显式base.asOf|
|round3 Shanghai timestamp-only|FAIL；缺asOf|`uses Shanghai dates for precise fills...` 和 `assigns executions...Shanghai...`|
|round3 partial current coverage|FAIL；缺asOf|`keeps partial current quote coverage in the caller-scoped compatibility input`，2/1|
|round3 failed realized then laterbuy|FAIL；缺asOf时无instrument结果|`rejects an unproven short while keeping a later valid opening from hiding it`；另补未覆盖close-short两例|
|round3 multipleepisodes|FAIL；手造真实entry无nature|`retains a real live multiple-episode aggregate before valuation`，真实库pipeline，net10/current110|

不为绿这些旧fixture默认nature=live或用period.end补asOf。原6FAIL不是被隐藏或accepted；交协调者依当前已批准契约独立裁定。有效替代测试不是历史文件重写。

## 回归矩阵与具体数值

|合同|实际验证|
|---|---|
|原4真实边界|上海首日net10；未来fill不使current110→220；未来candle回选110；未来期间不发布899|
|截止/标记|期初严格首日前；首日mark不吞20收益；effectiveEnd明示；历史period与current独立；date-only整日正常/盘中不提前；盘中完整日线不可见|
|statement/现金|开期/current/历史期末分别限制物理知识；同UTC日上海次日 closing/IPO事件不提前；IPO退款未到时costKnownfalse、MV330仍可信|
|成本/桥|跨年100/150/0→50；部分平仓净40；平均成本分别200/100/300/net400，R09不是只验恒等式|
|费用|旧仓费2/平费1：净实现17、开期UF-2、当期净19、全期净17；2份开费4/卖1平费1：实现17/UF8/net25；unknownfees不伪openFees0；费用冲突null|
|IPO费用|新开18；全平short实现/net18；部分覆盖含旧开费实现16/UF8/net24；反转实现17/UF9/net26；后卖一份18/9/27，全卖37/0/37；晚退款仍对应可算；跨期16+8-16=8；重复allocation真实buy平空net15且U=0|
|方向/lineage|显式short；未证实generic sell不可造short；未来相反episode不改过去；原reverse整单settlement一次：实现19/UF9/net28/current-110；无原lineage不可当空仓；未覆盖明确close-short数量不可用且后续buy不抹除|
|未知|unknowncost不伤MV；unknownqty/history null；fee unknown PNL null；可信已平仓无quote UF/MV0；malformed current/statement返回分类不抛Decimal|
|知识分离|canonical成本已知且数量可信、仅adapter费用非法/冲突：costKnown=true、feesKnown=false、MV110、PNLnull；canonical原始成本未知仍false|
|重复冲突|同ID数量/方向/时间冲突→quantity/MV null，保留duplicate-execution-conflict；纯price/fee冲突仍MV110；完全一致只计一次|
|scope|默认live；unknown/simulation排除有计数；指定simulationrun/account/market隔离；合法多个episode合并后估值|
|金额|生产slash/colon键770；bare/零/未来rate拒绝；missing/partial保持USD110；混币无target总null原币保留；partial不被后项覆盖；异币零额仍需FX；同币110无需FX|
|接口|五组原始summaries/entries/边界/canonical/F结果JSON；scope/FX来源/知识cursor/可用性/原币均可追踪|

## 已知边界与尚未验证

本次支持现有规范实际成交、canonical 已支持并证据完整的 IPO allocation/申购/退款/归属费用，覆盖新开、覆盖/反转 short、后续卖出、跨期及晚退款。根因、每个原始RED实值、minimal movement-prefix修正见 [IPO-ROOT-CAUSE.md](IPO-ROOT-CAUSE.md)；不另建成本/盈亏账本。歧义/缺失IPO成本沿用canonical不可用；非已支持的费用差额显式unavailable，不能返回似精确数值。日内只有此前完整日线，没有盘中报价来源；价格按现有可用raw候选估值，不创建新行情新鲜度服务。目标货币为本模块局部字符串，不改共享targetCurrency类型。

单次调用仅在本group内复用相同边界，无跨请求缓存。移除无需的成交后重播后，每个独立边界约执行数+IPO数+1次canonical调用；其timeline每次重建，至少是随成交数超线性增长，证据越多还存在内部匹配开销，不能承诺线性。20/100/200笔有限探针最终约15/98/197ms，net80/400/800（scaling.json，41日志）；此前9d7b44版本同合同样本约11/58/216ms（36日志）。这是单次投影的样本，不代表全业务规模/IPO复杂输入，更不代表逐日循环已可接受。后续P2/P4须复用边界或批量准备，不能在UI for-each-day直接重复此API。

仅运行上述定向与必要邻域；没有跑全量套件或构建服务。尚未证明生产首页完整数据链、各图日序列、交互/返回/加载、实际持久化、参考视觉、移动端或可点击预览；这些继续 NOT VERIFIED。下一步是协调者独立恢复第1轮验收，不是自动进入页面实现或宣称财务 accepted。
