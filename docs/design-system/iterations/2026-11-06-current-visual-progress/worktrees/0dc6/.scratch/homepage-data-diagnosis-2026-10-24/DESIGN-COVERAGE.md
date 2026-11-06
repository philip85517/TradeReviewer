# 本次诊断覆盖

范围是定位已存在的读取问题，没有新 UI 设计、授权视觉偏差或产品实现；因此无新增设计 elementID。沿用户四项原文建立 D01–D04，不能代替原 V2.5 设计元素覆盖。

| ID/要求 | 原文/准确代码参考 | Owner | 用户旅程/反例 | 证据与结论 |
| --- | --- | --- | --- | --- |
| D01 数据库正确一致 | 当前用户第1项；homepage-source/route.ts、bootstrap/route.ts、db/sqlite.ts；conf/runtime.json | root | 同端口首页/旧库；反例：副本并非业务原库实时句柄 | VERSION-AND-DATABASE.json：同句柄，原始1866成交全列一致 |
| D02 解析协议 | 当前用户第2项；homepage-source-contract.ts、trading-nature.ts:5、types.ts:207、attachment-groups.ts:50 | root | 普通库实盘232/732→首页集合0/0；反例：HTTP200不能证明业务资格有效 | PROBE.json、两条交易库路径截图；线协议PASS、语义差异确认 |
| D03 阻塞 | 当前用户第3项；workspace.tsx:2232–2305、use-homepage-host.ts:134–190、homepage-v25-state.ts:362 | root | 桌面返回首页→读→timeout；反例：接口快速返回不能证明金融计算完成 | HTTP实测、home-final-full-AX、历史profiling明确分开；整体FAIL |
| D04 内部异常 | 当前用户第4项；route catch、sqlite-http-client.ts:161、use-homepage-host.ts:216、period-surface.tsx:62 | root | 终态空表/占位与错误检查；反例：console空不证明无错误 | PROBE来源诊断、BROWSER.json、截图、静态cause链；遗漏风险确认，未捕获throw |

所有要求的调查均有证据；修复、完整首屏、正常态视觉、历史接线均未验收。财务/Bars实现排除依据是用户仍保持暂停，排除不记产品PASS。
