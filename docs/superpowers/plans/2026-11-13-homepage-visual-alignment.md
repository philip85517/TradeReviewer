# 首页视觉对齐与市场切换防闪

> 使用 executing-plans，由用户指定当前主模型实施；不另建实施子代理。此方案落实已授权修正，独立审查在末尾进行。

**目标**：修复设计差异D01–D06，以及正常快速市场切换的等待提示闪现。
**规格**：docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md；精确需求/元素/图见 .scratch/code-reuse-value-20261113/frontend-mock/DESIGN-COVERAGE.md 当前实施节。
**边界**：仅Mock前端；保留工作树现有修改；不改业务库、不发布。

1. 在 homepage-preview.test.tsx 用可控真实展示请求复现快速闪现；覆盖慢请求、替换、取消和错误。use-homepage-preview.ts 的真实 pending 继续立即生效；单独 showPending 延后250ms，每次新请求重置，取消/完成/卸载清理。homepage-preview.tsx 的卡片/状态条使用展示等待状态。
2. period-selector.tsx/css 恢复入口锚定及标题20px间距；homepage-preview.tsx/css 修市场色、账户箭头、期间对齐；holdings.tsx/css 修标题工具栏、原币标识、标的/数量/查看列、详情图标。控件和数据流owner均root。原币单价不做汇率重算，报告金额维持既有合同。
3. 运行组件回归、全量单测、typecheck、相关lint及项目npm test；真实浏览器双桌面与响应断点、日期展开/错误、四市场、快速/慢速/取消/失败和详情返回截图与几何。非实施reviewer直接对参考图和最终图；记录范围与版本，旧NV仍保留。

**Review Focus**：连续请求计时器泄漏/旧提示、取消和失败丢失反馈、单价币种误导、窄屏越界、长值密度、日期入口与面板关系、详情返回焦点。不得以测试替代视觉对图。
