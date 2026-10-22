# 本机文档评论服务 API（2.1 阶段二）

服务只绑定 loopback，不连接 TradeReview 业务数据库；唯一可写位置是启动时显式传入的 `--comments-dir`。静态文档根由 `--docs-root` 指定，默认是项目 `docs/`。

```sh
python3 tools/document_review/server.py \
  --port 3072 \
  --comments-dir /tmp/tradereview-document-review-<唯一值>
```

服务只接受 reader-ui 已生成并注册的 `document-manifest.json`。正常运行扫描 `docs/design-system/baselines/**/document-manifest.json`，测试可额外传 `--manifest`。客户端不能用任意版本、指纹、正文或新块伪造版本。

## 注册清单

`GET /api/documents?documentId=BT-DOC` 返回已注册版本及其 `blocks` / `images`，供 UI 选择版本；不带 `documentId` 时返回所有注册清单。返回的 `documentUrl` 保留清单原字段；当该 URL 从受信 manifest 所在目录解析到 docs-root 内的实际文件时，额外返回 `resolvedDocumentUrl`（以 `/` 开头），供静态服务安全加载。

```json
{
  "documentId": "BT-DOC",
  "version": "2.1",
  "fingerprint": "sha256:…",
  "sourceFile": "…",
  "documentUrl": "visual-spec.html",
  "resolvedDocumentUrl": "/design-system/baselines/…/visual-spec.html",
  "blocks": [{"id": "BT02-intro", "chapter": "BT02", "text": "…", "sourceLine": 12}],
  "images": [{"id": "BT-PLATE04", "occurrenceId": "BT-PLATE04@102", "src": "images/…", "fingerprint": "sha256:…", "chapter": "BT04"}]
}
```

图片 `id` 可以重复；唯一身份始终是 `(id, occurrenceId, chapter)`。服务拒绝 docs-root 外的 manifest symlink，也拒绝未注册的版本/指纹。

## 请求封装与并发

所有写请求 `POST /api/review` 使用以下封装：

```json
{
  "operationId": "client-operation-uuid",
  "expectedRevision": 0,
  "documentId": "BT-DOC",
  "commentId": "comment-…",
  "action": "…",
  "actor": {"name": "姓名", "role": "评论者|评审者|实施者|复核者"},
  "payload": {}
}
```

`create` 不带 `commentId`；其他动作必须带已有 `commentId`。`operationId` 是幂等键：同一成功操作重试返回原快照；新操作即使文案相同也按新操作处理。`expectedRevision` 不匹配返回 HTTP 409 和最新快照；验证失败或文件写失败不增加 revision、不登记 operation、不污染文件。请求体上限为 1 MiB，带 `Origin` 的写请求必须同源。

## 创建评论

`action: "create"` 的 `payload`：

```json
{
  "version": "2.1",
  "fingerprint": "sha256:…",
  "segments": [{"blockId": "BT02-intro", "chapter": "BT02", "quote": "清单中的连续选区", "before": "选区紧邻前文后缀", "after": "选区紧邻后文前缀"}],
  "image": {"id": "BT-PLATE04", "occurrenceId": "BT-PLATE04@102", "chapter": "BT04", "src": "images/…", "fingerprint": "sha256:…"},
  "opinion": "请补充说明"
}
```

`segments` 至少有一个文字段，或提供一张清单图片。`quote` 必须是指定 block 的原文连续子串；`before` / `after` 必须是实际相邻上下文，重复子串必须由上下文唯一定位。多个 segment 必须遵循 manifest block 顺序，可跨章节。原始 `quote`、上下文、版本、图片 occurrence 和意见会冻结写入评论。

## 评审、回复和重开

### `action: "review"`

只允许 `pending-review`：

```json
{"decision":"adopt","reason":"采纳理由","tasks":[{"taskRef":"/repo/.scratch/issues/42.md","owner":"实施者"}]}
```

`decision` 为 `adopt`、`clarify` 或 `defer`。`adopt` 至少一个任务，状态变为 `pending-change`；另两者不接受任务，分别变为 `pending-clarification`、`deferred`。每个 `taskRef` 必须是可信项目根或 docs-root 内实际存在的 `.md` 文件，不能指向任意外部路径。

### `action: "reply"`

```json
{"body":"补充上下文"}
```

回复追加到 `replies` 并写历史，不能隐式改变状态或触发重开。

### `action: "reopen"`

```json
{"reason":"发现回归，需要重新评审"}
```

仅 `pending-clarification`、`deferred`、`pending-location` 或 `resolved` 可显式重开，状态回到 `pending-review`，历史和旧复核全部保留。

## 提交版本和定位

### `action: "submitRevision"`

只允许 `pending-change`：

```json
{
  "targetVersion":"2.2",
  "targetFingerprint":"sha256:…",
  "tasks":[{"taskRef":"/repo/.scratch/issues/42.md","owner":"实施者","completed":true,"accepted":true,"evidence":[{"path":"/repo/.scratch/evidence/42.md","summary":"实际验收证据"}]}]
}
```

目标版本/指纹必须来自注册清单，且不能与评论原始版本/指纹完全相同；提交任务必须与评审任务逐项匹配，且全部 `completed`、`accepted` 并有可信本地文件 evidence。一个评论可关联多个任务；多个评论可共享同一 `taskRef`。同一 block ID、quote、before、after 在目标清单中唯一匹配时自动生成 `method: "automatic"` anchor；每个 segment 和图片 occurrence 都单独记录。自动锚点全部确认时状态为 `pending-verification`，改写、删除、歧义或图片 occurrence 不匹配时为 `pending-location`。旧 `quote` 永远不改。revision 的 `initialAnchors` 是提交时的自动定位快照并保留在历史中；`anchors` 是当前最终映射，人工 `mapAnchor` 后会更新它。

### `action: "mapAnchor"`

只允许 `pending-location`，并携带 `targetVersion`、`targetFingerprint`、`oldBlockId`、`reason`、本地 `evidence`：

```json
{"targetVersion":"2.2","targetFingerprint":"sha256:…","decision":"map","oldBlockId":"BT06-duplicate","newBlockId":"BT06-new","newText":"清单中的完整新块","reason":"确认改写对应关系","evidence":[{"path":"/repo/.scratch/evidence/map.md","summary":"人工定位证据"}]}
```

`map` 的 `newBlockId` / `newText` 必须精确匹配目标注册清单；图片 anchor 使用 `oldOccurrenceId`，映射时提交完整 `newImage`（按 `(id, occurrenceId, chapter)` 精确匹配），删除时必须确认旧 occurrence 在目标清单中确实不存在。文字 `delete` 也只有在目标清单中确实不存在旧 quote、且有 reason/evidence 才能确认。所有 anchor 确认后才进入 `pending-verification`；失败不修改旧引用。

## 复核

### `action: "verify"`

只允许 `pending-verification`：

```json
{"decision":"resolve","reason":"已按新版本和证据核对","evidence":[{"path":"/repo/.scratch/evidence/review.md","summary":"独立复核证据"}]}
```

`decision: "resolve"` 变为 `resolved`；`decision: "return"` 必须提供 `returnTo: "pending-change" | "pending-clarification"`，并带理由，回退而不删除历史。复核者姓名不能等于本次 revision 的任务 owner 或提交者姓名；角色字段只是本机声明，不是认证。未完成定位确认、任务确认或状态前置检查时不能 verify。

## 读取、导出与记录形状

`GET /api/review?documentId=BT-DOC` 和 `GET /api/export?documentId=BT-DOC&format=json` 返回同一权威快照。评论包含 `history`、`replies`、`tasks`、`revisions`、`anchors`；revision 保存目标版本、任务、提交者、不可变的 `initialAnchors` 自动快照和当前最终 `anchors`。Markdown 导出由同一快照生成，包含状态、原文、意见、回复、任务、版本和历史摘要，不是第二份状态源。

`GET /api/export` 的 `format=json` 与 `format=markdown` 响应均带 `Content-Disposition: attachment`，便于浏览器实际下载；文件名由已通过安全校验的 `documentId` 派生，分别为 `BT-DOC.json` 和 `BT-DOC.md`（ASCII 文件名，UTF-8 内容）。响应的 `Content-Type` 分别为 `application/json; charset=utf-8` 与 `text/markdown; charset=utf-8`。

记录写在 `<comments-dir>/<documentId>.json`，使用同目录临时文件、flush/fsync 和原子替换。静态 URL 限定在 docs-root 内，路径穿越和根外 symlink 拒绝。服务不会读取或写入业务 DB。
