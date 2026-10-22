# 首页图文阅读器构建记录

状态：全量正文已构建；视觉签署由 root 独立完成。

## 输入与构建

- 规范：VDF-002 2.0；桌面目录参考 248px、窄窗顶部目录，正文 16px/1.8，专题标题 24px。
- 输入：`visual-design.md`，包含 HP01–HP10 全量正文与两个 state-demo。
- 构建：

  ```sh
  python3 docs/design-system/baselines/2026-10-15-homepage-v1.0/build-visual-spec.py \
    --source docs/design-system/baselines/2026-10-15-homepage-v1.0/visual-design.md \
    --output-dir docs/design-system/baselines/2026-10-15-homepage-v1.0
  ```

- 生成：`visual-spec.html`、`document-manifest.json`、`document-identity.json`，以及五张可返回正文的 HTML 附页。
- 文档身份：`HOME-DOC` / `1.0`；全量 manifest 登记 239 个文字块、17 个图片 occurrence，图片均有 SHA-256 指纹；两个分镜标题分别为 `state-demo-1-title` 与 `state-demo-2-title`。

## 接口边界

生成器接受 `--source <path> --output-dir <dir>`，默认产物名保持策略台阅读器约定。Markdown 支持标题、段落、三列表格、图片、details 和 `:::state-demo`。state-demo 每行格式为：

```text
图片相对路径|状态标题|中文说明
```

生成上一步、下一步、播放、暂停、重播按钮，并支持左右键、Escape、焦点和 `prefers-reduced-motion`。它仅切换截图状态，不操作产品；分镜文案标注“截图状态对照 · 文档演示”。

评论服务复制 f922 `tools/document_review`，只写启动时传入的 `--comments-dir`。本票使用隔离目录 `/tmp/tradereview-homepage-comments`，未访问业务数据库；旧策略台评论和 BT 身份未复制。

## 验证

- `PYTHONPYCACHEPREFIX=/tmp/tradereview-pycache python3 -m py_compile tools/document_review/server.py tools/document_review/test_server.py`：通过。
- `node --check docs/design-system/baselines/2026-10-15-homepage-v1.0/review-client.js`：通过。
- `PYTHONPYCACHEPREFIX=/tmp/tradereview-pycache python3 -m unittest tools.document_review.test_server`：23/23 通过。
- 之前的隔离服务预览：`http://127.0.0.1:3073/design-system/baselines/2026-10-15-homepage-v1.0/visual-spec.html`；本次按 root 要求未重启服务。

浏览器桌面/窄窗视觉签署与代表内容是否扩展，由 root 按本票依赖独立检查；本记录不替代整页视觉验收，也不宣称产品 UI 或数据库验收通过。
