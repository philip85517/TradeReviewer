# 首页视觉与交互规范 v1.0

基于实际 master `7a5d137d`，其它 worktree 与历史记录用于解释需求沿革。正文分10章，独立问题评估见 assessment.md。

阅读入口：http://127.0.0.1:3078/design-system/baselines/2026-10-15-homepage-v1.0/visual-spec.html

## 启动

从仓库根目录运行：

```sh
python3 tools/document_review/server.py --port 3078 --comments-dir .data/document-reviews/homepage --docs-root docs
```

只监听本机。评论存于 `.data/document-reviews/homepage/HOME-DOC.json`，重启须沿用该目录。测试评论位于另一临时目录，不进入正式阅读入口。不要删除评论目录；它不会自动同步到云端。

## 阅读与评论

左侧目录跳转章节；图片可点开原图；分镜按钮仅切换截图。选中正文后点击顶部“评论”，或点击“评论这张图”；填写姓名与意见并保存，可继续添加。正式入口初始为空评论。评审包可导出JSON/Markdown。

## 维护

完整评论已于 2026-10-16 冻结归档（39 条，revision 39）。未来克隆仓库后，按 [评审归档与恢复说明](reviews/2026-10-16/README.md) 启动即可查看该版本的评论；原始 JSON 与便于 Git 阅读的 COMMENTS.md 一并保留。

正文来源 `visual-design.md`，规则 `rules.md`，独立评估 `assessment.md`，出处 `sources.md`。修改后运行：

```sh
python3 docs/design-system/baselines/2026-10-15-homepage-v1.0/build-visual-spec.py
```

保留 document-identity.json，以保持文本评论锚点。证据在 evidence/。产品未验证的流程与文档阅读器验收分别记录，不以文档完成代表首页全功能通过。
