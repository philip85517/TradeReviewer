# Root 首条搜索旅程检查

2026-10-23 03:43–03:49 CST；触发：整页前端实施后独立控件/状态/视觉检查。P3 0/3，P1 2/3 FAIL。此为扩大附件前的有限检查，不是整票验收。root为实际操作、数据流、整页视觉及独立审查owner；实现integration_g61 / gpt-6.1-sol ultra。

版本为COLD-READ-FREEZE-MANIFEST.json及ROOT-COLD-READ-FREEZE-VERIFICATION.json的11文件，host74d765fe…、Workspace6d255f0e…。隔离库`.data/tradereview-test.sqlite`、3333；鼠标/键盘证据区分。实际CSS1280×720、DPR2。指定1440×1000与1280×800的viewport.set均未改变现有/新建tab的innerWidth/innerHeight；只有当前viewport可签，响应式边界NOT VERIFIED，不能用命名推断尺寸。

|范围内控件/状态|独立结果|证据|
|---|---|---|
|A股→页头搜索→AAPL|PASS，搜索不改A股范围；缺exchange时明确待解析，不猜NASDAQ|root-search-unresolved-identity.png/.ax.txt|
|同一搜索改ROKU|PASS，真实已存exchange NASDAQ与stock类别形成唯一身份|root-search-results-1280.png（实际1280×720）|
|ROKU结果→无持仓详情|PASS，完整身份NASDAQ:ROKU:stock；数量/金额/天数未知及原因，不复用600100持仓|root-search-detail-default1280x720-dpr2.png/.ax.txt|
|查看交易|PASS，普通库URL保持live/market=a/accounts=*并准确symbol，0标的/0回合诚实空集合，不进入queue|root-search-cross-market-empty-library.png/.ax.txt|
|返回首页→读取完成|PASS，A股/ROKU/所选结果恢复，焦点为hp-symbol-NASDAQ%3AROKU%3Astock|root-search-return-stable.png/.ax.txt|
|稳定后reload|PASS，真实重读后仍A股/ROKU/所选结果与同一按钮焦点|root-search-reload-stable.png/.ax.txt|
|详情Esc再搜索Esc|PASS，两次分别关闭最上层；先回ROKU结果，再回页头hp-symbol-search，查询保留|本次root实际AX/DOM焦点观察；完整控件冻结后仍需文件化复验|
|详情视觉对照|FAIL，见下方；已交唯一页面owner有限修复|原search-detail.svg/detail.svg；root-search-detail-default1280x720-dpr2.png|

参考直接阅读：原search-detail.svg及detail.svg（含标题24、面板#111A26、1020×500、四KPI88、左下120×36操作与来源返回），已存栅格P3/reference-readback/search-detail.png及P1 visual-readback/detail.png。实际标题继承18、面板#162233、居中160实心操作、缺来源返回次动作、当前高度478；不是经用户批准的偏差。因而第一张详情画面尚未视觉接受，附件未放行。只授权同一owner修上述shell，不改身份、host或金融口径。

搜索浮层max960及当前16内边距、结果身份直接可辨属局部满足；目录覆盖声明为真实已导入/已存资料，不能宣传全市场。完整300ms/IME、清除、无匹配、目录失败、外点、Tab循环、动效/减弱动效与指定两桌面/390、emulated/physical touch仍另行验证。无用户排除项；保留85适用/11原NA分母。

返回读取时短暂裸/home和loading不单独构成失败，稳定URL已恢复。此前Recall返回中立即reload后出现all的原因仍OPEN，state_g61仅获peer目录最小测试诊断权限；本局部PASS不能掩盖该竞态或request-body overlay。无业务数据写入。

## 03:51 CST 图文冲突纠正

root再次直接阅读正文312–314：明确要求详情内“查看交易”水平居中。SVG左下位置与正文冲突，因此先前将居中位置列为FAIL的判断撤回，原记录保留以说明纠正；不得把文字居中解释冒充原合同。实现保持主动作本身水平居中，其他已确认的标题24/32、面板#111A26、120×36边框动作、500桌面最小高度及来源返回继续有限修复。来源返回可独立次动作行，不偏移主按钮中心。本纠正是正文优先的合同解释，不是用户批准新偏差。
