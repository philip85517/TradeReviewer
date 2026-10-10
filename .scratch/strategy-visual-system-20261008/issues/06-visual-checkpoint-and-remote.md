# 06 — 归档当前视觉版本并推送任务分支

ID: TR-VIS-06
State: open
Status: ready-to-commit
Assignee: visual_checkpoint_docs_luna
集成负责人: root；独立审查: checkpoint_audit

## Scope / What to build

2026-10-10 用户：“先将当前的视觉效果沉淀至本地，并将视觉版本沉淀至文档索引，并提交到远端分支”。冻结当前已确认的完整观察 0.7（含滚动修复）、关联样板和历史证据；建立仓库文档入口与视觉版本索引；提交并推送 `codex/strategy-visual-system-20261008`。不改视觉、交互、数据和已有冻结清单，不扩大为生产接受或基线合并。

## Refs

- 用户本轮原话；[当前视觉规范](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)、[0.7 规则](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-reuse.md)、[最新滚动接受](../../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)。
- 精确参考图：`../evidence/observe-scroll-20261010/after-top-1440.jpg`（1440×900/DPR1）、`after-top-1280.jpg`（1280×720/DPR1）、`after-top-390.jpg`（390×844/DPR1）、`final-live-bottom.jpg`（1280×720/DPR2）；均 EMA20、2024-09-13、完整净值观察。
- [DESIGN-COVERAGE](../DESIGN-COVERAGE.md) A01–A03；[项目远端工作流](../../../docs/agents/development-workflow.md)“仅要求提交/推送分支”。

## Blocked by

None。05 局部接受作为历史依据；本票不消除整体 01 的未验证项。

## 验收标准与反例

- [x] 本地版本页、截图、SHA256清单与精确复现入口存在，原证据哈希保持；不能用静态图冒充完整运行预览。
- [x] 根 README → 文档索引 → 视觉版本索引 → 0.7检查点可达，明确布局差异、数据/范围、已验/未验及启动方式；不把用户视觉认可写成生产完成。
- [x] 当前源码适用的检查结果与限制如实记录；可预览 URL 在真实浏览器新鲜确认，服务继续运行。
- [ ] 仅任务相关文件提交；不含数据库、账单、凭据或临时基线副本。远端分支 SHA 与本地 HEAD 相同，保留 worktree。

## 派发说明

Luna仅写 `README.md`、`docs/README.md`、`docs/designs/README.md`、`docs/designs/2026-10-08-strategy-visual-system/README.md`（只追加检查点入口）、`docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/README.md`。先读上述真实规范、接受及参考图，不再派代理。不改源码、已有证据、历史接受，不执行 Git 提交/推送。root负责截图/manifest、验证、接受、提交和远端核对。checkpoint_audit只读审查提交边界与归档完整性。

## 验收证据

root：当前版本页/截图/manifest 存在，73相对链接与SHA核对PASS；typecheck、9文件193项单测、npm test构建及5项集成PASS；真实浏览器新鲜确认并留服务运行。源码/公开样板/当前文档格式PASS；14个原始报告/日志80项尾空白/末空行保留，完整暂存格式检查FAIL不伪装为通过。独立审查发现3份旧业务参考原件，保留本地并显式ignore，排除清单记录原SHA；不将远端归档宣称为全合成/全量原始证据。独立最终审查PASS，见[归档独立审查](../reports/checkpoint-archive-audit-20261010.md)；Git远端回执待完成。
