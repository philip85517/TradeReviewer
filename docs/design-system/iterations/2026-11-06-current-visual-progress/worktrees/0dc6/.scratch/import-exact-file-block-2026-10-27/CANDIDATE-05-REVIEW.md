# 第 5 轮独立审查记录

审查者：round3_review；日期：2026-10-28。工作目录 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`。审查对象为 [CANDIDATE-05-CANDIDATE-HASHES.json](CANDIDATE-05-CANDIDATE-HASHES.json) 固定的 30 个生产/测试文件，冻结时间见实现记录。本审查不修改这些文件，不修改业务数据库，不启动第 6 轮。

**本次解析与后端重复文件保护范围 PASS，未发现剩余生产阻断。整体功能不能据此标为完成：真实 UI/视觉仍 NOT VERIFIED，95% 分支覆盖目标亦无本轮达成证据。** 先前 FAIL 与未验证门槛保持原状态。

## 独立命令与版本校验

最终独立测试命令：

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/import/china-merchants-columns.test.ts app/lib/import/china-merchants-s3a.test.ts app/lib/import/tiger.test.ts app/lib/import/futu-pdf.test.ts app/lib/import/tradingview-simulation.test.ts app/api/storage/trades/exact-file-import.test.ts --maxWorkers=1
```

实际输出（独立执行会话 32615）：

```text
RUN v4.1.10 /Users/zhoulin/.codex/worktrees/0dc6/TradeReview
Test Files  6 passed (6)
Tests       188 passed (188)
Start at    01:22:22
Duration    14.99s
exit_code   0
```

测试开始前逐项校验以下清单；独立链路脚本也在运行前、运行后逐项校验同一清单。校验使用文件字节的 SHA-256，不以修改时间代替。可复跑的校验命令：

```sh
./scripts/native-node.sh --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(readFileSync('.scratch/import-exact-file-block-2026-10-27/CANDIDATE-05-CANDIDATE-HASHES.json', 'utf8'));
const mismatches = Object.entries(manifest).flatMap(([path, expected]) => {
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  return actual === expected ? [] : [{ path, expected, actual }];
});
console.log(JSON.stringify({ files: Object.keys(manifest).length, mismatches }));
if (mismatches.length) process.exitCode = 1;
NODE
```

测试前输出 `{"files":30,"mismatches":[]}`；独立链路输出 `hashes-before 30`、`hashes-after 30`，不匹配会抛出而非继续。该链路会话 83063 最终 exit 0。Node 的 DEP0205 警告不是测试失败。

关键生产文件 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| china-merchants-table.ts | c84cb6a5d208f233704114fa402f2e0554ebd47527156660e19612cae743431e |
| china-merchants-legacy-layout.ts | 745952d6ddd5525b7b277e459b83eb5e063fac7ad450e4a8268742c1ebb56dd6 |
| tiger.ts | b56090701108c1e81e5f80972e3698210bf9cbc50b313e4a4d79ba8abbab45d9 |
| futu-pdf.ts | 740189fcc1f49172d896d663a7382feb4f324a4076be786054c981a337d6ca84 |
| tradingview-simulation.ts | b508810dfbc308dcccad136f5e2fa0cede6e215379feb5fdf5c6d15f81076b31 |
| sqlite-store.ts | b1eb65b4620256d1d6f45655b9399eb69ec3509d7395d07835cde8cbc9ea5122 |

## 六场景独立持久化链路

除了上述 Vitest，还执行了独立的 shell 内联 Node 模块脚本（入口 `./scripts/native-node.sh --input-type=module`，没有保存为生产/测试文件）。它使用 Vite middleware-only 模式加载实际 TS 模块，并仅替换 `server-only` 哨兵模块；未监听端口、未调用浏览器。

环境隔离方式：`mkdtemp` 在操作系统临时目录下创建 `tradereview-round5-independent-*`；每个案例的数据库均位于该目录，并显式设置 `TRADEREVIEW_DB_PATH` 后才打开。调用真实 `db/sqlite` 与 SQLite store；每例 commit 后关闭并重新打开同一文件，再重试 prepare。最终关闭连接并清理临时目录，实际输出 `isolated-db-cleaned true`。未打开或写入配置默认业务库；没有调用任何浏览器工具。

链路为：实际 `parseBrokerStatement` → `enrichStatementImport` → `createImportPreview` → `monthlyImportIntent` → `createSqliteHttpClient` → 真实 `plans/route.ts`、`commit/route.ts`、`read/route.ts`（由 `Request` 转发）→ 实际 SQLite 写入 → 关闭重开 → 再次 prepare。这里的 HTTP 是公共 HTTP client 与真实 route handler 的 Request/Response 链路，不是浏览器网络请求。证券 resolver 注入有效元数据，避免将证券补全失败误算成本次行识别问题。

下列输入均从现有夹具新建，不修改夹具文件：

```js
// 导入来源：__fixtures__/china-merchants-columns 的 columnStatement；
// __fixtures__/futu-pdf-layouts 的 legacy；
// __fixtures__/tiger-legacy-pages 的 legacyPages；
// __fixtures__/tradingview 的 csv、row、fileFor。
const cmsFooter = columnStatement();
cmsFooter[0].items.push({ text: '第1页/共1页', x: 390, y: 580, width: 70, height: 8 });

const cmsBad = columnStatement();
cmsBad[0].items.find(i => i.y === 182 && i.x === 20).text = 'bad';
cmsBad[0].items.find(i => i.y === 182 && i.text === '证券卖出').text = '';

const futuBad = legacy('F1');
const child = futuBad[0].items.filter(i => i.y === 102 && i.x > 200)
  .map(i => ({ ...i, y: 120, text: i.x + i.width < 390 ? 'bad-time' : 'bad' }));
for (const i of futuBad[0].items) if (i.y >= 120) i.y += 18;
futuBad[0].items.push(...child);

const tigerBad = legacyPages();
for (const i of tigerBad[0].items)
  if (i.y === 250 && [370, 440, 1010].includes(i.x)) i.text = 'bad';

const tvInvalid = fileFor(csv + '\r\n' + row(9, '多头进场', 'not-a-date', '10'));
const tvDuplicate = fileFor(csv + '\r\n' + row(1, '多头进场', '2021-02-19', '999'));
```

PDF 输入字节由 `%PDF-1.7\nfixture:` 加 `JSON.stringify(pages)` 构成，向 dispatcher 注入 `extractPdfPages: async () => pages`。这使真实文件指纹流程覆盖夹具字节，但**没有覆盖真实 PDF 二进制解码/PDF.js 文本提取质量**；不得把这些案例描述成真实券商 PDF 或浏览器端到端验收。

独立脚本在每例断言 `input.fileImport.complete` 等于预期、保存结果有无 `importedFile` 等于预期，并断言重开后的 prepare 是否允许与预期相符。以下是实际输出整理；`receipts` 是 `trade_change_receipts` 普通事务回执行数，不等同于强成功字段 `result.importedFile`。

| id | records / blocked | exclusions | complete | importedFile | 重开后重复 prepare | facts / materialVersions / receipts |
| --- | --- | --- | --- | --- | --- | --- |
| cms-footer | 2 / false | [] | true | 有，见下 | 409 FILE_ALREADY_IMPORTED | 2 / 1 / 1 |
| cms-bad-date-business | 1 / false | invalid-row, pending, count 1 | false | null | 允许 | 1 / 1 / 1 |
| futu-bad-time-numbers | 1 / true | []，由 error/blocked 保留未完成 | false | null | 允许 | 0 / 1 / 1 |
| tiger-bad-time-numbers | 0 / true | invalid-row, pending, count 1 | false | null | 允许 | 0 / 1 / 1 |
| tv-invalid | 2 / false | invalid-row, pending, count 1 | false | null | 允许 | 2 / 1 / 1 |
| tv-duplicate | 2 / false | invalid-row, pending, count 1 | false | null | 允许 | 2 / 1 / 1 |

六例 plan 均返回 `ready`。正常页脚保存的文件身份为：

```json
{"sha256":"4d4619dceef43ebf77ae96beb4c9093693051608648d0847aa012c2980811dac","byteLength":3444}
```

异常案例允许保存其余证据并保留普通事务回执，并没有被错误记作整个文件成功；重开后仍可重试。记录 `plan=ready` 不能替代 UI 对 blocked/review 状态的实际控制验证。

## 正常输入与最终代码复核

独立脚本额外确认：招商普通/续页页脚两种 `continuation=false/true` 均为 2 条正常成交且没有额外排除；招商已识别现金类型 `利息归本` 即使非成交日期也保持 ignored、不被误判；Tiger 旧版 `买入合计` 保持 1 条真实成交且没有 blocked、排除或诊断。输出分别为 `normal-cms-continuation false PASS`、`normal-cms-continuation true PASS`、`normal-cms-cash PASS`、`normal-tiger-total PASS`。

最终 188 项测试亦覆盖正常表头、费用/时间/身份续行、跨页、拆列页脚、旧版现金、现代/旧版招商未知业务、旧版新股配号后节和富途多种布局。反例基于有效夹具定点损坏原始正文或追加正常页脚/合计，没有通过直接伪造 `complete` 来冒充 parser 证据；API 测试另有乐观调用者强置 `complete=true`、由服务端依据保留证据拒绝强成功的检查。

| 最终生产位置 | 复核结论 |
| --- | --- |
| app/lib/import/china-merchants-table.ts:95、100-105 | 先认整行分页；坏日期行以独立业务/证券/原始财务列保留，正常孤立页脚不进入校验 |
| app/lib/import/china-merchants-legacy-layout.ts:323-336 | 下一节关闭流水布局；整行拆列页码排除；最终新增后节回归包含在本次 188 项内 |
| app/lib/import/tiger.ts:286-297、319-332 | 保留空方向、坏数字正文；所有候选分支先排除明确合计；身份/时间拆行仍遵循 14px 关联 |
| app/lib/import/futu-pdf.ts:250-267 | 坏时间且全部数值损坏的子成交进入 error；费用已先消费；纯时间续行仍走独立分支 |
| app/lib/import/tradingview-simulation.ts:400、406 | 无效行与重复 role 记 pending，其他完整配对保留；服务端复核不会据此强记整个文件成功 |

## 结论边界

第 4 轮已发现的页脚误伤、招商坏日期且空业务漏判、Tiger 合计误伤、富途坏时间/坏数值漏判，以及后续 Tiger 空方向坏数值/时间漏判，在本次冻结候选下复验通过。第 4 轮历史记录不能被本次 PASS 改写。

本记录不是完整 UI 接受、真实券商 PDF 语料接受或全仓通过声明；未复跑全量测试、未独立复跑 TypeScript。真实浏览器上传、确认前提示、保存返回/reload、视觉和控件覆盖均保持 NOT VERIFIED；浏览器安全拒绝没有绕过。95% 分支覆盖门槛由协调者继续按实际证据记录，不能用 188 项通过抵消。未验证门槛依项目工作流继续阻止整体交付完成。
