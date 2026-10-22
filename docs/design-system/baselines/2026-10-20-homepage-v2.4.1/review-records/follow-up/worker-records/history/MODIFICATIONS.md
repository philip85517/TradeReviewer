# 修改清单与合入说明

## 允许清单内直接修改

本组直接修改了以下 authority source 图稿：

- `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images/history.svg`
- `history-stats-cumulative.svg`
- `history-stats-empty.svg`
- `history-stats-error.svg`
- `history-stats-extreme.svg`
- `history-stats-rounds.svg`
- `history-stats-source-missing.svg`
- `history-stats-win.svg`
- `journeys-year.svg`
- `contribution-current-a-share.svg`
- `contribution-historical-a-share.svg`
- `contribution-extreme.svg`
- `contribution-mixed-sign-demo.svg`
- `contribution-states.svg`

这些源图的版本身份保持 V2.4.1，未写入 V2.3。`contribution.svg` 等其他局部状态没有被脚本重建或删除。

## 只写入工作目录、由 root 决定合入的内容

- `transform-history-source.mjs`：局部历史/贡献同步脚本，幂等。
- `apply-shared-embedded.mjs`：四个整页 SVG 的可审阅/可应用补丁；默认 `--check` 只报告，`--preview` 只写工作目录，`--apply` 才改共享整页。
- `render-evidence.mjs`、`render-shared-evidence.mjs`：sharp 栅格证据生成器。
- `verify-final.mjs`：局部中空柱与四张整页 preview 的静态守卫；输出 `evidence/static-check.json`，不替代浏览器/交互验收。
- `hash-evidence.mjs`、`evidence/SHA256SUMS.txt`：把本轮源图、脚本、报告及栅格/整页 preview 绑定到修订后哈希。
- `review-records/follow-up/history-tools/`：复制可重复的局部/整页检查、预览、渲染、静态守卫与哈希工具；`repo-root.mjs` 使其从任意工作目录定位仓库根，`README.md` 明确 `--apply` 是 root 审核后的唯一整页写入入口。
- `evidence/updated/*.png`：局部图稿证据。
- `evidence/shared/*.svg`、`evidence/shared-rendered/*.png`：整页候选证据。
- `evidence/static-check.json`：四张整页与局部状态的静态守卫结果；历史模式要求禁用 checkbox 且只保留实心图例，当前模式要求两项图例，四张整页金额轴要求保留五条原刻度并在插值位置 `y=470` 标出真实零线，排序文字不得含 `↓`。
- `COVERAGE.md`、本报告和 `BOARD-GUIDANCE.md`：覆盖、边界和合入记录。

## 明确未修改

没有直接编辑 `source/visual-design.candidate.md`、任何 `home*.svg`、`visual-samples-board.svg` 或历史冻结副本。也没有启动产品、访问业务数据库、提交、推送或派代理。

## root 合入前守卫

1. `node --check` 两个 `.mjs`。
2. 执行 `apply-shared-embedded.mjs --check`，确认四个目标均只报告 pending，且没有 marker/viewBox/series 守卫错误。
3. 执行 `--preview` 与 `render-shared-evidence.mjs`，查看四张整页 preview；确认历史位于持仓之后、贡献为唯一底部区，历史控件无可见“范围/展示方式”标签但保留 group `aria-label/title`，局部尺寸/顺序未漂移。
4. root 明确接受 preview 后才执行 `--apply`，并在独立浏览器 tab 复验 1440×1000、1280×800、D07/D10/D11/D12/D13/D14；失败时保留旧证据并更新 issue/acceptance 记录。

## 本轮退回项闭环

- 当前 `source/images/contribution*.svg` 中所有中空柱均按 14px 外高归一：矩形内部为 12px 高、四边各内缩 1px，`stroke-width=2` 不改变可见外框；14px 实心柱和原始数值/标题未改。
- `apply-shared-embedded.mjs` 的四张整页候选保留原 contribution 数据，删除第二个“亏损最大”视觉面，改为单一“盈利最高”排序 select（视觉面 28px、命中区 36px、独立 SVG chevron），分类仍为 14px 标签/28px 视觉面/36px 命中区，选中项用下划线。
- 整页贡献区保留 round5 的“仅看未平仓” checkbox：当前模式为可用空框，历史模式为 `aria-disabled="true"` 的禁用视觉；全局“全部市场”选择器补有独立 28px 视觉面、36px 命中区和 chevron。当前模式图例为“已实现（实心）/浮盈变化（中空）”，历史模式只保留“已实现（实心）”。
- `childBlock()` 通过 SVG 深度匹配截取子图，不以第一个 `</svg>` 截断；历史 chart 直接保留原始轴、series 和点，只调整已确认 token/状态背景。
- 整页历史零线根据嵌入 child 的轴标签计算；当前轴的 `1,500@440` 与 `−1,000@490` 插值为 `y=470`，以独立 `data-state="zero-line"` 线表达，不把最近的刻度线误标为零线。贡献排序只保留文本 `盈利最高`，方向由独立 SVG chevron 承担。
- 年度 `9 / 14 盈利回合` 改为与 `64.3%` 同一 `y=157` 基线并右锚至 x=1026，避免年度 KPI 计数下沉或贴近卡片中线。

