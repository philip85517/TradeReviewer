# 公共规范与交易库文档拆分

本轮整理现有累计规范，不新增产品设计，也不覆盖历史版本。

|版本|职责|正文|
|---|---|---|
|V2.4.2|冻结拆分前完整内容与评论|[完整快照](../../baselines/2026-10-22-homepage-v2.4.2/visual-spec.html)|
|V2.5|全站原则、基础视觉、公共控件，以及首页完整方案|[当前文档](../../baselines/2026-10-22-homepage-v2.5/visual-spec.html)|
|交易库 V1.0|交易库目标、取舍、布局、范围、列表、回合、统计与复盘|[当前文档](../../baselines/2026-10-22-trading-library-v1.0/visual-spec.html)|

公共标准由 V2.5 的原则、视觉基础、公共状态、控件章节及手册维护。交易库引用固定版本，只定义自身业务组合和状态边界，并说明公共组件为何不能独立表达这些业务。首页第七章只说明入口、传入条件、返回恢复，内部流程交给交易库 V1.0。

## 保存与评论

拆分时共保存43条评论，包含原文、状态、回复与历史；评论不因拆分自动解决。原始记录的 SHA-256 为 `03ca5132853155fae9217cca75ac04002f9043bdbc0e1edcb707d3b73892d543`。

[完整历史评论及归属](../../baselines/2026-10-22-homepage-v2.5/review-records/split-comments.html)保留原文档定位；归属说明仅用于分工，不将旧段落坐标强挂到新文档。V2.5 与交易库 V1.0 使用独立评论身份，服务记录位于 `docs/design-system/reviews/`，可随 Git 保存。离线打开可阅读正文及冻结评论档案，新增评论需要启动本地服务。

## 检查与追溯

- [自动完整性检查](verification.json)：快照、图稿字节、分镜覆盖、链接、身份与评论保存。
- [独立复核](independent-review.md)：另一代理对来源和拆分正文的只读审阅。
- [整体验收](acceptance.md)：协调者的浏览器检查及本轮范围。
- 检查命令：`python3 docs/design-system/iterations/2026-10-22-design-doc-split/verify.py`。
- 重建命令：`python3 <版本目录>/build-visual-spec.py`，默认使用包内 `source/visual-design.candidate.md`。

## 启动

```sh
"/Users/zhoulin/.codex/worktrees/12f2/TradeReview/docs/design-system/start-design-preview.sh"
```

默认端口3090。统一服务以仓库 docs 为根目录，版本间引用可以正常打开。服务只保存设计评论，不连接产品数据库。本轮未提交、推送或合并；文件均保存在仓库内供后续 Git 追踪。
