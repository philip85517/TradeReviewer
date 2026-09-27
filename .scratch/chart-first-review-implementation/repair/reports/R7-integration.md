# R7 协调者最终布局复验

2026-09-27，worktree f7a5，生产3049，显式repair/acceptance.sqlite合成库。Luna gpt-5.6-luna/max实现，Astra gpt-6-astra/low独立看图/审源码，root实际浏览器操作。整体未接受：R7尾声发现另一个图表销毁错误，转R8；真机软件键盘仍unverified。

## 已关闭的布局与状态反例

- E01/E10：1280 header89px、1440 header63.3px；计划入场整行，止损/目标双列，字号14，桌面36/触控44；侧栏320px，沟槽14。见R7-pre-plan-1280/1440/390与R7-pre-nav-1440、R7-pre-form-scroll-390。下表单真实scrollTop475，趋势220保持。
- E19：390“回到买入前判断”单行44px，旧四行挤压关闭。R7-post-closed-390。
- E09/E22：窄容器More开时显式收起计划，图表固定220，More得到其余空间；关闭恢复原开关，点计划按钮或图上价格可返回。React hidden/aria状态一致。按工作区1105px判断，非复制视口断点。
- 390×844，More body195px（636..831）、主图220（231..451），页面scrollWidth390/scrollHeight844。真实滚轮scrollTop459时首代表图272×152完整位于661..814；滚到底scrollTop1859.5/scrollHeight2054，末条全局编辑766.8..810.8高44。More内panel overflow visible，仅body纵向滚动。证据R7-more-image-visible-390、R7-more-bottom-390。旧R7-more-budget-fail-390保存。
- 点击末条编辑真正进入已留存全局快照；点图上“计划入场56”关闭More并打开只读plan；返回工作图后开/关More恢复plan=true。再先关plan后开/关More仍false。R7-more-return-plan-390。整个纯布局过程行情9/24 16:00 UTC、成交8/20 02:00 UTC未改变。
- 窄More→1440自动恢复plan=true与More共存，chart392.85、body236.85；1280 header89/chart330/body174，真实滚轮末条编辑36px位于687..723；1440导航展开可用宽1086，自动plan hidden/chart220/body380.7，6条记录完整可阅。R7-more-resize-1440、R7-more-bottom-1280、R7-more-nav-1440。
- 代表缩略图用于识别构图，不声称缩小后Text全文可读；实际选择/编辑可以回到主图。390不要求三张同时同屏。独立结论见R7-coverage-audit追加。

## 最新布局下真实回放简短复验

999996：从post/full返回买入前，行情8/10 01:59:59 UTC、成交尚未揭示，后续K/成交/结果不展示，已看后续来源保留（R7-final-return-pre-1440）。下一根实际出现首买K与买入标记，行情8/10 16:00、成交8/10 02:00、持仓1000（R7-final-next-bar-1440）。下一决策到8/14，卖出标记可见、持仓400、已实现4776、浮动2400，未跳末次退出（R7-final-next-decision-1440）。播放→暂停后行情到8/27、成交8/20、持仓0、新增K实际进入视野（R7-final-play-1440）。返回事后恢复9/24/8/20并返回库。没有改动正式留存图片。

999999继续保留在首次买入前，已录计划56/52/68/1000，未按回放按钮；可作为用户从头体验入口。R7-preview-ready是在viewport reset后的默认尺寸截图，但同次控制台发现R8错误，不能用此图声称控制台无错。

## 自动化与数据

- R7工作区首次14fail114pass，中间1fail127pass，最终两文件128/128；修正实际展开More/记录步骤及autosave边界等待，未删持久化断言/未加宽超时。R7-regression.md。
- 最终面板产品修复后root三文件84项：82pass2fail（R7-coordinator-tests.txt）。两个都是More窄模式收起plan后旧测试编辑隐藏字段。Luna按真实展开计划步骤修正，workspace整文件52/52通过；原红日志保留，root独立受影响7/7通过（45 skipped），R7-coordinator-recheck.txt。10项panel-state和22项actual-metrics已在root84运行通过，不把该次整体写全绿。
- US39直接指标入口：同run可算，可见混run/live-sim明确scope错误与null；未来未揭示错run不污染早期值。仅增加测试，产品守卫原本正确。R7-metric-scope。
- root typecheck通过，目标ESLint0错误0警告；R7-final-build成功；对应5项runtime全部通过，R7-runtime.txt。R8变更后图表相关检查与构建需更新。
- R7-final-state.json：25原始成交SHA256 1b79e6e605b493b4e0ce7833094824c807680c972166a83a1a3f0b8aefd12b36，quick_check ok；该报告是浏览器最后操作前revision28，只能证明当时状态。最终再审计使用新prefix以保留历史。

## 尚未签署的范围

R8图表销毁异常正在处理。真实手机价格和退出原因软件键盘未验且无豁免。R7-evidence-gaps把真实浏览器保存错误/409、重导确认及旧missing Text引用路径与已经通过的组件/领域测试分开记录；不得扩大已有证据范围。没有提交、推送、合并或发布。
