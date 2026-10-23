# P4 financial fact seam — root 第1/3轮：FAIL

2026-10-23；root 独立接受。候选源/测试以 CANDIDATE-HASHES.json 为准，ledger 37a121bf…、F f4091fb3…；本轮不是 A 原三次失败的改名，亦不重置财务恢复轮数。原 A 恢复1/3 PASS证据保留；本扩展的相邻性能门重开，当前不可据旧A记录宣称最终版通过。

Root直接读新增接口/旧ordinaryState/evaluator路径，独立执行四个真实source反例，见 root-independent-repro.cjs / root-independent-repro.jsonl（exit0）。初次脚本相对require目录错误已纠正，是工具脚本错误，不是产品缺陷。独立审查来源 INDEPENDENT-SOURCE-REVIEW.md。

|问题|根因与观测|裁定|
|---|---|---|
|ISR-01|canonical合法选择仅coarse-jan5、fee2；F遗漏ordinary前缀guard，按长度跑被排除的第一条fee10，allocations空/openFee未知，而旧wrapper已知2|FAIL；复用已有exact fallback，禁止改选择语义|
|ISR-02|historyIncomplete令matched/opened quantity未知，新allocation仍把openFee2/closeFee0/pool2认证为available|FAIL；按字段依赖传播coverage，原始fee total2可独立已知，不能全字段粗暴清空|
|ISR-03|entry原始b/s完整，但episode.executions=[]；episodeCoverage仍true|FAIL；缺关联未知，canonical财务可继续独立已知，不把整组绑定首episode|
|ISR-04|date-only fill实际2026关闭，episode.endedAt单独改2027，fill helper保留tradingDate把声明覆盖回2026，未报冲突|FAIL；独立解释episode声明与canonical精度。只检查粗粒度一致性，不给date-only造精确时刻|

Root冻结相邻8文件364/364测试PASS（包含新旧财务244、domain71、chart49），日志 continue-2026-10-23/final-leaf-review/root-frozen-regression.log。该通过不能否定新增反例。

## 原性能门回归

root按calendar-resume原benchmark.config.ts/benchmark.test.ts与immutable-sharing原1866×365 fixture顺序执行九fresh进程，所有worker无CPU测试/build/browser。原输出 P2/data/calendar-resume/root-seam-check1-*，无静默重试、未改阈值或选择最佳样本。

|形态|三次cold ms|结论|
|---|---|---|
|rounds|1220.002745 / 1363.968921 / 1620.753295|PASS|
|long-prefix|2370.235791 / 1124.579065 / 1090.997337|FAIL，1/3超2000|
|multimarket|2047.638232 / 2038.384321 / 2059.121083|FAIL，3/3超2000|

九样本完整public字节相等、365字面oracle、冻结graph、1866 transitions及原prepared次数全部PASS；缓存分别53,026,188 / 53,658,846 / 67,101,836B≤64MiB。27重复最大23.731054ms、同一对象且额外查询0。性能归因尚NOT VERIFIED，不能直接归咎环境或observer。早期误用单市场runner九样本已在 root-benchmark/INVALID-EARLY-SINGLEMARKET-RUN.md 标作无效，不计此门或轮次，全部保留。

UI/DB写在纯只读接口票NA；producer、页面状态链、完整视觉/控件与整页仍NOT VERIFIED。本票1/3 FAIL，允许同票第二候选，第三轮若仍有FAIL/requiredNV即暂停，不改名绕限。
