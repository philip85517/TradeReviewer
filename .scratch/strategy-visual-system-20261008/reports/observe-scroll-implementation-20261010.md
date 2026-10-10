# 05 滚动修复实现记录

- 任务：`TR-VIS-05`，仅恢复完整 Workbench 预览的原生纵向文档滚动。
- 实现负责人：`scroll_fix_luna`；整页浏览器验收：root；独立审查：`observe_scroll_diagnosis`。
- 时间：2026-10-10（Asia/Shanghai）。
- 允许修改：`app/components/strategy-prototype/full-workbench-preview.css`、本报告。

## 实现

在 `full-workbench-preview.css:1` 增加唯一作用域规则：

```css
body:has(.full-workbench-preview) {
  overflow-y: auto;
}
```

该规则只在完整预览挂载时覆盖全局 `body { overflow: hidden; }` 的纵向值；没有改变 `overflow-x`，也没有改变预览自然高度、图表高度、数据、回放状态或局部菜单/抽屉的滚动规则。离开完整预览后该选择器不匹配，全局 body 策略保持原样。

## 根因与前置证据

本票前置实测证据保留在 `evidence/observe-scroll-20261010/`：

- `before-metrics.json`：1280×720 下 document 高 1051px，body `overflowY: hidden`，预览与运行区均为自然高度/`visible`，没有可承接页面滚动的局部 owner。
- `red-1280-wheel.json`：原生 wheel 前后 `scrollY: 0`，预期失败。
- `red-1060-wheel.json`：1060px 边界原生 wheel 前后 `scrollY: 0`，预期失败。
- `before-1059-wheel.json` 与 `before-390-wheel-after.json`：1059px 和 390px 已有 `body overflowY: auto`，属于必须保持的通过基线。

这符合 `homepage-style-reuse.md:62` 的自然文档滚动要求，并保持 `full-restore-contract.md` 规定的阶段、截止、图型和视野契约。

## 静态验证

- CSS 作用域选择器计数：`body:has(.full-workbench-preview)` 1 处。
- 新增纵向声明：`overflow-y: auto` 1 处（位于该选择器内）。
- 全局样式未改：`app/globals.css` 不在本次允许修改范围，也未编辑。
- 业务/状态/图表/数据文件未改；工作树中其他既有修改保留。
- 实现文件 SHA-256：`9f98afeaf2bc4cc23dcaf5e08f8931f2fac4566f3f8cc5c75767934d592b9e6e`。
- 修改前证据快照 `before-source.css` SHA-256：`a8922b03e0c413b2e4cf9e7c57ab3c7ed38b1da4bbc92138eaee9558113a9570`。
- 未运行全量测试、构建或 lint，避免与协调者浏览器验收争抢；本票变更为单条 CSS 规则。

## 验收状态

- 功能正确性：`NOT VERIFIED`（需 root 在真实浏览器用 1280/1440、1060/1059、390 进行 wheel、End、Home）。
- 端到端行为：`NOT VERIFIED`（需 root 验证完整结果/比较、原版返回、菜单/抽屉局部滚动与 Escape 回焦点）。
- 视觉还原：`NOT VERIFIED`（需 root 与未参与实现的审查者在同状态同视口比较；预期仅恢复页面滚动，不改变首屏几何）。
- 数据库：`NOT APPLICABLE`；完整演示为内存合成预览，本修复不写业务数据库。

## 交接给 root

请在保持服务运行的真实浏览器中复验：桌面 1280×720 与 1060×800 页面 `scrollY` 可由 0 增至 document 底部，1059×800 与 390×844 原有滚动继续通过；End/Home 往返；结果/比较下方内容可达；离开预览后原创建工作区滚动策略不变。浏览器证据完成后再更新本票与最终验收记录。
