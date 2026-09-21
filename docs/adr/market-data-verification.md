# 行情模块图形验证记录

日期：2026-09-21。代码基线：`07f86b8e4d4703f4f5cd171e1a7d9a37aa374de4`。本次仅新增文档与图形，未读写交易数据库，未调用外部行情。

## market-data-flow

- 类型：`sequence`
- [交互图](market-data-flow.html) · [规格](market-data-flow.json) · [交付回执](market-data-flow.delivery.json) · [浏览器回执](market-data-flow.visual-check.json) · [截图](market-data-flow.visual-check.html)
- `validation: 9/9 showcase, 0 errors, 0 warnings`
- `specification_sha256: 87d536e48cb83a5b78f9b41467286185d43217523750ff993219e8c6bbe47a4a`（3936 bytes）
- `artifact_sha256: 960d89e3d59dc72842f21285fb9e0db7303d4030221ee30805b0dddd617963a1`（808735 bytes）
- `browser_evidence: passed`
- `visual_review: passed`
- `correction_rounds: 2`

## market-provider-interaction

- 类型：`sequence`
- [交互图](market-provider-interaction.html) · [规格](market-provider-interaction.json) · [交付回执](market-provider-interaction.delivery.json) · [浏览器回执](market-provider-interaction.visual-check.json) · [截图](market-provider-interaction.visual-check.html)
- `validation: 9/9 showcase, 0 errors, 0 warnings`
- `specification_sha256: 02d58f7ef705f780cf2e486da6c2816718fcb16084ec3e1a346f253d7917c4c6`（4330 bytes）
- `artifact_sha256: 39d4c55cb98f73c6d805ece640777d0eb5a347300896cac6153de3e22b518db2`（807671 bytes）
- `browser_evidence: passed`
- `visual_review: passed`
- `correction_rounds: 1`

## 独立验收范围

两个 HTML 均由 Archify deliver 交付后运行 visual-check，Chrome 在 1440×900、1600×1000、1920×1080、2048×1320 检查页面包含性，无横向或纵向溢出，并生成两端尺寸的深浅主题截图。初版时间轴过高导致页面溢出；压紧消息间隔并合并“提交后重读”两步后重新验证。整体图另补全 TCP 传输标注，再次交付和验收。

协调者检查 2048×1320 浅色与 1440×900 深色截图，复核标签、连线和整体阅读布局；最终整体图改字后重新复核截图。自动回执中的 `visualReview: pending` 不代表人工视觉结论，本文单独记录实际观察。图例、时序消息及来源使用说明可读，未对全部导出格式作功能验收。

内置浏览器已打开两个最终预览 URL 并核对标题和正文。总体图中的“完整命中”和“缺口/强刷”是替代路径；缓存完整命中会跳过外部调用。来源图上下两段是两类请求策略，不是同一请求先日线后盘中。图中“当前/后续来源”指候选序位，实际顺序见图底部及[说明](0002-market-data-flow.md)。

## 预览与复现

静态预览服务绑定回环地址，仅提供 docs/adr，无业务数据库连接；交付时保持运行。

- [整体调用图](http://127.0.0.1:8765/market-data-flow.html)
- [数据源交互图](http://127.0.0.1:8765/market-provider-interaction.html)

在项目根目录启动或重启（先确认端口空闲）：

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/adr
```

服务停止后 URL 不可用；也可直接打开独立 HTML。项目交付流程见[development-workflow.md](../agents/development-workflow.md)。

设 `ARCHIFY_DIR` 为本机 Archify skill 目录，可按同样命令对两个 JSON 分别重建（替换下面的文件名）：

```bash
node "$ARCHIFY_DIR/bin/archify.mjs" validate sequence docs/adr/market-data-flow.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver sequence docs/adr/market-data-flow.json docs/adr/market-data-flow.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check docs/adr/market-data-flow.html --json
```

重新生成后需更新交付回执与本记录哈希，并检查新截图。本次未改应用行为，因此未运行应用单测、类型检查或构建；没有验证外部来源在线可用性。
