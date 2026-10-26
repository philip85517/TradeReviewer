# Luna B：V2.0 最终补验 Addendum

日期：2026-10-26（Asia/Shanghai）

本补验不修改既有 [最终报告](luna-b-v20-final.md)、初检 NOT READY 报告或任何 V2.0 实施资产。它把原报告中 F08–F10 仅由独立手工 oracle 支持的四类输入，直接送入冻结包的 generator 函数；包内测试覆盖分类仍保持原报告的 **自动覆盖 NOT VERIFIED**，因为没有改动或补充包内 tests。

## 可复现命令与结果

```text
python3 .scratch/trading-library-v20-spec-sync/reviews/luna-b-v20-generator-oracle.py
```

实际输出：

```text
O-01 generator=PASS rounds=2 allocations=[2,1] residual=0
O-03 generator=PASS flat_in_denominator=1 all_unknown_win_rate=None
O-04 generator=PASS overall_win_rate=66.67 amount_samples=3 rate_samples=2
O-05/O-06 generator=PASS valued_net=4677 capital=None/0/-100 rate=None
GENERATOR_ORACLE_STATUS=PASS
```

## 直接调用 generator 的断言

1. **精确实盘例子（O-01／F10）**：输入 `100@100`、`50@110`、卖 `80@130`、再卖 `70@140`，调用 `aggregate_live_actions`。结果是两条人的主动平仓回合；第一条含 2 份内部配对，第二条含 1 份；开仓优先顺序为 `b50,b100` 后 `b100`；剩余数量为 0。该结果支持“配对份数不等于人的回合数”，且未把已确认的 50+30 例子降为未决。
2. **持平与全未知（O-03／F09）**：五个合成练习 `[+60,-20,0,未知,+10]` 送入 `summarize_exercise` 与 `stats_for_exercises`，断言总 5、可算 4、未知 1、胜 2、负 1、净额 50、胜率 50%，并单独断言持平净额为 0。只有未知练习的全未知集合断言可算 0、未知 1、胜率 `None`、净额 0。
3. **金额／收益率独立分母（O-04／F08）**：输入净额 `[60,40,0,未知]`，其中 `40` 没有初始资本，调用 `stats_for_exercises` 与 `distribution_for_exercises`。断言总体练习胜率为 `2/3 = 66.67%`，金额样本 3，收益率样本 2；没有把收益率缺本金误降为总体 `1/2`。
4. **缺本金仍保留金额（O-05／O-06）**：复制 fixture 的 A，补充结束估值 140，分别传入初始资本 `None`、`0`、`-100` 调用 `summarize_exercise`。三次均断言已实现毛额 1900、浮动毛额 2800、费用 23、净额 4677，收益率为 `None`。

## 当前指纹

读取时源码、generator、fixture 指纹仍为冻结值；reader 使用 root 重建后的当前文件指纹。manifest 的正文语义 fingerprint 仍为 `dd25c5…aca43`。

|资产|当前 SHA-256|
|---|---|
|source/visual-design.candidate.md|`dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43`|
|source/generate-library-frames.py|`d3ad5ffd6a31fb7fa0f9b8bd9573e649d2998c97c9c16fdbd1a50cece8923d09`|
|source/library-design-fixture.json|`d3a9639acb518a95a94924c568d9b957831679838c8f43c8eb897e967e72951e`|
|visual-spec.html（当前 reader）|`335fe8cb787f7f13602012238bff33bb702acf7980a1a82b000de2d9ddea8e4c`|
|document-identity.json（当前 reader）|`c9f6251e143a5c72d2a67295d9d36cff0bc32c13d804cd1aa7a554e072bf530e`|
|document-manifest.json（当前 reader）|`9fe687bb9b23ba8b60af40635798447d65a09b43d51e48396cbcdb61e1e069da`|
|manifest `fingerprint`|`dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43`|

补验结论：四类反例现已在当前 generator 层实际通过；既有最终报告对 F08–F10 的自动覆盖限制保持有效。脚本只读 fixture 并调用函数，不写入产品或 V2.0 资产。
