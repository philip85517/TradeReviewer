# 第5轮最终候选：保留异常正文，先识别合法表格边界

冻结于 2026-10-28 01:21:42 +08:00。30 个源文件/测试文件的 SHA-256 已逐一核对当前文件和冻结副本一致：[清单](CANDIDATE-05-CANDIDATE-HASHES.json)、[元数据](CANDIDATE-05-METADATA.json)、[本任务累积差异](CANDIDATE-05-TASK-ONLY.diff)、[相对第3轮差异](CANDIDATE-05-DELTA-FROM-03.diff)，副本在 `CANDIDATE-05-files/`。第3轮22文件中仅 exact-file-import.test.ts、futu-pdf.ts、tiger.ts 改变，另8个 parser/测试文件加入本任务；其余原有 dirty 工作由任务前快照保留。最新别名已指向第5轮，1/2/3轮原件未覆盖。

这是第5轮最终实现候选，**独立验收待执行，不是交付完成**。root 负责集成与接受，finish_candidate 负责实现，round3_review 负责独立复验。若本轮仍失败，按用户上限停止，不继续第6轮。代码在冻结后停止修改。

## 根因与最终规则

1. TradingView CSV 的单行字段失败和重复进/出场角色此前只记 diagnostics 后跳过。现在每个已证实遗漏记 pending invalid-row；其他完整配对保留，不能据此记整个文件成功。
2. 招商独立列在收集阶段以日期有效性过滤正文，后续放宽又误把单列页码当正文。现在整行分页文字（包括拆列）先排除；日期不合法时，业务、证券代码、原始数值列需有两个独立证据组，才交主 parser 校验。坏日期且空业务、但证券与财务列完整的行也保留 pending。使用原始列文本，不要求数字先解析成功；不固定 y 坐标，也不重置无表头续页布局。
3. 招商旧 combined 布局保留日期与未知业务原文，并按整行识别拆分页码；新股配号、说明等结束节沿用现代布局同一边界，避免后节内容误收为流水。合法现金先由主 parser 认定 ignored，无需满足成交日期要求。
4. Tiger 候选收集使用原始数量/价格和证券身份，方向为空、数字和时间一起损坏的旧版正文仍送校验。明确合计代码先排除，作用于全部候选分支。身份/日期拆行继续只在主行14px内关联，保留正常多行、费用、跨页和合计行为。
5. 富途 PDF 已分配订单身份内，有原始时间与执行列文本，或至少两个财务列原文的子成交，即使时间和数值一起损坏也送数值校验。费用续行先按既有规则处理；孤立页码不满足正文形状，纯时钟续行没有执行列值。正常子成交仍完整聚合。

这些修改不涉及财务/Bars 计算、业务数据库或提交。解析→enrich→preview→intent→公开 HTTP prepare/commit→SQLite 重开→改名重试均在每例 mkdtemp 的 isolated.sqlite 中验证；没有以乐观 complete 标志替代原始完成证据。

## 红绿证据

所有日志保留，不把局部通过改写为整体验收。

| 日志 | 结果与覆盖 |
| --- | --- |
| RED-08 / GREEN-10 | TV 两种异常 parser+HTTP：4失败21通过 → 25通过 |
| RED-09 | CMS新旧、Tiger、Futu静默丢行：14失败146通过 |
| GREEN-11 | 首次 Tiger 修复误切多行，7失败153通过；保留 FAIL |
| GREEN-12 | 5文件162通过；之后独立审查发现反例，不能代表第4轮接受 |
| RED-10 | 正常招商页脚 parser+HTTP：3失败47通过 |
| RED-11 | 页码拆列、日期+空业务、Tiger带方向合计：8失败119通过 |
| GREEN-13 | 上述边界修复局部6文件180通过；未包含后续损坏时间反例 |
| RED-12 | 富途时间 bad/空且数值坏：4失败70通过 |
| RED-13 | Tiger空方向、坏数值+时间及真实HTTP：4失败81通过 |
| GREEN-14 | 6文件187通过；尚未含旧招商下一节反例 |
| RED-14 | 旧招商新股配号后节误收：1失败17通过 |
| **GREEN-15** | **最终6文件188通过，exit 0** |
| **TYPECHECK-09** | **最终 tsc --noEmit exit 0，空输出** |
| CORPUS-REGRESSION-05 | 4文件36通过、2文件2测试跳过，exit0；在最后旧招商结束节补丁之前运行，不冒称最后补丁全仓回归 |
| CORE-PARSER-REGRESSION-04 | 第4轮时间点18文件215通过，3文件6测试跳过，exit0；历史证据 |

最终命令（固定 Node 26.0.0；API 测试自身每例临时隔离库）：

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/import/china-merchants-columns.test.ts app/lib/import/china-merchants-s3a.test.ts app/lib/import/tiger.test.ts app/lib/import/futu-pdf.test.ts app/lib/import/tradingview-simulation.test.ts app/api/storage/trades/exact-file-import.test.ts --maxWorkers=1
./scripts/native-node.sh node_modules/typescript/bin/tsc --noEmit
```

本轮其余证据命令：

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/import/china-merchants.test.ts app/lib/import/china-merchants-corpus.test.ts app/lib/import/monthly-corpus.test.ts app/lib/import/monthly-reimport.test.ts app/lib/import/enrich-import.test.ts app/lib/import/import-preview.test.ts --maxWorkers=1
```

## 第4轮保留、范围与未完成项

第4轮独立验收为 FAIL，见 [ACCEPTANCE-ROUND-4.md](ACCEPTANCE-ROUND-4.md)。其审查时整体候选未冻结；已把五个变动 parser 生产版本重建为只读 [快照说明](CANDIDATE-04-FAILED-STATE.md) / [哈希](CANDIDATE-04-FAILED-PRODUCTION-HASHES.json)，不是把不同时间的文件假装成原始整体快照。modern、Tiger、Futu 三个版本与独立审查提供 SHA 完全一致。所有 RED 与失败 GREEN 均保留。

- 真实浏览器上传、保存、返回/reload、匹配视口视觉及控件最终覆盖仍 **NOT VERIFIED**。root 报告本地 URL 被浏览器安全策略拒绝；自动化不能代替这些门槛。
- 未重复全量测试。REGRESSION-04 的9项 TradingView compatibility-store失败涉及额外 audit/proof 表快照；本轮未改其断言或数据库结构。npm test schema17期望/18实际仅定位，见 [SCHEMA-17-18-ATTRIBUTION.md](SCHEMA-17-18-ATTRIBUTION.md)，未改范围外代码，不能声称整仓通过。
- 没有第5轮95%分支覆盖证据；第3轮43.13%是历史测量，不满足该目标。跳过、未验证和全量失败不消失。
- 富途缺费用的既有 unknown-futu-fee/feeStatus unknown/reviewRequired 语义未改；它保留成交，未证实为本轮静默丢成交问题。没有将任意 warning 一律阻断。
- screenshot、历史真实材料、多文件真实队列、触控与完整键盘路径仍保留先前 NOT VERIFIED。

冻结后只写此交接记录，不修改30个源文件。独立接受结果由协调者填写。
