# 复盘页视觉规范 V1.0

> **当前阅读入口：** [11/6最新方向与覆盖表](../../iterations/2026-11-06-current-visual-progress/README.md#review-current)。本目录保全10/24历史候选、最新原型及版本证据；旧正文与解释图尚未回填，不再是现行权威。零至零回合/清仓门槛、独立持仓判断、加减仓表单、节点绑定Text等冲突以当前入口为准。

> **2026-11-06 用户取舍：** 图上 Text 由用户自行放置；影响阅读时由用户自行调整文字控件范围。不要求系统专门自动避让文字与文字、文字与成交标记的重叠，同点可读性不再单独作为验收失败。下文 2026-11-05 评语保留为历史，其他功能和整页视觉仍需分别核验；正式规范待原型经用户确认后再更新。

状态：2026-10-24 全文候选改写完成，待设计审阅。范围仅复盘工作区；12 项文档任务已整合为 10 章正文，业务功能未实施，待决议事项没有自动批准。

视觉迭代更新：当前正文缺少与新规则对应的完整界面和公共规范应用样例，视觉设计包尚不完整。用户已确认先审阅完整工作区原型，再补控件与状态示例，达成一致后回填规范。[原因与迭代计划](../../../../.scratch/review-workspace-design-map/visual-recovery-20261024/PLAN.md)及[视觉覆盖清单](../../../../.scratch/review-workspace-design-map/visual-recovery-20261024/DESIGN-COVERAGE.md)已建立。2026-10-24 已按用户“确认推进”制作独立原型，正式正文、阅读页、既有工具原型与用户评论继续保留。

- [阅读10/24候选](visual-spec.html)：目标与取舍 → 空间与工具 → 交易动线与时间 → 计划、指标、评价 → 适配与出口 → 覆盖和验收。
- [10/24历史候选正文](source/visual-design.candidate.md)：保留原讨论，后续经原型确认再回填。
- [12 项任务汇总](../../../../.scratch/review-workspace-design-map/README.md)：目标、验收、执行思路和本轮制作状态。
- [逐章扫描与改写记录](evidence/full-rewrite-20261024/scan-and-rewrite.md)：原导言及十章的问题、根因、改写去向。
- [本轮验收](evidence/full-rewrite-20261024/acceptance.md)与[独立审查原文](evidence/full-rewrite-20261024/independent-review.md)：版本、检查范围、发现、修复和保留边界。
- [TradingView 逐项对照](prototypes/tradingview-alignment-v0.1/index.html)：原图与已修正候选，13 个绘图槽和 7 个回放入口；未知身份、真实操作与触控仍待补证。
- [完整工作区原型 v0.1](prototypes/workspace-v0.1/index.html?variant=A&scene=entry)：用户已选择 A，已有同股交易次数列表、买入前/结束之后表单、持仓自由图上 Text 与缩小工具条的候选。限定功能、内存旅程与两种桌面视口视觉独立检查通过的[首轮记录](../../../../.scratch/review-workspace-design-map/evidence/immersive-layout/revision-01/acceptance.md)只适用于当时版本，不能替代后续验收。首稿证据保留，原型不代表正式功能或完整 TradingView 1:1 实现。

2026-11-05 当前原型以 [candidate-45 验收记录](../../../../.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)为准。短窗口布局、回放视野、表单和焦点等修复已有局部证据，但密集 Text 仍遮挡行情、与成交标记混淆，[独立静态视觉复核](../../../../.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-final-candidate45/INDEPENDENT-VISUAL.md)为 **FAIL**；独立浏览器操作等路径尚未验证。原型仍待用户审阅，确认后才回填正式规范。

2026-11-05 另有[自由 Text 轻量隔离候选](../../../../.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-04-direct-text-stage/REPORT.md)，尚未并入当前原型。局部编辑提示已修正，但文字与成交标记归属、重叠可读性仍为视觉 **FAIL**；独立浏览器交互未验，不改变 candidate-45 或正式规范的结论。

## 版本与图示

继承 V2.5 公共视觉、2026-09-25 主图需求及 E01–E22。正文逐项映射 22 个原元素和 N01–N04，区分用户方向、继承约束、候选规则和证据缺口。批次细则、评分阈值、部分尺寸及触控适配仍是候选。

当前正文使用 5 张解释图：空间预算、数量配对、连续动线、响应状态和评分状态。它们说明设计关系，不代表高保真产品状态稿或真实操作证据。原 01–10 画板保留为历史参考，不再证明本轮新方案。原四条评论及状态不变；`comment-migration.json` 只承接章节/图示导航，不代用户解决评论。

历史[最初验收](evidence/acceptance.md)、[最初视觉审查](evidence/independent-review.md)及[上一轮文案改写](evidence/editorial-rewrite/scan-and-rewrite.md)仅适用于各自版本；本轮以 full-rewrite-20261024 为准。

## 本地预览

在仓库根目录执行：

```sh
PORT=3091 docs/design-system/start-design-preview.sh
```

打开 http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/visual-spec.html 。服务只提供设计文件与文档评论，不启动业务服务或访问业务数据库。

## 重建与检查

在本目录执行：

```sh
python3 source/generate-rewrite-diagrams.py
python3 build-visual-spec.py --source source/visual-design.candidate.md --version 1.0 --output-dir .
```

再回到仓库根目录执行：

```sh
python3 docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/check-document.py
```

检查脚本校验结构、链接、图稿、评论哈希和算例，并刷新当前评论映射与静态检查结果。它不验证业务计算程序。文档身份 `REVIEW-WORKSPACE-V10` 不变；保留 identity 文件及旧图，避免丢失评论位置。原 `generate-boards.py` 只对应历史画板，不用于本轮解释图。
