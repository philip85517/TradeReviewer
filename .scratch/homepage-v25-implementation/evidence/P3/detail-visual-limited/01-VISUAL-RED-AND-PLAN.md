# P3 首切片详情：视觉 RED 与有限修复方案

本记录先于产品修改。P3 仍为 0/3；P1 保留第 2/3 轮 FAIL。本切片只允许 HomeSurface 详情 JSX、CSS 和必要详情交互测试；host、Workspace、目录、F/S、附件、P2/P4、服务和数据库保持冻结。

## 已直接阅读的依据

- 批准正文 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:130–166`：详情关闭回到原搜索结果，保留查询/滚动/所选行；焦点锁定，外点不关闭。
- 同正文 `:312–322`：详情唯一主动作“查看交易”水平居中；关闭恢复来源行、搜索、排序、页码和滚动。
- 已完整读源并看图 `source/images/detail.svg`、`source/images/search-detail.svg`；已看其 P3/reference-readback PNG。
- root 实际截图 `evidence/P3/root-search-detail-default1280x720-dpr2.png`：ROKU metadata-only 详情。本 agent 只查看已存截图，不操作浏览器。

## 正文 / 旧图位置冲突

两 SVG 的主操作框在局部 x64（模态 x40），为左对齐；正文明确要求主操作水平居中。root 已纠正此前按 SVG 左对齐的指令。采用正文，保持主按钮在详情可用宽度的横向中心；来源返回放独立的居中次行，不能拉偏主按钮中心。不得把 root 之前错误裁定写成用户批准变更，也不把正文曲解为仅按钮文字居中。

## 视觉 RED：证据与根因

| 项目 | 原稿 / 正文 | root 截图与当前源 | 根因 |
|---|---|---|---|
| 标题层级 | 24px、600 | 当前继承通用 h2 的 18/24 | 详情缺局部标题规则 |
| 容器底色 | #111A26 | 当前 #162233 | 详情误用浮层底色 |
| 主按钮 | 120×36，#162233 背景、#6CA8FF 边框、正文色 | 当前 min-width160、实心蓝 | footer 通用最小宽度 + hp-primary 实心样式 |
| 来源返回 | 两图明确标注各自返回源；正文要求保留来源 UI | 当前只有关闭 X / Esc，没有可见来源次动作 | footer 缺来源控件 |
| 尺寸 | 图示 1020×500；本次 root 要求桌面 min-height500 | root 实测 1020×478 | 仅内容自撑，缺桌面下限 |

以上为 root 视觉 FAIL 的来源记录，不是本 agent 独立视觉验收。

## 精确实施尺寸与行为

1. 宽度仍 1020px/max-width100%，padding24px、边框1px、圆角8px；详情标题独立 24/32、600，长标题允许换行，关闭按钮保持可达。
2. 桌面 min-height500px、max-height 为视口减48px，整体 overflow:auto；flex 纵向排布，直接内容不 shrink，KPI 保留四列/每张88px，内容多则增高或滚动。
3. 主操作改详情专用样式：宽120px、高36px、#162233 背景、#6CA8FF 边框、#E6EDF7 文字；独占居中行。次操作与主操作间8px，独立居中行，蓝色文字、无边框，仍36px命中高度；长返回文案可换行。
4. footer 上侧至少24px；正常数据态可由 auto margin 使用多余高度，缺失原因、真实来源文字不隐藏、不绝对定位、不覆盖 KPI。此次不强行套用旧 SVG 左下角 CTA 坐标或额外54px底部空白。
5. 宽度≤900px或高度≤548px时取消500px下限，以现有两侧24px限制和整体滚动保持可达；宽度≤600px的四 KPI 改单列，保留88px最小高度，避免窄列标签挤压数值。使用动态视口上限处理移动地址栏。
6. 来源次动作复用既有 closeDetail，不新增导航/状态权威。持仓文案显示实际页码；搜索当前为连续滚动结果，没有页码字段，因此显示“返回原搜索结果 · 恢复原滚动位置”，不捏造图示第2页。

## 验证顺序与边界

- 先为真正的来源返回按钮写 RED：持仓非默认 query/sort/page 返回及准确焦点；metadata-only 搜索 query/selected/scroll 返回及准确焦点，且不触发交易导航。
- 修复后运行既有 HomeSurface / search 交互回归，覆盖唯一查看交易、外点不关、Esc/关闭焦点、四核心指标、未知值、拒绝导航等；不编写镜像 CSS 数值测试。
- 定向 lint、严格 TypeScript；记录源 hash 和未修改文件稳定性后冻结。
- 实际渲染、两宽/矮屏/窄屏视觉、真实键盘/鼠标、emulated/physical touch 交 root 独立核查。本 agent 不自行签视觉 PASS；本次未访问浏览器、服务或数据库。
