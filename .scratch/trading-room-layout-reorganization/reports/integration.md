# 02–04 workspace/CSS 集成报告

## 接线范围

本次只修改 workspace、公共 CSS 和既有 workspace 测试范围，未修改 02–04 代理拥有的组件文件。

- `TradeReviewWorkspace` 新增会话级 `insightsTab` 与 `dataTab` 状态。
- `DataManagement` 接入 `activeTab={dataTab}` 与 `onTabChange={setDataTab}`。
- `openQualityDetails` 及质量检查入口先切换 `dataTab` 为 `quality`，再进入数据管理。
- `TradeLibrary` 去除无数据 guard，空数据时仍挂载，并通过 `onImport` 切换到数据管理的 `import` tab。
- `ReviewSummary` 接入 `activeTab`、`onTabChange`、`onImport`；导入动作同样切换到数据管理 `import` tab。
- `renderScopedInsights` 移除旧 `details` 外壳，直接返回 `PatternInsights`。
- `.module-tabs` 继续保持简单公共 CSS，选中态同时兼容 `aria-pressed="true"` 与 `aria-selected="true"`。
- review page-header 仅在窄屏且存在复盘股票入口时显示，桌面端不再留下空白顶栏。
- 三个模块统一使用 `.module-tabs` 的基础宽度、间距、下边线和选中态；旧 `.library-view-tabs` 样式已清理。
- 模式分析分类新增 workspace 会话状态 `patternCategory`，通过 `Category`、`category` 与 `onCategoryChange` 接入 `PatternInsights`，一级/二级切换不再重置分类。

## 验证与状态

- 未运行全套测试、全量构建或最终 typecheck，遵循协调者集中执行约定。
- 代理组件的新增可选接口尚未在本工作树同步；待 02–04 作者落地后，由协调者集中运行 typecheck 与相关测试。
- 未修改数据模型、路由、数据库或代理拥有的文件。

## 后续交接

组件作者只需实现已约定的可选 props 及各自 tab 内容/语义；workspace 已负责会话保持和跨模块跳转。`role="tab"` 的键盘行为由各模块作者按其组件交互实现，公共 `.module-tabs` 不引入抽象组件。
