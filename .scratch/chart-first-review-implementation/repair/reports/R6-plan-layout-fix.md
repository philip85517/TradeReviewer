# R6 — E10 计划价格组布局修正

日期：2026-09-26  
实现者：Luna（`gpt-5.6-luna`）  
集成负责人：root

## 范围与依据

- 元素规格：[E10 买入前价格组](../../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)，要求标签在上、计划入场单行、初始止损／止盈目标双列；同时保留精确输入、单位和方向校验。
- 参考画板：[02-chart-workspace.png](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png)。
- 回归画面：[R6-pre-plan-1280.png](R6-pre-plan-1280.png)。修复前计划入场与方向平分一行，计划数量与数量单位平分一行，价格主字段因此变窄。

## 实现

- `app/components/recall/recall-plan-sidebar.tsx`
  - 计划入场改为独占一行；初始止损和止盈目标保留为同一双列价格组。
  - 计划数量改为独占一行；方向与数量单位合并为同一行的紧凑补充控件，避免规模表单额外增加一行。
  - 方向保留可编辑的 `待选择` 空值；方向未知时显示“选择计划方向后可计算风险与盈亏比”，已知方向不常驻机制说明。
  - 沿用既有 `onChange`、精确原始字符串和规模换算语义；没有从成交事实回填方向，也没有加入退出评价。
- `app/components/recall/recall.css`
  - 仅新增计划字段局部规则：主字段一列、价格双列、补充控件约 112px；现有字段字体 14px、桌面最小高度 36px、窄屏最小高度 44px 规则继续生效。
- `app/components/recall/recall-plan-sidebar.test.tsx`
  - 新增 E10 结构与未知方向行为断言，锁定入场／数量主字段、止损／目标双列、方向／单位同一紧凑补充行及方向仅由显式输入改变。

## 验证

- Red：新增 E10 测试首次运行失败，因主字段和紧凑控件结构尚不存在。
- Green：`npm run test:unit -- --run app/components/recall/recall-plan-sidebar.test.tsx`，11 tests passed。
- Lint：`npm exec -- eslint app/components/recall/recall-plan-sidebar.tsx app/components/recall/recall-plan-sidebar.test.tsx`，通过。
- 类型：`npm run typecheck`，通过。
- 按任务边界未运行 build、full suite 或浏览器，也未写入业务数据库；未修改 More 末尾规则或共享业务数据。

## 状态

R6 E10 计划表单布局修正已冻结，等待 root/Astra 的独立视觉与集成复核。定向自动化、lint 和类型检查均通过；1280px／窄屏真实浏览器视觉仍由集成负责人按批准画板复核。
