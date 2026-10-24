# 复盘页视觉规范 V1.0

状态：2026-10-24 全文候选改写完成，待设计审阅。范围仅复盘工作区；12 项文档任务已整合为 10 章正文，业务功能未实施，待决议事项没有自动批准。

- [阅读新版](visual-spec.html)：目标与取舍 → 空间与工具 → 交易动线与时间 → 计划、指标、评价 → 适配与出口 → 覆盖和验收。
- [权威正文](source/visual-design.candidate.md)：后续编辑入口。
- [12 项任务汇总](../../../../.scratch/review-workspace-design-map/README.md)：目标、验收、执行思路和本轮制作状态。
- [逐章扫描与改写记录](evidence/full-rewrite-20261024/scan-and-rewrite.md)：原导言及十章的问题、根因、改写去向。
- [本轮验收](evidence/full-rewrite-20261024/acceptance.md)与[独立审查原文](evidence/full-rewrite-20261024/independent-review.md)：版本、检查范围、发现、修复和保留边界。
- [TradingView 逐项对照](prototypes/tradingview-alignment-v0.1/index.html)：原图与已修正候选，13 个绘图槽和 7 个回放入口；未知身份、真实操作与触控仍待补证。

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
