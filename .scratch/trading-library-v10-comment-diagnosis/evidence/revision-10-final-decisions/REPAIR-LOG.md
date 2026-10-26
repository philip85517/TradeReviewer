# 用户决策落地：验收修正记录

此前 revision-10-repair 中的失败与修复历史保持不变。以下为用户确认 B 与最差练习回撤后的新增检查。

| ID | 发现/根因 | 修复与状态 | 证据 |
|---|---|---|---|
| F01 | 初版图稿未显示回撤短定义；还加入未接入任何消费者的权益计算 helper，0/负权益及 NaN 边界不正确 | 删除不属于静态设计交付的 helper；正文定义完整口径，风险带补短定义。最终视觉待复验 | task-5-report.md；独立 reviewer 静态审查 |
| F02 | common_chrome 只改标签坐标，没有按批准 B 的整行层级组织；tabs 多占一行 | 首帧 gate FAIL，退回唯一 owner。禁止先批量传播 | root-rep-live-1440.png；revision-10-repair/root-final-nav-B-1440.png |
| F03 | risk_band 高度增加18px，下游仍按旧高度推进，卡间距缩为6px | 退回 owner 同步下游布局 | reviewer 检查 stats_frame |
| F04 | 原型说明未明确全部有效才显示数值、部分覆盖与空练习行为 | 补分行说明和空态，静态检查通过；最终独立验收待完成 | task-6-report.md；root-prototype-B-sim-stats-1440.png |
| ENV01 | 旧3090静态服务监听但HTTP无响应，浏览器超时 | 确认进程属于本任务后重启；新会话68821，真实浏览器可打开 | 根因系预览进程，不归类为产品控件故障 |

## F02 连续复验记录

- 首次调整把页签放到标题行，但摘要与“列表”重叠；证据 `root-rep-live-1440-fixed.png`，FAIL。
- 第二次以 `textLength=190 / spacingAndGlyphs` 压缩摘要，实际字符被压扁；证据 `root-rep-live-1440-fixed2.png`，FAIL。根因是 label/完整条件/tabs 的横向总宽度没有纳入空间预算。
- 后续方案必须保留自然12px字宽，扩大完整摘要槽位并向左分配空间，核对1280长标题，禁止以缩字代替布局修复。

## 最终复验

F01/F02/F03/F04 均复验PASS：短定义与完整权益口径一致，B自然12px摘要不碰撞或压扁，风险卡下方24px间距，原型缺失/覆盖/空态明确。前述FAIL保留为修复历史，逐帧证据见独立报告。

F05：独立reviewer发现首次加载仍复用完整趋势点。owner让loading传空points，复用正在加载分支，仅重新生成05；不再泄漏曲线/日期/金额。05-loading-FAIL.png保留失败，frames/05-loading.svg.png复验PASS。

包范围修正：额外1280返回图不是reader引用图，已纳入58文件包的extra_acceptance_frames及真实截图。本次检查37张变化帧，reader仍40引用图。
