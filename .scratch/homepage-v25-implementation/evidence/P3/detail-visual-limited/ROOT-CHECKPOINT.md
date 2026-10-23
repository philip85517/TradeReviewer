# Root 有限详情修复复核

2026-10-23 03:55–03:57 CST；P3 0/3、P1 2/3 FAIL，不计为整票正式验收。触发：前端布局/控件修改后独立验收。实现 integration_g61（gpt-6.1-sol ultra），审查和实际浏览器 root，未参与本次UI实现。10文件SHA与冻结一致，见 ROOT-FREEZE-VERIFICATION.json。

环境：127.0.0.1:3333，隔离 .data/tradereview-test.sqlite，PID85569。CSS1280×720、DPR2；浏览器viewport设置未生效，因此1440×1000、1280×800、390及相关断点仍 NOT VERIFIED。鼠标与键盘实际操作，touch未执行。无业务数据写入。

直接看原search-detail.png、detail.svg及批准正文130–160/312–314，并与root-detail-after.png比较。正文明确主操作水平居中，优先于SVG的左侧坐标，非用户新增偏差。参考图1100×760是状态画板，不能冒充实际CSS视口同尺寸精确比对；以下为本次可比容器与对应状态的局部结论。

|门槛/控件|实际观察与证据|结果|
|---|---|---|
|标题/面板|24px/32px，面板#111A26，1020×530（缺持仓原因与返回行增加高度），四张233.5×88/gap12；未压缩KPI；root-detail-after.geometry.json、实图|局部PASS|
|主动作|120×36，背景#162233、边框#6CA8FF，x580中心640与面板中心相同；只有一个查看交易动作|局部PASS|
|来源返回|实际点击返回原搜索结果，ROKU保留，焦点hp-symbol-NASDAQ%3AROKU%3Astock，scroll0保持；root-source-return.ax.txt/.png|PASS此状态|
|详情焦点首尾|关闭按钮ShiftTab到来源返回，Tab回关闭按钮；外点仍打开详情|PASS鼠标/键盘此状态|
|逐层Escape|第一次详情→精确结果，第二次Search→hp-symbol-search；root-escape-detail/search.ax.txt|PASS|
|控制台|此次reload/打开/返回/逐层Escape，error/warn空|PASS局部|
|完整响应式/长文/真实触屏|未完成，工具目标viewport未生效；不以当前尺寸替代|NOT VERIFIED|
|普通库及持仓来源回归|前次11文件冻结已有链路证据，本次只改详情shell；正式最终版本仍需完整回归|NOT VERIFIED最终|

root独立运行15个surface交互测试见ROOT-surface-tests.log；实现者严格tsc exit0、lint0errors/1既有warning。历史视觉FAIL保留，有限差距已复核；整页视觉和P1/P3完整门槛未放行。附件尚未授权产品实现，先完成当前debug候选的实际边界。
