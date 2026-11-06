# 覆盖与责任

|需求ID /准确规格|elementID/参照|状态|owner|交付/旅程|预期/反例|证据|结论|
|---|---|---|---|---|---|---|---|
|N01 TradingView导入spec:60|非新元素；性质标签|legacy/explicit|Sol Task1|新旧来源性质解析|精确规则+指纹认定；未知/模拟不得升级|REGRESSION-root.log、VERIFY.json、REVIEW-independent.md|PASS|
|N02 focused-review-design §1|既有回合/笔记链接|刷新/返回|Sol Task1; root Task2|历史identity保持|所有episodeID→成员不变，无SQL改写|BASELINE/VERIFY JSON、FINAL-INVARIANTS.json；隔离复盘仅2条updated_at变化，内容不变|PASS|
|N03 Homepage V2.5 source/visual-design.candidate.md §公共范围/首页入口|既有交易库范围与性质选择；诊断home-scoped-trades.jpg、legacy-live-trades.jpg|live/simulation/unknown|root Task2|普通库→首页范围库→刷新/返回|同一证据规则/非零legacy；未知6条不冒充live|CONTROL-AUDIT C01–C08、1440/1280截图|PASS（范围协议）|
|N04 用户当前范围及暂停决定|财务错误/空槽既有外观|error/normal|root Task2|首页仍可记录独立超时|不伪造完整数据、不重启暂停任务|home-settled-AX.txt/jpg、FINAL-ACCEPTANCE|PASS（边界保持；完整财务态FAIL）|

控件审计触发：数据/状态接线修复；局部范围仅性质选择与首页范围导航/刷新、相邻列表标签，非整页100%。桌面1440×1000和1280×800；无CSS改造，信息层级/字号/空间预算沿用既有页面。窄屏及触控并非本次桌面协议修复的交付范围；核心写流N/A（无产品写入）。loading/error为现有读取状态，expanded为性质下拉；longtext/ambiguous不新增交互，混合性质反例用领域证据覆盖。正常金额态因原任务暂停不能视为通过。
