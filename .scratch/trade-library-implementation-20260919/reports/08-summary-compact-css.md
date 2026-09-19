# Ticket 08 — 绩效汇总紧凑布局 CSS

状态：summary CSS 切片完成，等待协调者在最终集成页面做真实浏览器验收。

## 范围

只修改了 `app/components/library/library-performance-summary.module.css`，没有修改 summary TSX、globals.css、其他组件 CSS 或数据计算模块。

## 布局行为

- `.summary` 在桌面使用两列网格；header、scopeLine、四张主卡和 notice 跨两列。
- 两个默认折叠 `.disclosure` 各占一列；展开的 disclosure 跨两列，详情内容仍按自身网格显示。
- 主卡保留四列，卡片最小高度约 88px；缩小卡片内外 padding、gap、标题层级和重复说明的视觉权重，保留全部文本信息。
- scopeLine 去掉独立面板背景和边框，改为较弱的文字层级；header 保留标题、范围说明和统计范围控件。
- `max-width: 900px` 时 summary 变为单列，主卡和详情内部先保持两列；`max-width: 560px` 时主卡、详情和原币行变为单列，select 与长文本可读。
- 颜色继续使用模块已有的暗色 CSS 变量和 fallback。

## 验证

按任务要求未新增测试、未启动服务、未使用浏览器、未运行全量套件。已执行：

```bash
node --input-type=module -e 'import fs from "node:fs"; import postcss from "postcss"; postcss.parse(fs.readFileSync("app/components/library/library-performance-summary.module.css", "utf8")); console.log("postcss parse ok");'
# postcss parse ok

git diff --no-index --check /dev/null app/components/library/library-performance-summary.module.css
# 无 whitespace 输出；命令因 untracked 文件返回预期 exit 1
```

Root 仍需在最终 1280×720 与窄屏页面检查 summary 首屏占用、四列主卡可读性、两个折叠详情的同排布局，以及展开/滚动后的信息可达性。

没有 commit、push、merge 或数据库写入。
