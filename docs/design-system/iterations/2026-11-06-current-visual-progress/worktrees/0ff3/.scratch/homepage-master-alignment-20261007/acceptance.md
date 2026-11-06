> 当前状态见 [整体验收](FINAL-ACCEPTANCE.md)：浏览器权限已恢复，HA03/HA04及真实首页交互已复验。以下完整保留首次阶段的证据与失败，不作为当前状态。

# 历史验收记录（首次阶段，非当前结论）

任务 HA01；State: open；Status: acceptance-failed。记录日期：2026-10-08（Asia/Shanghai）。root 协调、整页体验与数据流；实现 Luna；独立源码审查 master_alignment_audit 与 root。结构基准为已 fetch 的 master/origin/master 7a5d137，当前工作树此前修复仍保留。此阶段交付可启动的候选，不签署完整 UI 接受。

预览：[完整首页视觉比较](http://127.0.0.1:3031/design-preview)。比较的“现有首页”是当前工作树组件，不是纯 master 运行图。旧合成/复盘样板保留在 [/design-preview/component-sample](http://127.0.0.1:3031/design-preview/component-sample)。数据路径：本工作树 .scratch/local-review-20261006/review.sqlite，明确 TRADEREVIEW_DB_PATH 与 TRADEREVIEW_DESIGN_PREVIEW=isolated；正式数据库禁止写。

| 门槛 | 结论 | 依据与未决项 |
| --- | --- | --- |
| 源码结构与变更边界 | PASS（源码范围） | [独立审查](evidence/independent-review.md)、[变更边界](evidence/source-boundary.json)。790 个既有产品文件中仅预览 page 改动，6 个允许新增文件，0 删除及额外变更；不是 Git HEAD diff |
| 类型与 scoped ESLint | PASS | root 独立 [typecheck](evidence/root-typecheck.json)、[lint](evidence/root-scoped-lint.json) exit 0；最终仅再改 CSS，所检 TS 文件未变 |
| 新预览自动化行为 | PASS（7 项） | [新测试](evidence/root-preview-tests.json)：6 项 filesystem/runtime guard、1 项 React wrapper 保持子状态。未覆盖真实 Workspace 筛选/导航/图表范围 |
| 保留旧样板安全测试 | PASS（11 项） | [旧 fixture 检查](evidence/root-preserved-fixture-tests.json)；不替代真实图表推进/保存 |
| 最终构建与运行检查 | PASS（build + 5 项） | [最终 npm test](evidence/root-final-build-and-runtime.json)、[输出](evidence/root-final-build-and-runtime.log)。storage test 自建临时库，其余为 HTTP/源码/资源检查；非完整 unit suite 或浏览器验收 |
| DB 隔离与原始交易保护 | PASS（限定范围） | [前后核对](evidence/database-comparison.json)：两库不同 inode，各 46 表计数与 6 个受保护表摘要稳定；门禁校验标记/绝对路径/普通文件/realpath，不证明业务写入旅程 |
| HTTP服务与资源可用 | PASS（HTTP only） | [启动回执](evidence/preview-start-receipt.json)、[3 页面/15 项 CSS JS](evidence/http-assets.json)。推荐 class、比较文字、最终 CSS 已输出；SSR 连接状态不能证明 hydration 后完整首页 |
| 实际导航/状态比较/滚动 | NOT VERIFIED | browser URL policy 拒绝，禁止替代绕过；未执行最小首页→切视觉→持仓/待复盘→交易库→返回旅程。宿主滚动源码不证明“无法上下滑动”已验收 |
| 鼠标/键盘/模拟触控/实际触屏 | NOT VERIFIED | 未执行，证据不可互相代替 |
| 实际字体/尺寸/对比/最新截图 | NOT VERIFIED | 无本轮渲染画面；[静态候选色值计算](evidence/candidate-color-contrast.json)不含级联/透明度/混色，不能当实测 |
| 独立同状态视觉对照 | NOT VERIFIED | 无本轮截图；源码不能代替 |
| 新增写入闭环 | NOT APPLICABLE | 本轮不新增持久化接口；不能代表原写入重新通过 |

## 数据证据边界

首次快照 [database-before.json](evidence/database-before.json) 的摘要编码未保留，故仅用它比较最早表计数。可重复摘要前后为 [before-verification](evidence/database-before-verification.json)（16:19:32 UTC）与 [after](evidence/database-after.json)（16:34:07 UTC），算法存于 [check-databases.py](evidence/check-databases.py)。两次可重复快照之间摘要一致；不比较不同编码的首次摘要，也不作覆盖整个历史开发期的无写入声明。

隔离副本 `/Users/zhoulin/.codex/worktrees/0ff3/TradeReview/.scratch/local-review-20261006/review.sqlite`。正式库沿用 conf 默认绝对路径，正式 3022 配置不改。启动脚本固定副本与标记；运行测试显式 override。HTTP 不执行客户端脚本；只读证据不是保存→返回→重载闭环。

## 修正与证据历史

旧短样板偏离 master 的问题在源码层改为完整真实 Workspace 单次挂载；旧样板另行保留。独立审查发现持仓按钮/搜索/排序/分页字级、主动作 44px 被缩小及 H06 嵌套 small 漏行高，已回交修正。最后变更前构建与 SHA 证据保留；最终 CSS SHA `a2fcd1793c45ce4bbbcba2ef4db25419fa2c4a9946eb6a3d74320591cd73677c`，之后重建通过并启动，服务输出最终样式。

首次 HTTP 检查要求旧样板 home 初始 HTML 包含 S0/S1/S2 全部标签，断言 FAIL 保留在 [初次结果](evidence/http-assets-initial-assertion.json)。核对实际摘要初始视图与客户端引用后，以正确的初始 transport 标记复验；阶段交互仍未验证，未为此改旧实现。

既有盈亏固定色覆盖、清除筛选的历史行为差异见 master 审计；本轮保留而不借视觉检查宣称已修复/接受。历史失败记录不删除。

## 未决项与后续固化

root 负责浏览器策略恢复后的最小真实旅程、同状态 before/after 截图及独立视觉审查：1440×1000、1280×720、1054/1055、759/760、1024×768、390×844、320×740及粗指针；真实字体/表格裁切/滚动/全部输入方式分开验证。用户无需先规定设计数值，需要选择实际画面的焦点、密度、阅读感受与操作清晰度。

原拒绝及禁止绕过见 [browser-security-rejection-original.json](../homepage-adjustment-20261006/acceptance/browser-security-rejection-original.json)。本轮未使用其它浏览器、headless、CDP、代理或替代端口绕过。

功能正确性仅自动化范围 PASS；端到端行为 NOT VERIFIED；视觉还原 NOT VERIFIED。**最终保持 open / acceptance-failed；样板阶段成果已交付，整体尚未接受。** 规范候选与选定后公共样式/组件/指令固化范围见 [首页规范 v0.2](../../docs/design-system/TradeReview-首页拉齐-v0.2.md)。未提交、推送、合并或发布。

2026-10-08 追加：窄屏展开菜单发现左裁，HA03 open，见 issues/03-narrow-overlays.md；此前折叠态布局通过不能覆盖展开态。
