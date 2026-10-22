# 首页视觉与交互设计规范 V2.4

这是本轮累计修订的设计文档。正文、图稿和
manifest 对应 `HOME-DOC-V23` V2.4；可继续添加评论，评论保存于
`reviews/HOME-DOC-V23.json`，至少保留 revision 27 的全部 27 条原评论；若
源评论已有新增条目，也会一并保留，不会截断。

## 启动预览

从任意工作目录执行：

```sh
"/Users/zhoulin/.codex/worktrees/12f2/TradeReview/docs/design-system/baselines/2026-10-19-homepage-v2.4/start-preview.sh"
```

脚本固定使用 loopback `127.0.0.1:3085`，也可通过 `PORT=3085` 显式覆盖端口。
它显式传入最终基线目录作为 `--docs-root`、最终基线的 `reviews/` 目录和最终
`document-manifest.json`，因此预览地址为
`http://127.0.0.1:3085/visual-spec.html`。评论写入最终 `reviews/`，停止服务前应备份该目录；
提交或归档前同时备份 `HOME-DOC-V23.json`、`comments-snapshot.json`、
`comment-migration.json` 和 `.source.json`。

## 评论与历史资料

`reviews/HOME-DOC-V23.json` 是当前 V2.4 交付使用的本轮评论存储，包含
revision 27 的全部原评论，并保留源文件中可能存在的新增评论。`reviews/comments-snapshot.json` 和
`reviews/comment-migration.json` 是本轮只读快照与迁移记录；
`reviews/2026-10-18-source/` 保留旧版本评论归档。旧评论的图像映射使用
历史原图和语义 occurrence，不把新的像素位置伪称为旧评论的精确像素锚点。

历史资料仅用于追溯，不替代本轮 27 条评论，也不自动改变评论状态。

## 未决项

D18 持仓汇总 A/B/C 仍待视觉选择；O02 紧凑徽章 24/20 仍待确认，保留原 24px 默认。两项不改变已批准的默认布局。

V2.2 的 21 条旧评论通过历史只读归档与评论原图回溯；当前评论面板用于 V2.4 的 27 条原评论及后续新增。历史正文不提供新的评论写入入口。
