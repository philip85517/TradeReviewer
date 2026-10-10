# 01 — 冻结 0.7 基线与同状态比较矩阵

ID: strategy-visual-acceptance-plan-20261011-01
Labels: wayfinder:task
Mode: AFK
Parent: [00 — 策略台视觉验收与实施规划](00-map-strategy-visual-acceptance.md)
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: /root

## Scope / What to build

把 0.7 归档和当前可复现入口整理成后续所有视觉审查共用的“同状态比较矩阵”。固定每个场景的 URL、数据/文案、阶段、图表范围、导航状态、CSS viewport、浏览器缩放、DPR、滚动位置、原图像素尺寸、文件哈希和证据限制。补列工作流要求但 0.7 尚未覆盖的 1280×800、导航展开和真实手机软件键盘状态，并把旧 FAIL/NV 记录映射到新证据位置。

本票不修改产品代码、不重拍就覆盖历史图、不把归档截图直接声明为生产视觉通过。

## Refs

- [0.7 视觉检查点](../../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/README.md)
- [0.7 manifest](../../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/manifest.json)
- [完整 Workbench 恢复记录](../../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)
- [严格回归](../../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)
- [滚动修复](../../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)
- [开发工作流的视觉视口要求](../../../docs/agents/development-workflow.md)
- [DESIGN-COVERAGE P02/P07/P09](../DESIGN-COVERAGE.md)

## Blocked by

- None（创建全部票后第二遍补充正式依赖）

## 验收标准与反例

- [ ] 清单明确策略台 complete/running/T0/results/compare 和 Recall S0/S1/S2 的固定数据、文案、图表范围和 URL。
- [ ] 每张参考图记录原始像素尺寸、CSS viewport、DPR、缩放、滚动和导航状态；未知项明确标记，不从文件名猜测。
- [ ] 矩阵至少列 1440×900、1280×800/720、1024/980、760/759、600、390，并列出选中、焦点、禁用、展开、播放/暂停和长文状态。
- [ ] 旧 FAIL/NV 没有被覆盖；每项都有“保留、重新验证或移出范围”的理由和证据位置。
- [ ] 反例：用 1440 截图缩放后冒充 390 CSS viewport；只打开一个 complete 图却声称完整 Workbench 覆盖；把真实手机键盘写成桌面窄屏。

## 验收证据

- 交付：[visual-contract.md](../visual-contract.md) 的参考表、`DESIGN-COVERAGE.md` P02/P07/P09 更新和一份可读的比较矩阵。
- 需要真实浏览器的当前入口重跑记录；归档引用、manifest/hash 和缺失能力分别列出。
- 规划票不写产品实现测试；若无法取得新鲜画面，保留 `NOT VERIFIED`，不能用 DOM/HTTP 替代。
- 协调者接受：留空，待完成矩阵后独立复核。

## 派发说明

允许写入本规划目录的 `visual-contract.md`、`DESIGN-COVERAGE.md` 和本票附属证据目录；禁止改产品代码、归档历史 hash、共享业务数据库或远端分支。输出应让 02–06 直接引用，不增加新的视觉候选。

## 历史

- 2026-10-11：创建，等待领取。
