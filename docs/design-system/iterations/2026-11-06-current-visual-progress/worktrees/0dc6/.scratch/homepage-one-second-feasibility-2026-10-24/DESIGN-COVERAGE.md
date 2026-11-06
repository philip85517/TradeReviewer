# 本轮分析范围覆盖

版本：HEAD `58bf0d9` + [既有工作树SHA核验](SOURCE-VERIFICATION.json)，2026-10-24；研究基线绑定上一轮完整trace/source manifests。没有UI实现，无新增元素ID或授权设计偏差；不替代V2.5设计覆盖。

| ID | 要求与精确参考 | 负责人 | 用户旅程/范围 | 验收证据 |
| --- | --- | --- | --- | --- |
| OS01 | 用户本轮≤1秒要求；上一轮[完整漏斗](../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md)及`complete-trace.json` | root | 导航到真实首页首屏可用；开发/生产分开 | [基线FAIL](BASELINE-SLO.json)、FEASIBILITY §1–2 |
| OS02 | 当前homepage-source snapshot/market-data/store/FX源码；ADR0001/0002/0006 | astra_one_second_server；root复核 | 首读数据获取与更新后读取 | [服务端研究](SERVER-FEASIBILITY.md)、FEASIBILITY §3–6 |
| OS03 | 当前financial-acquisition/source-model/performance源码；原金额/来源合同 | astra_one_second_source；root复核 | 来源拥有、投影、范围/时点、未知与失效 | [来源研究](SOURCE-FEASIBILITY.md)、FEASIBILITY §3–6 |
| OS04 | 当前/home、/trades、workspace与启动脚本 | astra_one_second_startup；root复核 | 冷导航、SPA返回、模块与后台初始化 | [启动研究](STARTUP-FEASIBILITY.md)、FEASIBILITY §2/6 |
| OS05 | 整体1000ms且保留功能/设计；旧3/3暂停 | root | 跨阶段集成与后续验证 | FEASIBILITY §4–8、[主代理验收](FINAL-ACCEPTANCE.md) |

视觉参考/新控件/写入数据库验收：NOT APPLICABLE，仅分析文档；沿用已保存1440×900桌面证据作为基线，不声称本轮完成UI或数据库接线验收。交易库实测、手机/窄屏、物理触摸、外部行情新采样均未执行且不在本轮研究测量范围。
