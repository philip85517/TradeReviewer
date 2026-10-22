# 全站公共规范与首页视觉设计 V2.5

[完整可评论文档](visual-spec.html) · [拆分时全部43条评论与归属](review-records/split-comments.html)

本版本依据当前 V2.4.1 的累计确认内容整理。V2.4.2 冻结拆分前内容；V2.5 为全站公共标准与首页完整设计；交易库 V1.0 承接内部设计。拆分不改变已确认图稿和产品行为。

## 启动预览

```sh
"/Users/zhoulin/.codex/worktrees/12f2/TradeReview/docs/design-system/start-design-preview.sh"
```

地址：http://127.0.0.1:3090/design-system/baselines/2026-10-22-homepage-v2.5/visual-spec.html

服务从仓库 docs 根目录提供页面，因此版本间链接可以直接打开。`PORT` 可覆盖默认3090；服务不连接业务数据库。

## 来源与评论

正文：`source/visual-design.candidate.md`。图稿：`source/images/`。重建见 `build-command.txt`。公共组件统一引用 V2.5 第九章及 `V2.5/source/component-manual.html`，不另写一份默认规格。

当前服务的评论权威存储为 `docs/design-system/reviews/SITE-HOME-V25.json`，版本身份为 `SITE-HOME-V25`。本包的 `comments-snapshot.json` 为无服务时只读回退；提交新增评论时应同步该快照。V2.4.2 保留原评论身份，新拆分的两份文档使用独立身份，不误挂历史定位。原评论完整冻结于 `review-records/comments-at-split.json`，包括状态、回复与历史；它不因拆分自动关闭。

[版本拆分与验收记录](../../iterations/2026-10-22-design-doc-split/README.md)。文件均在仓库内，可以通过 Git 提交与追踪；本轮没有推送远端。

## 图稿归属

`source/images/` 保留拆分时的完整图稿副本，便于追溯和相对路径引用；目录存在不代表全部属于本模块。本版本正文与 `document-manifest.json` 中实际引用的图稿构成公共规范与首页设计范围。公共图稿及规范由 V2.5 维护，首页专属图稿由 V2.5 首页章节引用，交易库专属图稿由交易库 V1.0 引用；未引用的保留副本不新增页面或组件要求。

## 首页入口修订（2026-10-22）

按用户确认，V2.5 首页统一使用普通“交易库”入口，取消独立“待复盘”入口及数量徽章。待复盘保留为交易库内部显式筛选；日期、标的交接与返回上下文保持。历史图稿与评论不删除。详见[修订与验收记录](../../iterations/2026-10-22-homepage-library-entry/README.md)。
