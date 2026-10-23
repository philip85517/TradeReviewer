# P4 read-only financial seam — independent source review

2026-10-23，审查人 `/root/contribution_bars`，实际模型 `gpt-6.1-sol / ultra`。本审查人没有实现该财务模块。按 root 派发直接做规格与质量双轴审查；当前任务明确禁止再派代理，因此不是“两名独立审查人”的报告。

**结论：当前冻结 seam 有 2 个确定的 P2 正确性问题，不建议放行其财务消费者接入；另有 2 个 episode coverage 疑点标为 tentative，待 root 裁定。** 它们分属选择前缀、分配 knownness、episode 关联覆盖三类。两个 episode 反例的实际输出已观察，但 root 需确认该 coverage 字段的承诺范围，不能以它们声称 canonical 金额错误。下面的 FAIL 是独立源码审查结论，不是 root 的正式候选验收、不消耗/重置正式轮数，也不签署完整 P4/首页。实现本身保留了 canonical/F 的主要权威边界；不能用这一点抵销新接口的确定错误。

## 1. 精确版本、范围与方法

授权依据先读 [ROOT-DISPATCH.md](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/P4/seam/ROOT-DISPATCH.md)。审查固定点是本票的 input 快照→冻结 candidate 的 **完整 combined `candidate.diff`**，不是共享工作树相对 HEAD 的全部变更。当前 live 两个产品源与冻结快照的 SHA 已在安静窗口前核对一致：

| 文件 | SHA256 |
| --- | --- |
| `app/lib/replay/position-ledger.ts` | `37a121bf069e6b726540a6fce99d8d7f499b8c5b9b0139a4ab74562d4f05b270` |
| `app/lib/reviews/homepage-v25-performance.ts` | `f4091fb3e442cda6e04d8cd3254855bb07adc3a7dbc21c0543ddd3dc70b96889` |
| `seam/candidate.diff` | `61fca695e6980eba057488d50794425015fd1ac80aba0d2083ca0d968595400f` |

测试文件冻结 manifest 声明的 SHA 为 ledger test `5906258436d922a4bd0d507ef4cd450e04a460fa43caaeda379b58ef7d3166c6`、performance test `58e2760efce1c774c50465c87a1624bf65a9cce5665a988152dd2b16e47d4749`。审查阅读了两个完整冻结产品源、精确差异和新增测试；没有把 worker 的测试或 manifest 声明升级为独立实跑结果。目录内早期单文件 performance diff 不是最终 combined diff 的替代依据。

已核对当前 AGENTS、development-workflow、task-decomposition、issue-tracker、原设计 HP02/HP05/HP09、P4 的 PRE-DISPATCH-CONTRACT/ROOT-FINANCIAL-DECISIONS/CANONICAL-READ-FACT-SEAM-PROPOSAL、P2 的 P4-COORDINATOR-PROVENANCE-DECISION。必要数据路径包括原始 `TradeExecution/TradeEpisode` 类型、library/instrument 分组与 episode 构造、statement-evidence 的时间/IPO 重复取得权威、ipo-cost 完整现金链、retained-digest，以及 F 原有 replay/ordinary/fee/FX/cache 路径。

本报告是唯一写入；未修改任何产品/测试/既有证据/共享 tracker。没有 DB、服务、浏览器、网络、构建、提交或子代理。没有重复已有 243/244 测试、tsc、lint 或性能套件。下面的新小输入只在 root 宣布此次正式九样本性能安静窗口**之前**，通过 pinned Node 临时内联执行；收到窗口通知后只读源码与写本文，没有继续执行脚本或测试。它们直接调用冻结公开接口，不 mock canonical/F，也没有留下产品补丁。

## 2. Spec 与 quality 逐项结论

“源码符合”只表示已读路径未发现该项的新缺陷，不等于该项全部场景独立实跑 PASS。原 worker 的 244 PASS、strict/lint/public-equivalence 记录仍属于原证据，不能覆盖本报告的反例。性能由 root 独立执行，本审查不评价其九样本结果。

| 派发项 | Spec 结论 | Quality / standards 结论 |
| --- | --- | --- |
| SF01 / O01，加仓→partial→归零、incurred 与 allocated 分离 | 普通完整输入路径源码符合；实际 close/open 量来自 evaluator 同分支，未把 partial 发布为新 closed round | 保留单一成本权威；本 seam 没有新增 closed-round 聚合器。未知数量的分配子事实仍受 ISR-02 阻断 |
| SF02 / O02，反向 close/open 与费用一次分配 | 普通完整路径源码符合，原始 fill 不因 episode split 复制 | F 原有费用池方程保留；observer 没有新增另一份持仓成本账本。分配字段的共同 knownness 不完整，见 ISR-02 |
| SF03 / O03–04，late IPO / 非 fill cover | 读到 exact knowledge cursor、preceding movement、原 IPO cash-chain authority；没有用晚退款改实际费用日或造 buy fill | 附件路径仍复用原 `replay/beforeStep/resolveIpoAcquisitionCost`。未发现将 attached 改为不安全全局 sweep，亦未改 provider/现金计算/schema |
| SF04 / O05，event-only / gap / precision / unknown | canonical 的 continue/event/reconciliation 观察保留；**分配子事实未知门 FAIL：ISR-02** | `try/finally` 观察没有绕过 evaluator 分支；但新 observer 用原因白名单代替实际依赖 coverage，存在漂移 |
| SF05 / O06，完整 identity / episode / future carrier | 原始 fills 分组、重复冲突、future carrier 路径保留；**episodeCoverage 疑点 ISR-03、ISR-04 为 tentative，待 root 明确承诺范围** | 观察到未检验分支仍返回成功，日期 helper 混合 fill/episode 来源；是否属于本字段必须阻断的关联覆盖，由 root 裁定，不作 canonical 金额错误 |
| SF06 / O07，全精度 native / FX / class coverage | full Decimal 字符串保留；没有 latest FX 补值、FIFO/pro-rata 或造 disposal link；**可消费 allocated knownness 仍 FAIL：ISR-02** | classification 缺可信处置关联时保守 unknown；`fxCoverage` 是当前 read boundary 的既有 FX coverage，不是已实现每个 closed round 的历史转换，后续财务聚合仍须按原关闭日合同实现 |
| SF07 / O08，旧 wrapper 等价、选择/上下文/隔离 | **新 seam 与原 wrapper 的合法选择语义 FAIL：ISR-01；新事实 knownness FAIL：ISR-02**。canonical 自身正确选择 exact fallback，不是 ledger 选择错误 | legacy `ordinaryState` 已有前缀 guard，新调用点漏用；两条代码路径已经出现规则漂移。输入捕获/返回 freeze 与 local graph 隔离源码未见反例 |
| SF08，相邻回归、A 默认成本/缓存/复杂度 | 原 worker 证据保留；本审查未重复运行。正式性能 NOT VERIFIED by this reviewer | 旧 A public path 没有调用新 fact query；新增 Maps/fact graph 在显式 read 的局部创建，没有新增 retained Map 绕过 64 MiB。不能据此声称 root 性能已 PASS |

整体 spec 结论为 FAIL；quality 结论为有必须修正的边界不变量错误。未发现越权扩成第二本平均成本/IPO 成本账本、历史聚合器、金融 UI 接线或持久化引擎。上述边界遵守与具体输出错误分别记录。

## 3. 可复现输入的共同环境

以下是新反例执行时的完整公共构造。工作目录固定为 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；运行时为 `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`。每个反例接在此公共前缀之后执行；对象中的默认值都是实际输入，不依赖 DB 或市场缓存。`entriesFor` 调用项目现有真实 library/episode builder，并非手写替代 episode 逻辑。

```js
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
  file,
);
const F = require('./app/lib/reviews/homepage-v25-performance.ts');
const { buildTradeLibraryEntries } = require('./app/lib/trades/library.ts');
const { buildInstrumentTradeSummaries } = require('./app/lib/trades/instruments.ts');
const instrument = {
  id: 'US:AAPL', symbol: 'AAPL', name: 'Apple', market: 'US', currency: 'USD',
};
const fill = (id, executedAt, o = {}) => ({
  id, accountId: 'a', accountLabel: 'A', instrument,
  side: 'buy', quantity: '1', price: '100', fee: '2', executedAt,
  ...o,
  source: { platform: 'statement', row: 1, tradeNature: 'live', ...o.source },
});
const entriesFor = xs => buildTradeLibraryEntries(
  buildInstrumentTradeSummaries(xs), {}, {},
);
const sourceFor = entries => F.prepareHomepageV25Source({
  entries, candlesByInstrument: {}, fxObservations: [], currentFxSnapshot: null,
  lifetimeSourceCoverage: [],
  revisions: { trades: 'review-new-1', metadata: 'm', quotes: 'q', fx: 'f' },
});
const read = (xs, entries = entriesFor(xs)) => F.readHomepageV25FinancialFacts(
  sourceFor(entries), { asOf: '2026-01-22T10:00:00Z' },
).groups[0];
```

下面“实际输出”只省略与问题无关的长 hash/证据数组，不是期望值替代实测。前缀连同各案例足以重新构造完整输入；不要在 root 性能安静窗口中执行。

## 4. ISR-01 [P2] 非连续的合法已选成交误走 ordinary 费用前缀

位置：[performance.ts:1126](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-performance.ts:1126)，1126–1131；对照原 [ordinaryState:739](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-performance.ts:739)，尤其 742 的前缀 guard。

完整新输入与调用：

```js
const xs = [
  fill('next-shanghai-day', '2026-01-05T18:00:00Z', { fee: '10' }),
  fill('coarse-jan5', '2026-01-05', {
    fee: '2',
    source: { timePrecision: 'date-only', tradingDate: '2026-01-05' },
  }),
];
const entries = entriesFor(xs);
const actual = F.readHomepageV25FinancialFacts(
  sourceFor(entries), { asOf: '2026-01-05' },
).groups[0];
const legacy = F.buildHomepageV25PerformanceFromEntries({
  entries, candlesByInstrument: {},
  period: { start: '2026-01-01', end: '2026-01-05' }, asOf: '2026-01-05',
});
```

实际相关输出：

```text
actual.canonical.selectedExecutionIds = ["coarse-jan5"]
actual.canonical.mode = "exact-context-fallback"
actual.canonical.terminal.fees = { value:"2", available:true, reasons:[] }
actual.allocations = []
actual.openFees = { value:null, available:false, reasons:["fee-allocation-unavailable"] }
actual.realizedFees = { value:null, available:false, reasons:["fee-allocation-unavailable"] }
actual.nativeRealizedNet = { value:null, available:false, reasons:["fee-allocation-unavailable"] }
actual.diagnostics = {
  evaluations:1, transitions:1, indexProbes:1, retainedFactBytes:0,
  feeSteps:0, mode:"ordinary-sweep"
}
legacy.currentOpenFees.value = "2"
legacy.currentOpenFees.available = true
legacy.evidence.current.executionIds = ["coarse-jan5"]
legacy.evidence.current.quantity = "1"
legacy.evidence.current.costKnown = true
legacy.evidence.current.feesKnown = true
legacy.evidence.current.openFees = "2"
```

`next-shanghai-day` 的 instant 在上海是 Jan 6，Jan 5 查询应排除；day-only 的第二条属于 Jan 5，应保留。canonical 按 replay 排序时前者 18:00Z 早于后者日末，因此合法 selected 集合不是 ordinary prefix。原 `selectedPrepared`（691–692）正确选第二条；canonical 新读方法（ledger:604–620）也正确走 exact fallback。

错误发生在 F 新 seam：只判断 `prepared` 存在，按 `selected.length=1` 跑原数组的**第一条**费用 sweep，没有复用原 `ordinaryState:742` 的 prefix 校验。observer 在 1111–1112 找不到被排除成交的 canonical movement，于是不输出 allocation；`finishState:294` 发现错跑的费用 10 与 canonical 2 不等，才降为 unknown。1145 的 diagnostics 还误报 ordinary，掩盖了内部 canonical 已 fallback 的事实。

期望依据：dispatch SF07 要求旧 wrapper/新事实/F 的选中 ID、上下文和 unknown 语义一致；proposal:90–92、124、126 要求 exact selected prefix/context 与 F 核对。这个反例只需沿原 exact replay，已知应为 opening fee 2、realized fee 0、native realized net 0，并有第二条的 allocation；不能引入新选择规则。

**Spec：确定 bug。Quality：新调用点复制了 fast-path 条件却漏掉现成 guard。** 本例实际损害是把可计算结果变成不可计算并丢 allocation；没有证据证明本例发布了未来成交金额，不作此额外声称。

### ISR-01 单块自包含可执行 RED oracle

下列块不依赖前文变量，直接从当前冻结源构建 entries/source、打印差异，再断言既有合同的已知值。它将上面已经实跑的完整构造整理为独立可执行命令；新增末尾断言/集中打印的版本未另行执行，避免重复运行。按已观察值，最后断言会因 `null !== "2"` 失败；这不是声称已经生成另一次原始 RED 日志。

```sh
cd /Users/zhoulin/.codex/worktrees/0dc6/TradeReview
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText, file,
);
const F = require('./app/lib/reviews/homepage-v25-performance.ts');
const { buildTradeLibraryEntries } = require('./app/lib/trades/library.ts');
const { buildInstrumentTradeSummaries } = require('./app/lib/trades/instruments.ts');
const instrument = {
  id:'US:AAPL', symbol:'AAPL', name:'Apple', market:'US', currency:'USD',
};
const xs = [
  {
    id:'next-shanghai-day', accountId:'a', accountLabel:'A', instrument,
    side:'buy', quantity:'1', price:'100', fee:'10',
    executedAt:'2026-01-05T18:00:00Z',
    source:{ platform:'statement', row:1, tradeNature:'live' },
  },
  {
    id:'coarse-jan5', accountId:'a', accountLabel:'A', instrument,
    side:'buy', quantity:'1', price:'100', fee:'2', executedAt:'2026-01-05',
    source:{
      platform:'statement', row:1, tradeNature:'live',
      timePrecision:'date-only', tradingDate:'2026-01-05',
    },
  },
];
const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(xs), {}, {});
const source = F.prepareHomepageV25Source({
  entries, candlesByInstrument:{}, fxObservations:[], currentFxSnapshot:null,
  lifetimeSourceCoverage:[],
  revisions:{ trades:'review-new-1', metadata:'m', quotes:'q', fx:'f' },
});
const actual = F.readHomepageV25FinancialFacts(source, {asOf:'2026-01-05'}).groups[0];
const legacy = F.buildHomepageV25PerformanceFromEntries({
  entries, candlesByInstrument:{},
  period:{start:'2026-01-01',end:'2026-01-05'}, asOf:'2026-01-05',
});
console.log(JSON.stringify({
  input:xs,
  selected:actual.canonical.selectedExecutionIds,
  canonicalMode:actual.canonical.mode,
  canonicalFees:actual.canonical.terminal.fees,
  allocations:actual.allocations,
  openFees:actual.openFees,
  realizedFees:actual.realizedFees,
  nativeRealizedNet:actual.nativeRealizedNet,
  diagnostics:actual.diagnostics,
  legacyOpenFees:legacy.currentOpenFees,
}, null, 2));
assert.deepEqual(actual.canonical.selectedExecutionIds, ['coarse-jan5']);
assert.equal(legacy.currentOpenFees.value, '2');
assert.equal(legacy.currentOpenFees.available, true);
assert.equal(actual.openFees.value, '2'); // Current frozen candidate: null (RED).
assert.equal(actual.openFees.available, true);
assert.equal(actual.allocations.length, 1);
assert.equal(actual.allocations[0].executionId, 'coarse-jan5');
NODE
```

## 5. ISR-02 [P2] canonical 数量未知，分配子字段仍全部 available

位置：[performance.ts:1113](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-performance.ts:1113)，1113–1123。依赖对照：[ledger.ts:563](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/replay/position-ledger.ts:563)、574–580；F observer:732–734、最终 guard:294–303。

完整输入：

```js
const xs = [
  fill('b', '2026-01-05T15:00:00Z', {
    source: { historyIncomplete: ['prior-statement'] },
  }),
  fill('s', '2026-01-06T15:00:00Z', { side: 'sell', price: '110' }),
];
const actual = read(xs);
```

实际相关输出：

```text
actual.quantityCoverage.available = false
actual.quantityCoverage.reasons includes
  "execution-direction-unavailable", "quantity-unavailable", "history-incomplete"

canonical b.before.quantity = { value:"0", available:true, reasons:[] }
canonical b.after.quantity = {
  value:null, available:false, reasons:["quantity-unavailable","history-incomplete"]
}
canonical b.matchedClosedQuantity = { value:null, available:false, reasons:["quantity-unavailable"] }
canonical b.openedQuantity = { value:null, available:false, reasons:["quantity-unavailable"] }

actual.allocations[0] (executionId="b"):
  openingPoolBefore = "0"
  openingPoolAfter = "2"
  releasedOpeningFee = "0"
  movementFeeTotal = "2"
  movementFeeToClosing = "0"
  movementFeeToOpening = "2"
  realizedFeeDelta = "0"
  EACH FIELD: available:true, reasons:[]

actual.allocations[1] (executionId="s") fields unavailable,
  including reason "execution-direction-unavailable"
actual.openFees / realizedFees / nativeRealizedNet unavailable
```

这不是要求“一个 unknown 抹掉所有独立已知字段”。原始本笔 fee 总额 2 可以独立已知。错误在于**依赖可信数量/匹配角色的 opening/closing 分配与 pool/released/realized 分量**：canonical 已明确不能证明 b 是 opening 或 closing，新接口却无原因地肯定 closing=0/opening=2 和 pool after=2。

根因：1113 只读取 `movement.after.fees.reasons` 与 fee step 的原因白名单。`historyIncomplete` 在 canonical quantity/actual matching coverage 已生效，而 raw fee 自身仍已知；ordinary fee observer 在 `finishState` 合并 canonical 最终 quantity/reasons 之前触发，因此第一笔 step 没有该原因。这里不读取 movement 的数量/匹配 coverage，就把白名单为空当作了分配可知。group 的终态金额后来被 gate 住，**不能撤销已经暴露为 available 的子事实**。

期望依据：proposal:68 禁止新 knownness 放宽旧 canonical/F 门；78 要求不可信 matching 为 null+reason；126 禁止旁路 F pool unknown；dispatch SF04/SF07。数量依赖的分配字段应 unavailable 并保留其原因，raw `movementFeeTotal` 若证据完整仍可独立可知。这里没有要求给所有字段套一份粗糙共同原因，也不授权改变原 financial engine。

**Spec：确定 bug。Quality：原因字符串白名单没有表达字段依赖，已与 canonical typed coverage 分叉。** 新消费者若按 allocation 的 `available` 聚合，会把未知角色当作已知；本例 group 总额本身没有被宣称已知。

## 6. ISR-03 [P2? tentative] 空 episode executions 仍被认证为关联完整

位置：[performance.ts:1154](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-performance.ts:1154)，1154–1163。

完整输入：

```js
const xs = [
  fill('b', '2026-01-05T15:00:00Z'),
  fill('s', '2026-01-06T15:00:00Z', { side: 'sell', price: '110' }),
];
const entries = entriesFor(xs);
// 只损坏 episode 关联，entry.executions 原始 fills 不变。
entries[0].episodes[0].episode.executions = [];
const actual = read(xs, entries);
```

实际相关输出：

```text
actual.canonical.selectedExecutionIds = ["b","s"]
actual.episodeCoverage.available = true
actual.episodeCoverage.reasons = []
actual.episodeCoverage.episodeIds = [真实 builder 生成的原 episode ID]
actual.episodeCoverage.conflictingEpisodeIds = []
```

数据路径：F `collect:122–177` 沿 `entry.executions` 读取原始 fills，这是正确的 canonical 账本输入，所以 quantity/gross/fee 可以继续有自己的 knownness。新 `episodesByGroup:1078–1082` 仍拿到这一 episode 的完整 group 身份。但 `episodeFactCoverage` 找不到任何关联 fact 后在 1155 `continue`，最后仅因 episodes 数组非空，就在 1162–1163 返回 available。**原始 fills 能证明 canonical 财务，不能自动证明这个特定 episode ID 对应哪些 movement。** 当前没有批准“缺 lineage 时把整组 fills 绑定到首 episode”的兜底合同。

期望依据：proposal:134–139，尤其137“关联不完整/冲突必须保留原因和证据”；PRE-DISPATCH:146、200 规定缺适用 episode 的复盘资格 unknown；dispatch SF05。应保留 canonical 独立已知事实，同时把 episode 关联 coverage 标为 unavailable+可追溯原因；不伪造 fill、不抹掉 known finance、不默认全部完成或绑定首个 episode。

**Spec：tentative，待 root 确认本 API 的 episodeCoverage 是否承诺完整的 episode→movement 关联，而非仅“未观察到显式矛盾”。Quality：观察到未执行检验分支与已验证成功共用出口。** 按 proposal:137 的完整关联含义，该返回应 unknown；若 root 采用更窄含义，需要明确命名/调用方约束，不能据此直接认证保存对象。本例不是 future episode 尚未走完的争议，也不声称已执行错误保存或 canonical 金额出错。

## 7. ISR-04 [P2? tentative] date-only fill 元数据吞掉 episode endedAt 独立冲突

位置：[performance.ts:1159](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-performance.ts:1159)，1159–1160；被复用 helper [statement-evidence.ts:566](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/statement-evidence.ts:566)，特别571–585。

完整输入：

```js
const xs = [
  fill('db', '2026-01-05', {
    source: { timePrecision: 'date-only', tradingDate: '2026-01-05' },
  }),
  fill('ds', '2026-01-06', {
    side: 'sell', price: '110',
    source: { timePrecision: 'date-only', tradingDate: '2026-01-06' },
  }),
];
const entries = entriesFor(xs);
// builder 原本给出 closed/long，start Jan5、end Jan6，executions db/ds。
// status、方向、executions、entry 原始 fills 全部保留；只改结束声明。
entries[0].episodes[0].episode.endedAt = '2027-01-06T23:59:59.999Z';
const actual = read(xs, entries);
```

实际相关输出：

```text
canonical closing fact.time = {
  at:"2026-01-06T23:59:59.999Z", sourceDate:"2026-01-06", precision:"day"
}
actual.episodeCoverage.available = true
actual.episodeCoverage.reasons = []
actual.episodeCoverage.conflictingEpisodeIds = []
```

根因：1159 把 `{ ...lastRaw, executedAt: episode.endedAt }` 交给 fill 的 replay helper，但保留了 lastRaw 的 `timePrecision:'date-only'` 和 `tradingDate:'2026-01-06'`。helper 为了正确解释粗粒度**原始 fill**，优先使用其 source calendar date；因此 episode 的 2027 endedAt 被规范化回了 last fill 的 2026 日期，比较自然相等。它不是对 episode endedAt 做了独立精度校验，而是用另一来源的日期覆盖了要校验的声明。现有“status 与 endedAt 同时改错”的测试可以靠 status 分支失败，不能覆盖此 endedAt-only 案例。

期望依据：PRE-DISPATCH:36 与 root financial decision:5 明确 imported episode 与 canonical 实际关闭事实冲突要保留原因并 fail closed；proposal:137 明确关联 coverage 独立。此处完整 closed episode 的结束声明差一年，不能认证为一致。校验必须保留“episode 声明”与“canonical 时间事实”各自来源及精度，而不是强行给 day-only 数据增加精确时刻。

**Spec：tentative，待 root 明确“episode 与 canonical 冲突”是否包含对独立 endedAt 声明的检查。Quality：fill helper 确实用 lastRaw 的 source 日期覆盖了要比较的 episode 声明。** 按 PRE-DISPATCH:36/root decision:5 的字面完整冲突含义，这应报告关联冲突；若 root 明确 endedAt 纯展示、关联只由 lineage 决定，可把它排除于该 coverage 之外，但不能由本审查自行扩展合同。canonical 关闭事实仍在 2026，金额也没有被改到 2027；不作 canonical 年度财务错误声称。

## 8. episode 完整合同与仍需区分的政策边界

本报告没有把 `TradeEpisode` 当成本/平仓 authority。类型 [types.ts:181](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/trades/types.ts:181) 给出了其 account/instrument/nature/run、direction/status、startedAt/optional endedAt、opening/remaining quantity 与 `executions`；原始 `TradeExecution` 与 statement evidence 是 canonical 计算入口。`library.ts:151–172` 同时保存 builder 的 episode 对象与 entry 原始 executions，两者角色不同。

目前已批准合同可直接得出的要求：

1. 同完整 group 的 canonical 实际可信 quantity/transition 决定业务 round；partial 不关一轮，reverse 关旧开新，event 不造 fill。episode ID 只用于稳定关联/详情/复盘，不能以 status/endedAt 改写真实关闭日或金额。
2. 本审查对完整冲突合同的解释是：当一个**完整且已可见** episode 声称已闭并提供 endedAt，而且 API 承诺其与 canonical 关联已知，则应独立检查结束声明与实际事实。独立检查不等于把 endedAt 升为 authority。**这个字段是否被 root 纳入本 seam 的关联 coverage 承诺，仍须 root 确认，ISR-04 为 tentative**；它不涉及新增计价政策。
3. 没有可用 episode→movement lineage 时，raw fills 仍可支撑 canonical 金融值，但本身不能认证特定 episode 的归属、pending eligibility 或详情写入对象。**本字段究竟承诺完整关联还是仅显式冲突扫描，由 root 确认，ISR-03 为 tentative。** 它不要求 raw fills 失去 knownness，也不授权猜测关联。
4. count/date/native/allocated fee/winner/FX/class/episode coverage 各自保留；episode 问题不能把已知 canonical 数量或所有金融值粗暴清空。反过来，canonical 金额可知也不能给 episode coverage 背书。

需要 root 另行明确或由后续财务 read-model 合同落实、**本报告没有当作额外已证 bug**的部分：

- 跨多轮、反转 split、当前 asOf 仅覆盖某个真实 episode 前段时，应该怎样表达“未来部分尚未到达”与“关联资料缺失”，以及 episode 级 coverage 的适用集合。本报告没有要求把所有 future/open episode 都当冲突。
- episodeCoverage 的完整性含义与 endedAt 是否须独立校验，及粗粒度 endedAt/精确 canonical instant 的允许一致关系、缺 optional endedAt 影响哪些能力。ISR-04 的实际输出不是“只差时区/毫秒”，但要先确定本接口是否承诺覆盖该声明。
- 如果 root 有意改为彻底忽略 episode endedAt 的声明、只信规范化 lineage 来关联，那是对现有“与 canonical 冲突 fail closed”覆盖范围的显式澄清，需要更新调用方合同和 coverage 含义。当前实现既尝试比较该字段、又被 fill source 元数据覆盖，不能自行代表这一新政策。

## 9. authority、A 成本/缓存与证据限制

读到的正向边界：ledger 的新增 observer 从同一 evaluator 的实际分支取 closed/opened/gross delta，`try/finally` 保留 continue 路径；state fact 将 Decimal 导出为不可变全精度字符串。F 的新增 fact 读方法复用原 replay/ordinary pool，不重新做 IPO cash cost 或平均成本；incurred FeeFacts 保留原知识/发生日 lineage。classification 只用既有 duplicate acquisition authority，不把 sourceTradeId 冒充 disposal link。没有 UI/S/URL/session 写入或新 host。

普通 A 默认调用链未新增无条件 fact collection。`readPreparedPositionFacts` 的 graph/digest、F 的 movement/fee lookup Maps 都是显式 read 的局部对象；未看到新增保留在 prepared/source/memo 的 Map。`retainedFactBytes:0` 只表示不保留，不代表调用期间不分配内存。attached exact fallback 仍可能多次评估原 evaluator，不能宣传为线性；本审查不重做 benchmark。

非阻断的文档质量提示：ledger:600–601 注释称 empty/short query “never rescan the full source”，但619 的首个普通 prefix query 会执行一次完整 `evaluate({})`；当前 DESIGN-COVERAGE:20 反而准确记录“一次完整 observed sweep”及256 transitions。应统一注释含义为“无每 query 的全量重扫”；现有 dispatch 允许一次共享 sweep，这不是本报告新增的复杂度 FAIL。

本审查没有重跑 worker 的回归/strict/lint，也没有声称公共 A 性能退化或通过。新反例是在冻结源上执行的正确性证据；原脚本没有写产品/永久测试，完整字面输入保存在本文供 root/原 owner 后续有界使用。原 243/244 PASS 与性能九样本可证明其覆盖的原场景，不能否定未覆盖的新反例。

收尾时 root 通知：其正式原始九样本中 4/9 超过2000ms（long1 2370.235791；multi 2047.638232 / 2038.384321 / 2059.121083），equality/oracles/cache PASS。这是 **root 反馈的独立性能结果**，不是本审查执行或重跑的证据。它与本文两个确定输出问题分别成立；正式 candidate1 判定与 candidate2 有界派发仍由 root 决定。

本票纯 read-only financial seam，UI/浏览器/数据库写入为 NA（范围理由：无画面或持久化改动）；完整首页数据接线、实际详情/保存/返回/reload、全控件与视觉仍 NOT VERIFIED，不能由本文放行。root 保留正式验收与轮数裁定，旧 ContributionBars 3/3 冻结失败和 HistoryChart 独立候选均不受本文改动。
