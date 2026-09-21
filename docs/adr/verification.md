# 架构文档验证记录

日期：2026-09-21。代码基线：`07f86b8e4d4703f4f5cd171e1a7d9a37aa374de4`。
本次仅整理文档与静态架构图，未启动业务应用、未打开或修改交易数据库，未执行推送或发布。

## 图形交付回执

- 类型：`architecture`；[规格](architecture.json)、[交互图](architecture.html)。
- `validation: 9/9 showcase, 0 errors, 0 warnings`
- `specification_sha256: ce5393a014ace58c677d372bb3f28377e4df459cb8aa3b3c4eb096698f0e8770`（4046 bytes）
- `artifact_sha256: 7ff3aad2c94eaa44584cb3cca687016d0761d65bec08fa859df6c24224df1693`（807585 bytes）
- `browser_evidence: passed`
- `visual_review: passed`
- `correction_rounds: 2`（仅修正两处垂直连接标签位置）

[确定性回执](architecture.delivery.json)绑定规格和 HTML 字节；[浏览器回执](architecture.visual-check.json)是独立证据。浏览器回执的 `visualReview: pending` 是工具固定语义，并不代替下面的人工视觉复核。

## 浏览器与视觉复核

Archify `visual-check` 使用本机 Chrome 测量 1440×900、1600×1000、1920×1080、2048×1320：四种尺寸均无横向或纵向页面溢出，文字可读性及工具栏间隔检查通过。端点尺寸均生成深、浅主题截图，见[截图对照](architecture.visual-check.html)。

协调者使用图像查看工具复核 2048×1320 浅色和 1440×900 深色截图：主路径清楚，无连线交叉、标签遮挡、节点文字溢出或明显底部空带。此视觉判断与自动测量分别记录；未逐项验收查看器的所有导出格式。

本地静态预览地址：<http://127.0.0.1:8765/architecture.html>。已在真实内置浏览器打开，核对标题及边界说明；节点搜索 `SQLite` 返回唯一节点，关闭搜索后恢复默认阅读状态。静态服务仅提供 `docs/adr` 文件，无业务数据库连接。

## 复现与启动

在仓库根目录运行（先确认端口空闲）：

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/adr
```

服务停止后预览链接不可用；独立 HTML 也可直接在浏览器打开。交付时静态服务保持运行。开发交付约定见[项目流程](../agents/development-workflow.md)。

重新生成图形需本机安装 Archify；将 `ARCHIFY_DIR` 指向 Skill 目录后运行：

```bash
node "$ARCHIFY_DIR/bin/archify.mjs" validate architecture docs/adr/architecture.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver architecture docs/adr/architecture.json docs/adr/architecture.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check docs/adr/architecture.html --json
```

重新生成后应更新确定性回执和本记录中的哈希，再复核新截图。此处未运行应用单测、类型检查或构建；本次未修改应用实现，验证范围为文档引用、代码事实、规格/产物一致性与架构图浏览器行为。
