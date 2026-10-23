# 搜索错误态 CR03 — root 有限独立复验

记录：2026-10-23 04:49 CST。实现者 state_g61（gpt-6.1-sol / ultra）；独立接受、浏览器及完整数据流 owner /root。结论：**该有限错误态与搜索恢复回归 PASS；P3 整票未接受，正式 0/3。P1 正式 2/3 FAIL，第三轮未启动。** 原失败证据保留。

## 触发、范围与设计

触发：开发改变搜索错误控件的 markup、布局和样式，按 frontend-control-audit 执行受影响状态与旅程审计。原 CR03 为错误提示/重试在左上且无错误色；见前一版 `../search-recovery-fix/root-http503-after-keys.png`。root 直接比较当前截图和批准原稿 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-error-frame.svg`（派生渲染 `../reference-readback/search-error-frame.png`），同时参照 `search--empty.svg`；规格正文130–160、公共控件手册370–455。准确派发见 ROOT-DISPATCH.md，需求 HV25-08 / HOME-HP03-B019。

此次仅两处 className 与局部错误 CSS；保留真实错误原因、重试回调与原状态分支、键盘守卫。实际 CSS viewport 1280×720、DPR2；浮层舞台960×610。原稿错误提示横向居中、错误色、88×36描边按钮的合同通过。当前目录说明占两行，结果区408高，原稿430高；错误内容较原稿长。未宣称整个浮层逐像素相同，也未据此接受整体密度/全部断点。无新增授权设计偏差。

## 版本与独立测试

固定 Node26.0.0 / SQLite3.53.0。ROOT-FREEZE.json 与 root-77.json 绑定19个源码/测试输入，测试前后完全一致：8文件77/77 PASS，exit0，2026-10-22T20:42:42.002Z–20:43:00.560Z，原始输出 root-77.log。最终浏览器后再核对同一 manifest，见 ROOT-FINAL-INTEGRITY.json。

- Surface `84897ee2c53bf1c8a81428dcf2e4997cef326b065d58dacae036a2e2b9d2b6c2`
- CSS `b7160f103035966877256ecb04aaf4d10a185af272a6c3476b5cbee5771f7cb8`
- host `3218407b84c45656989bc0a2ac700c9741e6c55135f55ed2873e7ed2b968b167`
- 原 search-recovery.test.tsx `840df3f07bf2debfc5da27bb043ce523292b5fe45dc4a45c9984bac379e72ff5`

实现者29测试、lint0错误/1既有warning、CSS parse PASS 仅作辅助，以上 root 测试和以下实际浏览器构成独立证据。没有新增完整 Workspace 回归 PASS；其余已知失败见 `../../P1/round3/WORKSPACE-REMAINING-FAILURES.md`。

## 实际操作覆盖（版本绑定）

浏览器采用明确隔离库 `.data/tradereview-test.sqlite`。主服务3333；根因复现用 root 控制代理3334的真实 FX HTTP503，不修改业务库，也不以假组件状态替代网络。请求日志在 `../../P1/round3/navigation-fault-requests.jsonl`：20:43:01.527Z/20:43:03.418Z实际503，恢复后20:44:19.648Z为200。网络503不等同SQLite故障。

|控件/状态/旅程|输入方式|root 观察与证据|有限结论|
|---|---|---|---|
|页头搜索打开/错误原因与查询保留|真实浏览器、查询6、HTTP503|root-http503-home.ax.txt；root-http503-keys.ax.txt/.png|PASS|
|错误态 Enter / ArrowDown 不激活旧结果|键盘|上述 keys AX，无详情、查询6、焦点输入；不是“按钮不存在”推论|PASS|
|错误提示与重试几何/样式|root直接看图及只读DOM测量|root-http503-geometry.json：提示#FF8592，16/24；按钮88×36、r6、描边#283448；二者中心x676等于结果区中心|PASS，仅上述视口/状态|
|重试按钮可见焦点|键盘Tab到清除再到重试|root-retry-focus.ax.txt/.png，直接看图存在2px #A9C8FF焦点环|PASS|
|真实503后重试→loading→ready|鼠标点击实际重试|root-retry-transition.ax.txt / root-retry-ready.ax.txt；真实200请求；查询6保留|PASS|
|恢复后正常Enter准确打开唯一证券详情|键盘|root-recovered-enter-detail.ax.txt：HKEX:2600 中国铝业|PASS|
|ready结果非零滚动→关闭→重开|真实滚轮、关闭/重开控件|root-scroll-before.json / root-scroll-reopen.json/.png：1440→1440、查询6、焦点输入|PASS|
|非零滚动实际点击思摩尔详情→来源返回|原生坐标鼠标，坐标先由当前行只读几何确认|root-native-detail.ax.txt；root-native-return.ax.txt/.json：HKEX:6969，1440→1440、查询6、选中/焦点准确恢复|PASS|
|当前主服务预览|实际浏览器只读检查|root-main-preview-final.ax.txt/.png，20:48:29Z，3333 /home A股74持仓；期间表现/附加筛选仍明确未接入|PASS，仅服务可见性|
|完整搜索/筛选/清除所有状态，四区原子附件流，96状态，390/双桌面响应式、完整正常动效|未完成完整范围操作|当前有限检查不能覆盖完整清单|NOT VERIFIED|
|模拟触控 / 物理触控|未实施|鼠标/键盘证据不能转换为触控证据|NOT VERIFIED|
|此次局部样式新增持久化写入|无新增写入合同|只改变错误 markup/CSS；核心写入历史证据仍有各自版本边界|NOT APPLICABLE，仅局部CR03|

测量曾先误用不存在的舞台 testID而报null，未执行任何变更；随后依据真实DOM `.hp-search-stage` 重测。保留本事实，不把失败测量计PASS。

## 运行状态与未闭合门

故障代理已恢复normal后停止（原exec session89867 Ctrl+C），3334不再监听；主3333 PID33597继续监听，未重建/重置隔离DB，未启用请求体观察探针。预览：http://127.0.0.1:3333/home?scope=live&market=a&accounts=*&rangeMode=all 。重新启动的项目标准命令为 `make dev`，会以业务库新备份重置测试副本；当前服务已运行，无需重启。

P2多市场冷约2.97秒/重复约3秒且完整图超过64MiB，FAIL保持；原始实现及两项授权性能候选均未达完整目标；按systematic-debugging先讨论架构，未继续增加修复候选。P4产品、四区附件和完整当前回归未接受。间歇request-body真实消费者仍OPEN；确定性适配器反例不是原生产调用的定位证据。P1/P3不因该有限PASS变成整票PASS，也不重置轮数。

业务库只读复核见 `../../resume-2026-10-23/coordinator/business-data-checkpoint-0441.json`：executions1866/import_batches213/trade_revisions11/reviews138逻辑哈希与开始时一致。无提交、推送、合并或发布。所有必需 FAIL / NOT VERIFIED 明确保留，整页功能/状态持久化/视觉/全控件仍 NOT VERIFIED。
