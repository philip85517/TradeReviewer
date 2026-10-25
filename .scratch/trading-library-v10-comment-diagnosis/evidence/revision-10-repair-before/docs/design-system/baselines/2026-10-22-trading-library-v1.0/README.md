# 交易库视觉设计方案 V1.0

[完整可评论文档](visual-spec.html) · [拆分时全部43条评论与归属](review-records/split-comments.html)

本版本依据当前 V2.4.1 的累计确认内容整理。V2.4.2 冻结拆分前内容；V2.5 为全站公共标准与首页完整设计；交易库 V1.0 承接内部设计。拆分不改变已确认图稿和产品行为。

## 启动预览

从当前仓库根目录运行：

```sh
./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh
```

地址：http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/visual-spec.html

服务从仓库 docs 根目录提供页面，因此版本间链接可以直接打开。`PORT` 可覆盖默认3090；服务不连接业务数据库。

## 来源与评论

正文：`source/visual-design.candidate.md`。图稿：`source/images/`。重建见 `build-command.txt`。公共组件统一引用 V2.5 第九章及 `V2.5/source/component-manual.html`，不另写一份默认规格。

当前服务的评论权威存储为 `docs/design-system/reviews/TRADING-LIBRARY-V10.json`，版本身份为 `TRADING-LIBRARY-V10`。本包的 `comments-snapshot.json` 为无服务时只读回退；提交新增评论时应同步该快照。V2.4.2 保留原评论身份，新拆分的两份文档使用独立身份，不误挂历史定位。原评论完整冻结于 `review-records/comments-at-split.json`，包括状态、回复与历史；它不因拆分自动关闭。

[版本拆分与验收记录](../../iterations/2026-10-22-design-doc-split/README.md)。文件均在仓库内，可以通过 Git 提交与追踪；本轮没有推送远端。

## 图稿归属

`source/images/` 保留拆分时的完整图稿副本，便于追溯和相对路径引用；目录存在不代表全部属于本模块。本版本正文与 `document-manifest.json` 中实际引用的图稿构成交易库设计范围。公共图稿及规范由 V2.5 维护，首页专属图稿由 V2.5 首页章节引用，交易库专属图稿由交易库 V1.0 引用；未引用的保留副本不新增页面或组件要求。

## 首页入口修订（2026-10-22）

按用户确认，V2.5 首页统一使用普通“交易库”入口，取消独立“待复盘”入口及数量徽章。待复盘保留为交易库内部显式筛选；日期、标的交接与返回上下文保持。历史图稿与评论不删除。详见[修订与验收记录](../../iterations/2026-10-22-homepage-library-entry/README.md)。

## 行文修订（2026-10-23）

依据当前两条评论，开篇先说明文档用途，再用表格列出规范引用；第一章按总目标、三个分目标、设计取舍和范围边界展开。其余章节按各自主题拆分说明，将参数、日期口径、返回字段和异常状态整理为查阅表，历史与未决项集中到第十章。

原有设计规则与分镜保留。`comment-migration.json` 将两条评论关联到修订后的对应段落，原引用、意见、状态和历史保持；`comments-snapshot.json` 同步当前评论服务的第2版数据。

## 评论驱动的静态设计修复（2026-10-24）

依据新增4条图稿评论，补齐全局宿主与公共工具栏、统一实盘/模拟盘切换、建立一致的成交/费用/统计样例，并补全首页、列表、回合集、复盘和逐层返回。当前正文引用40张图、8组分镜；两种普通统计入口分别可发现。开篇与第一章的既有行文修订保留。

独立Agent静态设计复验通过；协调者实测33目录、40分镜与原尺寸图、8组播放/键盘操作、6评论定位及4原图链接，通过后关闭5项诊断问题。[最终验收](../../../../.scratch/trading-library-v10-comment-diagnosis/FINAL-ACCEPTANCE.md)与[独立报告](../../../../.scratch/trading-library-v10-comment-diagnosis/evidence/independent-round-3/REVIEW.md)保存版本和截图。当前source `8aca7949a1b05d56d27a7472115d45b9c25a07013fe3961a03883a2dd3bd1c58`，content `7584f36adeab139fc67a50b5894e7bc9afaf894a73aeb1a10716f6a04f198182`。

共享评论及离线快照为revision 6；原6条意见、状态和历史保持，修订图使用显式整图关联并提供历史原图，不自动解决评论。历史原图保存在 `review-records/2026-10-24-comment-repair/originals/`。本次为静态设计文档修复，不表示业务产品或数据库流程已经实现；未提交、推送或合并。
