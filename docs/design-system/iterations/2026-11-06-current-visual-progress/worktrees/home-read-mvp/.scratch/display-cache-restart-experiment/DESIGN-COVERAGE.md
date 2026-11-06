# 范围与可证伪覆盖

原始来源：协调者2026-10-29任务及方案批准；准确产品引用见DESIGN.md。所有行owner为update_experiment、集成与独立接受为协调者。无UI元素/图片/浏览器：纯离线合成SQLite原型，未接产品页面。

|ID / 来源|elementID / 图片 / 浏览器|旅程与状态|预期及反例|实现/证据计划|状态|
|---|---|---|---|---|---|
|D01 / 同成交版本新名称|不适用，离线原型|初建→name单独变化→旧读→refresh→新读|旧缓存明确拒绝，新读新name；bookVersion、10字段及factDigest不变|cache.test.mjs第1/6项；results/candidate-01/evidence/*name-*.json|实现者PASS；独立待审|
|D02 / localizedName及账户标签|同上|逐字段变化、合成localized NULL、标签空串、同账户逐笔不同标签、连续两次成功刷新|独立presentationDigest；不误用账户ID去重标签|cache.test.mjs第2–4/7–8/10项；对应JSON与stdout|实现者PASS；真实删除语义NOT VERIFIED；独立待审|
|D03 / 重启复用|同上|初建→真正独立进程重开|凭据/结果相同、构建计数不变、同child连接total_changes delta=0|restart-snapshot.test.mjs第1项；*restart-unchanged.json|实现者PASS；独立待审|
|D04 / 关闭期变化|同上|关闭→其他连接改名→重启|旧缓存拒绝，显式refresh仅重建展示|restart-snapshot.test.mjs第2项；*restart-changed.json|实现者PASS；独立待审|
|D05 / 缺失/过期版本|同上|缺失/坏格式/旧摘要/错book身份/缺失状态；业务版本变化|明确拒绝，绝不返回旧名称|cache.test.mjs第9/11项；最终stdout|实现者PASS；独立待审|
|D06 / 新旧快照一致|同上|元数据读后worker屏障→writer提交→缓存行读|旧事务全旧；新事务全新或明确stale；无事务负例可混|restart-snapshot.test.mjs第3–4项；*wal-safe.json/*wal-unsafe.json|实现者PASS；独立待审|
|D07 / 缓存内容及实现身份|同上|损坏缓存/旧规则代码|明确拒绝，不静默复用|cache.test.mjs第12项；最终stdout|实现者PASS；独立待审|
|D08 / 安全与证据|同上|限定路径→TDD→冻结→独立审查|私有合成库；42项旧冻结只读hash相同；最多3轮|4组RED/GREEN；最终run.json；prior-freezes-readonly-check.json；SNAPSHOT/SHA256SUMS|实现者证据已备；独立/协调者NOT VERIFIED|
|D09 / 未覆盖边界|同上|报告|摘要成本、真实适配、HTTP/页面/性能均不外推|DESIGN.md、RESULTS.md|已记录；实际产品验证NOT VERIFIED|

版本绑定：以上实现者证据仅针对SNAPSHOT.json的candidate-01清单；无UI/视觉接受含义。独立审查结论应写独立新文件，不能覆盖本冻结表。
