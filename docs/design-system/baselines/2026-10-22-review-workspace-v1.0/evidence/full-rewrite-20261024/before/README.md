# 复盘页视觉规范 V1.0

状态：设计提案。依据用户修正，范围仅复盘工作区；本轮不改业务页面。

- [浏览规范](visual-spec.html)：10章设计论述、规则与10张状态画板。
- [权威正文](source/visual-design.candidate.md)：后续修改此文件后重新构建。
- [验收记录](evidence/acceptance.md)：静态设计证据及产品实现边界。
- [独立视觉审查](evidence/independent-review.md)。
- [全文扫描与改写记录](evidence/editorial-rewrite/scan-and-rewrite.md)：2026-10-23逐章问题、结构调整与改写验收。

## 版本关系
继承全站 V2.5 公共规范、2026-09-25 主图复盘需求及 E01–E22 元素规范。新布局与信息组织为候选设计，未标作用户已批准。首页、历史列表和交易库页面不属于本次改版。

## 本地预览
在本仓库根目录执行：

```sh
PORT=3091 docs/design-system/start-design-preview.sh
```

打开 http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/visual-spec.html 。服务仅提供设计文件与文档评论，不启动业务服务，不访问业务数据库。

## 重新构建
在本目录执行：

```sh
python3 source/generate-boards.py
python3 build-visual-spec.py --source source/visual-design.candidate.md --version 1.0 --output-dir .
```

文档身份为 `REVIEW-WORKSPACE-V10`，与首页和交易库评论分离。保存原有 identity 文件可维持块身份。

## 2026-10-24 直接参考补充

[TradingView 工具栏与回放条约束](source/references/2026-10-24-tradingview-toolbar-contract.md)及用户原图已归档。现有正文与画板尚未落实这次要求，历史验收不代表新增范围通过。
