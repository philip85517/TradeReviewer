# 当前参考资产与首条旅程派发准备

ID: homepage-v25-assets
State: closed
Status: accepted
Assignee: Luna-assets
Model: gpt-5.6-luna
集成负责人: /root
Acceptance rounds: 3/3 PASS

## Scope / What to build

把公共96状态（85适用11原NA）逐项对应当前可用 source 图和 component-manual 的准确锚点，保留旧 evidence.asset 缺失事实。形成 P1 首张整页与真实持仓旅程的逐控件/操作/状态登记、精确视觉预算与接入建议，只准备不实施产品。

## Refs

原设计根 docs/design-system/baselines/2026-10-22-homepage-v2.5/，读取 source/visual-design.candidate.md HP11:40–110、HP04:253–346、HP08:516–549、HP10:550–568、附录C:630–645；source/component-manual.html、source/inherited-contract.current.json；source/images/home-1440.svg、home-1280.svg、holdings.svg、holding-detail.svg 及原文对应实际图；prototypes/round4/index.html、round5/index.html。文件名若不存在，读 boards-index/manifest 找真实资产并说明，禁止虚构。

读取本项目 docs/agents/frontend-control-audit.md、ui-task-templates.md、task-decomposition.md。DESIGN-COVERAGE 与 CONTROL-STATE-COVERAGE 为全集分母，无原 elementID 的使用真实 manifest 文本定位。A 是准备 owner，P1–P5 是产品 owner，/root 是整页视觉/完整数据链和独立接受者。

## Blocked by

None

## 验收标准与反例

- [x] 96状态逐项当前资产/手册锚点、原NA依据和旧路径缺失事实，不把 NOT_ACCEPTED 误称通过。
- [x] 明确读过原图与 round4/5 的实际状态，保留可重现参考方法。
- [x] P1 逐控件清单、条件入口、真实详情/交易库/返回/非法来源；后续状态不冒充已实现。
- [x] 1440×1000、1280×800 的布局尺寸、8行槽、持仓摘要C、24徽章、字段/命中区、字体密度与禁止静默偏离项。
- [x] 当前 workspace/dashboard 可用接口和 P1 文件接入建议，不写产品。

## 派发说明

只写 evidence/A/，不改任何产品或其他 tracker，不再派代理、不提交、不启动服务、不触碰业务库。纯文档票无需产品浏览器/数据库验收；原图阅读可用可用工具，不得伪造截图已读。

报告 evidence/A/report.md 及映射文件。最多3轮协调者验收；第三轮失败暂停，不能自标 accepted。

## 验收证据

第1、2轮 FAIL、第3轮 PASS，仅接受准备范围。见 evidence/A/acceptance-1.md、acceptance-2.md、acceptance-3.md。96状态的手册锚点及当前参考图路径独立校验通过，P1旅程/接口/owner修订完成。该接受不代表产品视觉、交互、真实持久化或完整功能通过；P1仍因S暂停而未派发。
