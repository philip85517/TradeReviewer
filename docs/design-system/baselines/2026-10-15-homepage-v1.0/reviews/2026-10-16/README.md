# 首页完整评审归档

2026-10-16 用户完成首页文档评论后冻结。文档为 HOME-DOC 1.0，产品参考基线为 7a5d137d；本目录保存原始评论存储，revision 39，共 39 条评论，其中 15 条图片评论、24 条文字评论。评论原文、身份、时间、定位、状态及操作记录全部保留。评论尚待后续拆解与处理，归档不表示意见已实施。

## 恢复阅读和评论

在克隆本仓库并切换至此归档提交后，从仓库根目录执行以下命令。新建临时评论目录，避免覆盖任何现有评论，也避免后续操作改写 Git 中的冻结快照。

```sh
review_restore_dir=$(mktemp -d /tmp/tradereview-home-review.XXXXXX)
cp docs/design-system/baselines/2026-10-15-homepage-v1.0/reviews/2026-10-16/HOME-DOC.json "$review_restore_dir/HOME-DOC.json"
python3 tools/document_review/server.py --port 3079 --comments-dir "$review_restore_dir" --docs-root docs
```

打开 http://127.0.0.1:3079/design-system/baselines/2026-10-15-homepage-v1.0/visual-spec.html ，点击“评论”查看原文及定位。恢复服务需 Python 3；不需要业务数据库。该临时目录适合回溯阅读；需要长期继续评审时，应将其另行备份至持久目录并在启动时指定。

当前工作树日常入口仍使用 3078 端口及 `.data/document-reviews/homepage`。冻结 JSON 不随日常评论变化。只打开 HTML 不会加载评论，必须使用上述服务；也可直接阅读本目录 COMMENTS.md。

## 完整性与后续迭代

SHA256SUMS.json 保存本版文档、图片、阅读器、服务及评论 JSON 的 SHA-256。COMMENTS.md 是由原始评论派生的可直接阅读版本；HOME-DOC.json 是恢复权威文件，不能用页面导出的公开 JSON 替换。

未来修订应建立新版本目录，保留本版正文、图片、document-manifest.json、document-identity.json 和评论快照。拆票时引用评论 ID、章节、文字选区或图片 ID，记录采纳决定、任务路径、实现证据及复核结果；不能把已冻结意见改写成后续结论。新的评审记录应另存快照。

本次范围为文档和评审资料归档，不涉及产品功能、业务数据库、远端主分支合并。
