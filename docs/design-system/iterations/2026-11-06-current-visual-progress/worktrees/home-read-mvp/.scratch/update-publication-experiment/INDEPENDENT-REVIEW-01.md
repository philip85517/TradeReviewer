# 候选 01 独立验收记录

日期：2026-10-29  
结论：**PASS，限本实验声明的合成 CLI 范围**。协调者最终接受仍为 NOT VERIFIED。

## 固定证据版本

本次审查以 [SNAPSHOT.json](SNAPSHOT.json) 中候选 01 为准，代码摘要为 `28b1b5bda18251af10638d0fc24b484671667b9edd2b3a92aac4216e200c237e`。独立核对了清单中的 12 个代码/运行环境文件和 3 个结果证据文件，15 个 SHA-256 均与快照记录一致。检查没有更改候选源码、快照或结果。

## 检查命令与结果

从 worktree 根目录执行，使用项目固定 Node 26.0.0 / SQLite 3.53.0：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/update-publication-experiment/core.test.mjs .scratch/update-publication-experiment/concurrency.test.mjs .scratch/update-publication-experiment/runtime.test.mjs .scratch/update-publication-experiment/oracle.test.mjs
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/update-publication-experiment/run.mjs --check
```

独立重跑测试为 14 passed、0 failed、0 skipped（386 ms）。`--check` 返回 PASS；10 个候选脚本语法检查均为 0，输出 `databaseOpened: false`。测试使用内存数据库或自建的私有临时目录；本次未运行 `--light`，未启动服务，未连接或运行正式业务数据库。

快照摘要和全部文件 SHA-256 的核对使用下列只读检查：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const base = '.scratch/update-publication-experiment';
const snapshot = JSON.parse(fs.readFileSync(`${base}/SNAPSHOT.json`, 'utf8'));
const entries = [
  ...snapshot.codeManifest.map(entry => ({ ...entry, file: entry.path })),
  ...snapshot.evidence.map(entry => ({ ...entry, file: path.join(base, entry.path) })),
];
for (const entry of entries) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(entry.file)).digest('hex');
  if (actual !== entry.sha256) throw new Error(`SHA-256 mismatch: ${entry.file}`);
}
console.log(`PASS: ${entries.length} snapshot hashes match`);
NODE
```

## 独立审查发现

未发现阻断本候选局部正确性的事务或数据隔离问题。代码把实验 `source_facts`、投影、摘要和版本状态放在同一 SQLite 数据库，并在同一 `BEGIN IMMEDIATE` 写事务内发布；读取路径在一个 deferred read snapshot 内读取版本、摘要和分页数据。游标绑定发布版本与范围。独立 reader worker 和显式屏障覆盖写入前、未提交阶段及提交后的快照，另有未包读事务的混读负例。独立 oracle 从 `source_facts` 计算预期结果并对照全量与增量路径。

审查还确认候选只把冻结 run-02 投影复制到自己的实验目录，并以只读方式处理原始输入；后续实验写入目标位于 `.data/update-publication-worker/candidate-NN/`。本次独立审查没有重新执行该复制流程，因此此项结论来自代码审查及已冻结的候选结果证据，并非新的真实数据复制试验。合成 `source_facts` 与真实产品导入/修订是不同的原子性边界。

### 证据保全限制（非本候选 01 的阻断项）

在 [run.mjs](run.mjs) 中，候选编号只通过检查 `.data/update-publication-worker/candidate-NN/` 目录选取；结果保存调用 `writeFileSync`，未使用独占创建或先检查结果文件。如果某个旧候选的数据目录被清理、但 `results/candidate-NN.json` 仍留存，后续运行可能重用该编号并覆盖旧结果，削弱证据可追溯性。候选 01 当前数据目录仍存在，且其结果文件 SHA-256 与快照一致，因此没有发现本次结果已被覆盖的证据。后续实验运行前应先检查这两处路径并保留旧证据；本记录不修改运行器。

## 局部验收边界

PASS 仅表示冻结候选的代码清单、局部测试、语法检查和声明的合成发布/读取契约通过独立复核。候选中由实现者执行的一次 `--light` 属于有限 CLI 样本；本审查没有重跑基准，也没有据其推导稳定性能倍数或完整首屏时限。

以下事项仍为 NOT VERIFIED 或不在范围内：

- 真实产品导入、真实修订/撤销与产品投影是否共享同一事务；正式业务库安全性之外的产品写入行为。
- HTTP、浏览器首屏、完整页面一秒目标、前端控件/布局/状态接线，以及冷启动或独占负载性能。
- 财务 P1/F07、Bars、真实重复导入、金额/费用/盈亏、行情/FX、产品版本通知。
- 崩溃/断电恢复、并发恶意路径替换、多个并发写者以及锁等待/超时策略。
- Unicode 排序与国际化搜索；候选只接受受限 ASCII 排序键，日期按字符串前缀处理。

本记录不恢复上述暂停范围，也不等同于最终产品接受或浏览器验收。进一步耗时基准须由协调者另行放行。

## Benchmark tool-01 独立预审

审查日期：2026-10-29。冻结输入为 [benchmark/SNAPSHOT.json](benchmark/SNAPSHOT.json)，工具摘要 `d87894b331814d60a33e4433b77098bc4fa1aa083bf05ecafbb55316cb982d62`，固定投影主文件摘要为 `88cd4498cb3f1ee3d6d44a6b68c92d8870a34061dc38be69fe3bbaedd850bc3f`。只读核对确认快照中的 8 个工具文件及 21 个支持文件 SHA-256 全部匹配当前内容。新加的合成单测验证固定投影 SHA、seed SHA 和空 WAL 门槛；也检查来源复制需保持哈希且拒绝覆盖。

独立复核命令如下，均从 worktree 根目录执行：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/update-publication-experiment/benchmark/run.mjs --check
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/update-publication-experiment/benchmark/engine.test.mjs .scratch/update-publication-experiment/benchmark/copy.test.mjs .scratch/update-publication-experiment/benchmark/control.test.mjs
```

`--check` 返回 PASS，并报告 `databaseOpened:false`、`performanceMeasured:false`；8 个工具文件语法检查通过。合成单测 8/8 通过。另用只读 Node 脚本按快照清单重算 SHA 和摘要，核对 8 个代码文件与 21 个支持文件无差异。未运行 `--run-authorized`，未读取或打开真实源数据库，也未生成性能样本。

### 决定性阻断：实际入口不执行 tool-01 冻结校验

当前源码与 `d87894…` 冻结清单一致，但真实入口没有强制这一身份。`benchmark/control.mjs` 的 `verifyFrozen()` 读取父目录的 `OWN/SNAPSHOT.json`，只校验候选 01 的代码和证据；它不读取 `benchmark/SNAPSHOT.json`。`run-authorized.mjs` 在启动时动态计算当前工具 `toolManifest()` 摘要，只在运行结束时确认工具未在这次运行中途改变。因而冻结审查后若工具文件被替换，入口仍会采用新代码开始测量。`--check` 也只检查候选 01 的冻结清单与工具语法，不会拒绝偏离 tool-01 快照的代码。当前文件哈希一致只能证明本次检查时内容匹配，不能弥补入口缺少冻结门禁。

因此结论为：**BLOCKED，不可执行实际隔离测量**。入口和 `--check` 都应读取并验证 benchmark 快照的代码摘要/清单及其预期支持证据；应添加工具代码偏离快照时拒绝执行的合成负例，然后重新冻结并由独立审查确认新摘要。此项修复完成后，实际测量仍须等待协调者另行明确放行。

### 测量范围与剩余未覆盖

静态审查显示样本设计使用相同初始快照，逐对交错 full/incremental 更新路线，验证分页范围、摘要及首个 API 读取，并分别计时准备、更新、首读和验证。报告明确描述合成 source model 与产品源/导入原子性的差别，也明确排除浏览器首屏、冷缓存、独占机器和统计稳定性结论。本次没有执行真实样本，因此这些是实现与文档层面的审查，不是运行结果证据。

真实文件当前是否匹配固定摘要、原始 WAL/SHM 状态、复制期间的并发变化、隔离目录实际权限、性能结果正确性均未在本次审查中验证。即使修复冻结门禁并获准运行，该 CLI 也不能证明产品导入与投影原子发布、HTTP/浏览器首屏时限、财务 P1/F07、Bars 或重复导入正确性。

## Benchmark tool-02 独立预审

审查日期：2026-10-29。冻结输入为 [benchmark/SNAPSHOT-02.json](benchmark/SNAPSHOT-02.json)。外部提供并独立复核的快照 SHA-256 为 `40941bc9ed590718da67b0d2bb62088ebfcb7ad895df0f1ade86978449b7966b`，代码摘要为 `e8b7cdecd16cdbc1202d5a778c696e03c61dfe4646fcf5c043650bf6ec4bef93`，支持文件摘要为 `59b797d237feb2baca772a540703cece160202ec00d5d2af9fb8edf9b27d76f8`。逐项重算确认 9 个工具代码文件和 12 个支持文件均与冻结清单匹配；快照记录的路径顺序、字段白名单和摘要格式也符合校验器的严格检查。

独立检查命令如下，均从 worktree 根目录执行，使用项目固定 Node 26.0.0 / SQLite 3.53.0：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/update-publication-experiment/benchmark/run.mjs --check
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/update-publication-experiment/benchmark/control.test.mjs .scratch/update-publication-experiment/benchmark/copy.test.mjs .scratch/update-publication-experiment/benchmark/engine.test.mjs .scratch/update-publication-experiment/benchmark/freeze.test.mjs
```

`--check` 返回 PASS，报告 `databaseOpened:false`、`performanceMeasured:false`，9 个工具文件的语法检查均通过，并回显与上述外部值相同的代码摘要、支持文件摘要和快照 SHA。13 项合成测试全部通过。测试包含冻结代码/支持文件偏移、清单格式/顺序/白名单异常、快照损坏或缺失等拒绝路径；还验证 `--check` 与授权入口会在动态加载测量模块、保留输出目录或构造 SQLite 连接之前失败。冻结复核时 `.data/update-publication-worker/benchmark` 和 `benchmark/results` 均不存在，也没有遗留的 freeze fixture。

只读检查还确认 archive/tool-01 中 30 个已保全文件均匹配归档清单的 SHA-256，旧的 `benchmark/SNAPSHOT.json` 仍与归档摘要一致；本次未覆盖或改写 tool-01、候选 01 或既有结果。没有执行授权测量，没有读取或打开真实源数据库，也没有生成新的结果证据。

### 独立判断与证据限制

结论：**PASS，可进入由协调者单独放行的隔离实际测量阶段；本结论不是实际测量结果，也不是产品接受。** `--check` 和授权 CLI 在动态导入测量模块前验证 tool-02 冻结；直接调用授权运行函数时也先验证工具与候选支持证据，随后才会保留输出路径或打开 SQLite，并在结束时再次验证。冻结测试通过模块加载哨兵、文件系统和数据库构造哨兵检验这些拒绝顺序。检查路径和支持清单均固定且摘要一致；候选 01 与 tool-01 的旧归档证据保持不变。

校验信任根是协调者独立保留的 `SNAPSHOT-02.json` SHA-256。本审查将本次复核到的 `40941…` 作为外部输入比较；工具自身没有对快照签名，也不声称可防御攻击者同时篡改验证器与快照，或检查结束后的 TOCTOU 替换。快照排除自身和冻结后回执以避免自引用；这项局限已在工具调试说明中披露。它不阻止本次受限验收，但后续实际测量应继续保留并核对该外部摘要。

该 PASS 只覆盖冻结清单强制、调用顺序、合成拒绝负例、语法检查及既有证据保全。真实源复制/WAL 一致性、目录权限、实际数据库读写与结果正确性、测量公平性/性能统计、并发负载和产品原子性尚未由此验证。实际运行的性能工具仍是 CLI 实验，不代表浏览器首屏通过；财务 P1/F07、Bars、真实重复导入及正式库写入继续保持暂停。真实基准应只在协调者另行放行后对隔离私有副本运行。
