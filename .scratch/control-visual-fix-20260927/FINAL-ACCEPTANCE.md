# 控件与图表修复：最终验收

State: closed
Status: accepted

验收人：root（协调与集成复核）；独立审查：acceptance（用户确认的 gpt-6-astra / low，未参与实现）；实施：charts、controls（用户确认的 gpt-6-luna / max）。遵循当前 docs/agents/development-workflow.md、ui-task-templates.md 和本轮 visual-contract.md。用户明确允许 Playwright 实际浏览器替代本会话不可用的 Computer Use，并要求真实部署数据库。

版本：`codex/control-visual-fix-20260927`，base `1e4921fa16a90fc49dbe9da92f5ea54ca330f6ab`；20个产品/测试文件内容指纹 `91321f525cdf2cb58b7ddb5fa913235194cbf2d7e6495aab7a383d24fb91fdd3`，见 evidence/final-version.json。没有提交、推送、合并或发布。

## 结果

| 门槛 | 结论 | 直接证据 |
| --- | --- | --- |
| 功能正确性 | PASS（本轮实际可达状态） | 7个相关测试文件164项全部通过；真实曲线resize后path/轴/高亮同步；密集历史点鼠标、连续hover、键盘读数一致 |
| 端到端行为 | PASS | root accept-real.json 16项PASS；独立真实账户/币种共享→库/室导航→刷新恢复、详情/搜索/分页/横向滚轮与完整解释展开滚动 |
| 视觉一致性 | PASS（可达真实状态、六视口） | independent-acceptance.md 第三轮直接原图对照；root另行直接查看room/library/holding/history/final-preview截图；无剩余已复现的重大差距 |
| 真实部署库与原始成交保护 | PASS（明确边界） | conf/runtime.json、live-db-open.txt；db-before/db-final/db-comparison：1857成交和208导入批次全行摘要相同，236证券条目数量相同、自动元数据摘要改变 |

修复内容：交易室和交易库实际共用ScopeChoiceGroup/ScopeSelect及样式，标准筛选34px/13px、局部期间与维度28px/11px；清理旧period覆盖。持仓图采用实际宽高且派生路径同步刷新，桌面220px、窄屏190px；历史表现绘图区桌面220px、窄屏240px，解除旧234px卡片固定高度。密集点按真实指针最近坐标选择，键盘精确选择和44px命中圆保留。持仓默认行适度增高、迷你图88×32，11列不删；隐藏精确时间由局部定位限制，修复窄屏整页溢出。资产分布长说明默认摘要并可展开、局部滚动至完整末尾，原金额、未知值和金融口径保留。

root最终实测：资产分布默认321.28px（实际范围/币种不同会变化）；首行83.14px、详情展开136.30px；交易库账户34px/13px。390px既有响应式账户44px/13px。六视口1440、1920、1055、821、820、390，100%缩放、DPR1。原图CSS视口/DPR未知，不宣称逐像素复制。

## 验证与限制

- `npm run test:unit --` 七个相关UI/几何文件：164/164 PASS，evidence/unit-integrated.log。组件合成数据只用于单元测试，未建立独立业务数据库；真实页面未mock、未注入合成交易或行情。
- `npm run typecheck` PASS；相关改动文件ESLint 0 errors、2个原有测试unused变量warnings；`npm run build` PASS（保留现有Node弃用/大chunk提示）；`git diff --check` PASS。日志在evidence下。未运行会创建独立数据库的无关存储测试套件，以遵守本轮数据库指令。
- 鼠标/键盘/实际鼠标滚轮：root及独立审查真实浏览器执行。模拟触控：root最终 touch-real.json PASS，图表tap打开/关闭、tooltip在图下自然流、粗指针42–44px，另有controls粗指针1440上下文证据。**物理触屏 NOT VERIFIED**，没有冒充真机。
- **真实完整估值圆环 NOT VERIFIED**：独立检查实盘8账户×4预设范围未找到此自然状态。保留真实不可用/部分估值展示；完整圆环与多空分支仍有代码/组件测试支持，但不称已实际浏览器验过完整圆环。当前修复未更改金融计算或这些分支的显示条件。
- 本轮无交易/复盘业务写流程改动，保存闭环及回放phase/截止时间验收 NOT APPLICABLE。浏览器没有主动导入、删除或编辑原始交易；原应用会自动资料解析与PUT持久化，因此**不声称整库零写入/零变化**，证券元数据变化详见evidence/db-observation.md。
- 首轮C03旧坐标缓存、C06密集透明命中圆抢事件的FAIL均保留并经修复独立复验PASS。实施期HMR样式丢失图位于evidence/interim-hmr，不作为最终证据。
- root有一张history-1440截图出现空白详情矩形；原图保留。独立按相同操作序列即时/稳定截图均正常，root最终fresh截图final-history-detail.png再次直接确认完整月份与金额可读，未复现；机制未确认，不虚称找到根因。此观察不被删除或用DOM断言取代视觉记录。

## 最后预览与启动

预览：http://127.0.0.1:3044/ ，服务Node PID51619/会话7822仍运行，真实SQLite由lsof核对。

root最后新鲜浏览器检查：2026-09-27 23:25:11 +08:00，evidence/final-preview-check.json PASS、pageerrors为空；直接看final-preview.png、final-history-preview.png、final-history-detail.png确认全局样式和详情文字正常。此后无产品代码修改。

重启：在 `/Users/zhoulin/.codex/worktrees/c414/TradeReview` 执行 `npm run dev -- --port 3044`。使用conf/runtime.json既有绝对数据库路径，不设置新测试库覆盖；若原进程仍运行无需重复启动。

当前聊天交付：提供预览链接、修复概述、164项测试/类型检查/构建结果、启动方式及本记录链接。真实完整圆环与物理触摸未测边界保留，不作无条件全状态/全设备完成声明。
