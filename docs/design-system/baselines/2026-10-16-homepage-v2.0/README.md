# 首页视觉规范 V2 · 评审包

这是基于 V1 全部 39 条评论的下一版设计提案，不是已经实施的首页。V1 与其评论保持冻结；V2 文档身份为 `HOME-DOC-V2`，版本 `2.0`，新评论独立保存。

## 阅读入口

- [图文规范与交互分镜](visual-spec.html)
- [验收结果与证据](acceptance.html)
- [正文源文件](visual-design.md)
- [逐条评论跟进复核](comment-review.html)
- [设计来源与借鉴边界](sources.html)
- [V1 原稿](../2026-10-15-homepage-v1.0/visual-spec.html)
- [V1 的39条冻结评论](../2026-10-15-homepage-v1.0/reviews/2026-10-16/COMMENTS.md)

图稿为合成示例，不代表实际账户业绩。点击原尺寸可逐像素核对，分镜按钮仅切换设计帧，不操作产品。历史持仓日期的保留或删除为 D01 待决策，详见正文。

## 本机预览

```bash
cd /Users/zhoulin/.codex/worktrees/12f2/TradeReview && python3 tools/document_review/server.py --port 3078 --comments-dir .data/document-reviews/homepage --docs-root docs
```

若该端口服务已运行，无需重复启动。预览地址：

http://127.0.0.1:3078/design-system/baselines/2026-10-16-homepage-v2.0/visual-spec.html

## 重建

```bash
cd /Users/zhoulin/.codex/worktrees/12f2/TradeReview && python3 docs/design-system/baselines/2026-10-16-homepage-v2.0/build-frames.py
```

```bash
cd /Users/zhoulin/.codex/worktrees/12f2/TradeReview && python3 docs/design-system/baselines/2026-10-16-homepage-v2.0/build-package.py
```

正文、图稿、生成器、manifest、identity 一并保存；更新文档会更新内容指纹。开始正式评论后，应冻结该版本，继续改稿时另建新版本，避免旧意见失去准确上下文。

## 评论保存与回溯

运行上述服务后，V2 评论写入 `.data/document-reviews/homepage/HOME-DOC-V2.json`；该路径被 Git 忽略。网页本身不含后续评论，单纯复制 HTML 或 Git 提交文档不会自动保存新增评论。

完成一轮评审后，将此 JSON 与同一时点的文档、图片、manifest、identity 一并归档至本目录 `reviews/<日期>/`，生成文件校验值，再提交 Git。恢复时将归档 JSON 放到独立评论目录，以 `--comments-dir` 指向该目录启动服务；V1 的完整操作见 [归档说明](../2026-10-15-homepage-v1.0/reviews/2026-10-16/README.md)。不要把 V1 JSON 改名充作 V2 评论。

本轮逐条跟进记录在 comment-review.md/html，属于设计响应；不更改 V1 原评论的作者、原文、状态或时间。未落实项、待决策项与用户排除项分别标记，不能统一宣称已解决。
