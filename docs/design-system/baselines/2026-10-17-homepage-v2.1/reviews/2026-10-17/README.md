# 首页 V2.1 用户评审归档 · 2026-10-17

用户本轮称 V2 review；实际评审文档为 HOME-DOC-V21 / 2.1。归档 revision 27，共 27 条意见（22 条图片、5 条文字），全部仍为 pending-review。原始 JSON 保留作者、时间、定位、回复、状态及操作记录；COMMENTS.md 可在 GitHub 直接阅读。归档不表示意见已修复。

对应正文与图片位于本目录上两级，随同一 Git 提交保存。原有 V2/V2.1 校验清单未改写。不要在冻结稿上重建；后续设计另建版本，并引用完整 comment ID 跟踪。

## 恢复评论

克隆并切换至归档提交，在仓库根目录运行：

```sh
review_restore_dir=$(mktemp -d /tmp/tradereview-v21-review.XXXXXX)
cp docs/design-system/baselines/2026-10-17-homepage-v2.1/reviews/2026-10-17/HOME-DOC-V21.json "$review_restore_dir/HOME-DOC-V21.json"
python3 tools/document_review/server.py --port 3079 --comments-dir "$review_restore_dir" --docs-root docs
```

打开 http://127.0.0.1:3079/design-system/baselines/2026-10-17-homepage-v2.1/visual-spec.html 点击评论。临时目录避免修改冻结 JSON；继续评审需备份该目录。直接打开 HTML 不会自动载入评论，可离线阅读 COMMENTS.md。

## 核对

原始 JSON 与日常存储逐字节一致；27 条正文均存在于 Markdown；所有评论文档指纹与 manifest 一致；全部图片指纹匹配；复制到独立目录后通过 ReviewStore 读取，完整记录相等。V2 的 81 项和 V2.1 的 124 项既有文件校验通过。本轮只归档资料，不涉及产品界面或数据库修改。
