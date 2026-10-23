# F 冻结版局部复验

2026-10-23 00:59:50 Asia/Shanghai；只读产品源码，固定 Node v26.0.0。F owner 通知暂冻结后，原 `peer.test.ts` **不改动**复验，5/5 PASS、exit0。命令、时间、源码与探针运行前后 hash 见 `freeze-retest-manifest.json`；输出见 `freeze-retest.log`，新输入输出见 `actual-after-freeze.json`。

|原探针|首次|冻结版|
|---|---|---|
|非 execution IPO 全平 short：费用应归已实现|FAIL|PASS：realized/net45，MV0，openFees0|
|IPO cover short 后反向 long：费用拆分|FAIL|PASS：realized46.5，closingUF8.5，net55，MV110|
|同 raw ID 的 quantity 冲突|FAIL|PASS：PNL/MV 均不可用，保留 duplicate-execution-conflict|
|完全相同 raw ID 去重|PASS|PASS：1份原成交，MV110|
|普通跨期 fee bridge|PASS|PASS：17 / 48 / 0 / -31，MV0|

冻结版 source SHA-256：`9d7b44e00229e63dca5485589871ab442df636d953cfecd8224a374fc399e7b5`；test：`2131a3a78e6eeeef4ebd97ddd9cbe31b95cde956909a402ab3a7171e87dd8207`；独立探针：`47b74bf1a41b4fac6bcb01b8c77b6e4b62cbcf26791fc33767937790ddacc004`。三者运行前后均相同。

首次失败的 `probes.log`、`actual.json`、`source-before.json`、reviewed source 副本及 `REPORT.md` 保留；另将首次 actual 原样复制为 `actual-first-run.json` 后才运行复验，复验后已恢复原 `actual.json`。没有覆盖失败证据。

此 PASS 只覆盖这五个实际输入，不是 F 整票或产品接受。未在本次复验独立执行 owner 全部96项；UI、日曲线、分类贡献、持久化与真实 DB 仍未验证。
