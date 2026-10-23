# HistoryStatsCards 第1/3轮：FAIL，主值格式需修正

2026-10-23 11:12 CST；root独立验收，未实施该UI。候选1三文件冻结，原MetricCards与ContributionBars轮数不变。历史统计叶子本轮1/3 FAIL，未达暂停上限；P4整票0/3、整页未完成。

|冻结文件|SHA256|
|---|---|
|history-stats-cards.tsx|24f6cd248f57e918c51bf81da45d99618f47a6e9d9e908cd9f5258cdf4d1498c|
|history-stats-cards.css|2aa7ab4edad05a0aa0c76903577c8fa7ef30152d7280c4264b193f94c3d18842|
|history-stats-cards.test.tsx|f2bf240a36bd0b050515c9b1abd1420361308e8f9655f5092f5154681d711348|

## 独立证据与确定性失败

root新鲜定向29/29 PASS、exit0，见candidate1/root-product.log。实际IAB2/tab13、1440×1000、DPR1，受控字面数据9/14及已提交百分比64.285714285714285714。四卡318×88、间距18px，胜率主值完整DOM宽393px而可用161.234px，实际画面显示“64.28571…”并隐藏百分号。批准原稿source/images/history.svg与history-stats-win.svg及ROOT-DISPATCH HS01要求常规主值64.3%，全精度保留详情；本例属于默认正常精度，不是授权极长数字简化。根因history-stats-cards.tsx:173对主值无界toFixed()，CSS省略直接截断。

图像与实际测量：evidence/continue-2026-10-23/final-leaf-review/history-stats-standard-1440.jpg；同目录history-stats-details-1440.json包含4条实际详情AX/几何/关闭焦点。root已直接观察截图，未用DOM或测试替代视觉结论。literal harness为P2/selector/root-browser/history-stats.html及history-stats-harness.tsx，URL http://127.0.0.1:3334/history-stats.html，服务仍运行；此证据不是首页财务接线。

四详情实际鼠标打开→完整读数→键盘Esc→回原触发器有限PASS：净额321480.567800 CNY及14/14覆盖、回合14、胜率64.285714285714285714%及9/14、费用4680.123400 CNY及14/14覆盖。均未丢原精度，关闭后0 dialog且焦点原trigger。读数/详情有限PASS不能抵消主值视觉FAIL。

|门槛|结论|
|---|---|
|有限合成行为29项|PASS|
|1440正常胜率主值与批准图比较|FAIL：省略导致百分号不可见|
|4条实际详情/鼠标/键盘Esc焦点|有限PASS|
|完整状态/1280/390/A-B边界/正常与减弱动效帧/其余键盘与外点|NOT VERIFIED，发现确定性FAIL后未耗费补完本候选|
|数据库写|本纯只读leaf N/A；完整UI数据/持久化仍NOT VERIFIED|
|leaf正式接受|第1/3轮FAIL；待同任务候选2，不重置计数|

修复界限：仅显示格式按原稿主值一位小数，并处理0%/100%及有效高精度输入；完整原始百分比及金额/回合语义不得变更。不从9/14重新计算胜率、不改金融数据、不扩卡/缩字体回避。先真实行为RED，原29条回归及实际宽窄与详情精度复验。文件owner当前在独立host任务，先冻结本候选，后由root显式派发候选2。旧记录完整保留。
