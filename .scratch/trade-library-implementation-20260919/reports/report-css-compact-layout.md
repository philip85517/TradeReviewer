# 交易库紧凑布局 CSS 报告

日期：2026-09-19\
范围：仅 `app/globals.css` 的 `.trade-library` 作用域。

## 调整

- `min-width: 1060px` 时收紧交易库外层 padding、标题区高度和控件间距。
- 将共享筛选区改为 CSS grid：视图 tabs、交易性质、市场、搜索、复盘状态、开始复盘、重置筛选和高级筛选保持在一行；桌面隐藏已有表头排序对应的排序 select，`1060px` 以下保留该 select。
- FX strip 增加紧凑的一行布局，保留人民币折算标题、日期/快照状态和“汇率设置”触发器；详情面板在 details 展开时定位在 strip 下方，不占首屏常态高度。
- 缩短股票列表与筛选区之间的间距。
- `max-width: 759px` 下保留原有两列/整行响应式筛选布局，并让 FX 详情面板适应窄屏宽度。

未修改 TSX、股票组件、汇总组件或其他页面选择器。

## 验证

```text
node --input-type=module -e 'import fs from "node:fs"; import postcss from "postcss"; postcss.parse(fs.readFileSync("app/globals.css", "utf8")); console.log("parsed app/globals.css")'
parsed app/globals.css

git diff --check -- app/globals.css
exit 0
```

实际 1280×720 浏览器截图由协调者复核；本次未启动服务或修改数据库。
