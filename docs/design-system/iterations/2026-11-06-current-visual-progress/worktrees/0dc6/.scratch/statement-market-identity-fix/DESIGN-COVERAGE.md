# 范围契约

|需求/依据|elementID/画板|状态与旅程|owner|预期与反例|证据|结果|
|---|---|---|---|---|---|---|
|M01 用户要求保留明确市场；前轮 Q02-RECORD-LIFECYCLE.md 源行 HKEX|不适用：无 UI 改动|原始现金表→事件→导入|parser worker|HKEX/SEHK 同义；不得把任意数字、账户币种或期权当股票|RED/GREEN、独立审查|PASS，证据见 FINAL-ACCEPTANCE.md|
|M02 历史记录恢复|不适用|存储原文→计划→事务修复→重开读取|repair worker|仅明确身份且缺字段；冲突拒绝；重复幂等；原始成交不变|隔离库、计划/审计、前后摘要|PASS，证据见 FINAL-ACCEPTANCE.md|
|M03 港美沪深既有成交保持完整|不适用|原库→读取→首页协议|root|1866 原始成交市场/金额/数量不变，109 缺失事件不盲填|全库扫描、协议生产函数|PASS，证据见 FINAL-ACCEPTANCE.md|
|M04 范围边界|不适用|本轮数据修复|root|不修改 Q02 规则、财务、Bars、事件性质或伪造交易；首页整体问题保留|差异审查与最终报告|PASS，证据见 FINAL-ACCEPTANCE.md|

本表仅覆盖市场身份修复。首页完整展示、≤1 秒性能与全项目回归均未通过，不能由上述 PASS 推导为完整首页交付。版本绑定见 evidence/FINAL-SOURCE-VERSION.json。
