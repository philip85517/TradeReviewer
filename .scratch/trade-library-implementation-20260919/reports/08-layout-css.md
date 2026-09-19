# Ticket 08 — 交易库布局 CSS

状态：布局样式切片完成，等待协调者在真实浏览器中做桌面/窄屏独立验收。

## 范围与契约

只修改了 `app/globals.css`，新增规则全部以 `.trade-library` 为根作用域；没有修改任何 TSX、`library-stock-rounds.module.css`、summary module CSS 或其他页面样式。

样式消费当前 UI owner 已提供的 classnames：

- `.library-header` / `.library-header-actions`
- `.library-shared-browse-controls`
- `.library-view-tabs`
- `.library-shared-search`
- `.library-active-filter-chips` / `.library-filter-chip`
- `.library-stock-head` / `.library-stock-row`

## 交付行为

- 交易库标题、计数徽章和说明保持紧凑，并让股票/回合 tab 在同一控制面板中有清晰的选中态。
- 性质、市场、搜索、复盘状态、排序和操作按钮使用统一的深色控件、边框、间距与 focus 可见样式；控制面板采用 flex-wrap，避免固定宽度挤压输入。
- 已应用筛选显示为可换行的胶囊 chips，移除按钮保持可点击尺寸和 hover 态。
- 股票表头和行的间距收紧；若表头使用排序 button，会获得与暗色表格一致的紧凑 hover/pressed 样式。
- `max-width: 759px` 时 tab 占满一行，搜索单独换行，其他 select 与操作按钮以两列/可换行布局保持可达；chip 文本限制在视口内。
- 所有颜色复用现有 `--page`、`--surface`、`--surface-soft`、`--line`、`--text`、`--muted`、`--faint`、`--blue` 和 `--blue-soft` 设计变量，避免影响其他页面。

## 验证

未为低风险 CSS 单独增加测试，按任务要求不启动服务、不使用浏览器、不运行全量测试。已运行：

```bash
git diff --check -- app/globals.css
# exit 0
```

协调者需在最终集成后的真实页面验证 desktop 与窄屏宽度、tab/筛选操作可达性、chips 删除按钮和股票表头排序按钮；本切片没有声明浏览器验收完成。

没有 commit、push、merge 或数据库写入。
