# 首页业务与数据链路 Top-Down review

用户授权：只审查当前首页超时、交易与持仓未显示；财务 P1/F07 与 ContributionBars 继续暂停。2026-10-24，root。

- [设计结论、完整链路、规则与问题树](REVIEW.md)
- [Q02 深入：完整性、配售性质与证据承载](questions/Q02-coverage.md)
- [Q02 优先续审：231条全量缺口、输入/接口/检验规则的责任划分](questions/Q02-INTEGRITY-REVIEW.md)（22:29新取证，含业务原库与4392只读对照）
- [Q02 记录生命旅程：HKEX费用样本、规则边界与展示消费](questions/Q02-RECORD-LIFECYCLE.md)（2026-10-25新取证；只读，含逐层字段与费用事实对照）
- [Q02 新旧diff：成交读取、月结辅助证据与新增全局资格依赖](questions/Q02-LEGACY-HOMEPAGE-DIFF.md)（2026-10-25；1,866笔输出深比较相同，新增账户现金事件触发unknown的单变量实验）
- [版本与逐文件 SHA](evidence/SOURCE-VERSION.json)
- [沿用的分段诊断摘要](evidence/PRIOR-PROBE-EXTRACT.json)
- [本次隔离库只读核查](evidence/IPO-CARRIER-READONLY.json)
- [本次生产性质分类器验证](evidence/IPO-NATURE-RESULT.json)
- [审查后版本与文档链接核对](evidence/REVIEW-VERIFICATION.json)
- [Q02 全量探针结果](evidence/Q02-FULL-CENSUS.json)、[续审版本与链接核对](evidence/Q02-VERIFICATION.json)

本目录是审查记录，不是可领取的实施票；未修改产品代码、数据库或既有票状态，未派发修复，也未增加或重置验收轮数。审查完成不代表首页通过验收。
