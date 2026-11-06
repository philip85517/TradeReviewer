# 范围与证据映射
原始规格：2026-10-24用户要求“建立整个访问超时漏斗……诊断各访问环节耗时”。无视觉/交互改版；参考现存首页及此前desktop-home-db-diagnosis报告。主代理拥有整体数据流与桌面核对。仅性能取证，不增加功能或修复旧问题。

| ID | 原始要求/具体来源 | Owner | 用户旅程/状态 | 接受证据 |
| --- | --- | --- | --- | --- |
| PF01 | 当前版本/真实数据库来源 | /root | 源码复制、在线备份、显式隔离路径；3333保持 | baseline/final hashes、DB counts/digest、启动/lsof |
| PF02 | API→SQLite→响应 | Astra server | snapshot、FX、aliases、market reads、JSON编码 | server start/end，HTTP id，计数与错误 |
| PF03 | HTTP→client parse/contract | Astra server | headers、body JSON、binding验签 | browser logs，同一HTTP id |
| PF04 | 客户端bundle→采集计算 | Astra client | prepare、FX、aliases、summaries、行情fan-out、entries、complete | browser spans，数量与耗时 |
| PF05 | host→domain→发布/超时 | Astra client | request generation/15秒；own/view/facts/holdings、拒收与UI终态 | browser logs/DOM与截图 |
| PF06 | 边界根因及不确定性 | /root | 同请求时间轴、并行critical path、CPU与IO区分 | funnel报告、raw logs、独立复核 |

前端审计触发：当前首页超时诊断。局部范围：桌面1440×900首读自动旅程、timeout/period/metrics/holdings终态；不进行全部控件、设计保真或写流程交付。隔离库允许bootstrap已有自动写入，不把它归因本轮修复；原业务数据保护独立核对。回放/图表操作N/A（无此类实现）。

## 最终映射（2026-10-24）

| ID | 诊断验收 | 精确证据 | 限制 |
| --- | --- | --- | --- |
| PF01 | PASS | [FINAL-SOURCE-VERIFICATION](FINAL-SOURCE-VERIFICATION.json)、[BUSINESS-AFTER](BUSINESS-AFTER.json)、[RUNTIME-ISOLATION](RUNTIME-ISOLATION.json) | 数据保护限所列五表及测量区间 |
| PF02 | PASS | [FROZEN-SERVER](FROZEN-SERVER.log)、[complete-trace](complete-trace.json) 的 serverEvents/serverDetails、[report](DIAGNOSIS.md) | native query含物化；counts/orphan/settings等未逐SQL细分 |
| PF03 | PASS | [collector](FROZEN-BROWSER-COLLECTOR.ndjson)、[ACK](complete-collector-ACK.json)；http-3/4、16…251 | body-json不是纯解析CPU；非helper请求未穷尽 |
| PF04 | PASS | [FUNNEL-METRICS](FUNNEL-METRICS.json)、[build-funnel](build-funnel.py)；generation2/requestId2 | 236连续map请求与3个后台开始区分；父子不相加 |
| PF05 | PASS（诊断） | sourceEncode首次越界、afterDomain拒收；[desktop screenshot](complete-desktop.png)、[AX](complete-desktop-AX.txt)、[geometry](complete-desktop-geometry.json) | 产品首读FAIL，完整财务金额/持仓正确性NOT VERIFIED |
| PF06 | PASS | [DIAGNOSIS](DIAGNOSIS.md)、[INDEPENDENT-REVIEW](INDEPENDENT-REVIEW.md)、[FINAL-ACCEPTANCE](FINAL-ACCEPTANCE.md) | 一次完整插桩样本，不能推算某方案节省量 |

首个console截断采样保留NOT VERIFIED；修复/完整视觉/所有控件/写流程不在本票范围。此矩阵只关闭诊断要求，不解除既有产品FAIL/暂停。
