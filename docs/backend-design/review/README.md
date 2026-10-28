# 后端设计交互审查稿

权威正文为 `../current-state.md` 与 `../target-design.candidate.md`。`current/` 是实现快照，`target/` 是候选设计；两者使用独立 `documentId`、清单、段落身份表和评论记录。转换为 HTML 不构成设计批准或产品实施授权。

```sh
python3 docs/backend-design/build-review.py
sh docs/backend-design/start-preview.sh
```

默认入口：

- 现状：<http://127.0.0.1:3091/backend-design/review/current/index.html>
- 目标：<http://127.0.0.1:3091/backend-design/review/target/index.html>

本机审查服务复用 `tools/document_review/server.py`，静态根限制为 `docs/`；两个后端 manifest 必须显式注册。它不启动业务应用或连接业务数据库。默认评论仅写到 `docs/backend-design/reviews/`。端口占用会失败，不能自动换端口。

隔离评论验收可以设置 `BACKEND_REVIEW_COMMENTS_DIR=/tmp/<独立目录>`；特定测试端口可显式设置 `BACKEND_REVIEW_PORT`。启动脚本不会重建正文，避免评论引用的版本在测试中被隐式替换。

`review-client.js` 和 `review-client.css` 从 `docs/design-system/baselines/2026-10-22-homepage-v2.5/` 逐字复制，未经修改；选中文字评论、身份、回复、评审、复核和导出沿用该客户端与 `tools/document_review/API.md` 的协议。每份文档的空 `comments-snapshot.json` 只用于服务不可用时的只读降级，不是权威评论存储。

构建器把两稿互链转换为对应阅读器，并把视觉稿原文链接转换为已有视觉阅读器。其他明确引用的仓库文本生成 `evidence/` 下的只读完整 HTML 快照，代码作为转义文本展示。证据页保留原相对路径、行号和 SHA-256，不开放仓库目录或业务数据库。`reference-index.json` 记录原链接、转换路径、来源指纹及请求行号；原文件仍是权威来源。

`document-identity.json` 为持久身份表，必须与稿件一起保留。相同章节、类型与完整可选原文会复用原 ID；改写或删除保留旧 ID 为停用项，新文字取得新 ID，避免原评论静默贴到别的段落。构建不写评论目录，也不修改 Markdown。提交新版、人工定位和独立复核仍遵循既有服务的版本与证据规则。

```sh
python3 docs/backend-design/build-review.py --check-only
```

结构检查覆盖生成页的本地文件与锚点、重复 DOM／评论 ID、manifest 顺序与完整可选文字的一致性。它不代替真实浏览器、评论持久化与独立视觉验收。
