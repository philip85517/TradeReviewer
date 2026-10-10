# Workbench 样板实现报告

## 范围与依据

- 实现者：Luna（gpt-5.6-luna，bounded 文件任务）。
- 输入基线：`9c2b3d209a202422c3d5aeab5969a9b093cfda92` 的 `.scratch/strategy-portfolio-backtesting/workbench-design/`，包括 A 工作台 `index.html`、真实 Lightweight Charts 运行时、Geist 字体与许可证。
- 规格：`DESIGN-COVERAGE.md`、`PLAN.md`、`STYLE-04-CONTRACT.md`、IF05/IF06 与 SW/WB/WD 工作区约束；A 保留 54/48/48/48/38/44/44/28/320 几何预算和原有合成数据、回放/事件/结果语义。
- 写入范围：仅 `public/design-system-20261008/workbench/**` 与本报告。

## 交付内容

- 复制 A 样板到 `/design-system-20261008/workbench/`，包含真实 LWC 静态运行时、字体、许可证和 `layout-audit.js`。
- 默认使用 `appearance=recommended`；推荐 token 在 `body[data-appearance="recommended"]` 作用域内覆盖：primary `#2469c8`、hover `#2b72d3`、active `#205bac`、focus `#8cbdff`、必要控件边框 `#58708f`、图标 18px / stroke 1.75，并明确 Geist 后的中文 fallback 顺序；原始 `--blue: #2f80ed` 保留供非 primary 语义使用。
- `?appearance=baseline` 保留复制源 A 的原始 CSS 与同一 fixture、阶段和图表范围；原型工具弹窗提供推荐/baseline 互链，并提供原生复盘入口 `/?prototype=review-design&mode=recommended`。
- 移除可见的 B/C 候选布局控制；A 固定检查区是唯一推荐框架。保留原有实验标题 17/700、图头 14px 和真实图表/数据交互。
- 将推荐状态下的下拉箭头、关闭、收起、实验操作图标改为线性 SVG，避免 Unicode 图标与文字混用；原有文案、盈亏色与价格/日期字段未缩短。
- 推荐模式的 Lightweight Charts `layout` 显式传入同一字体栈与 `fontSize: 12`，baseline 不注入该图表字体覆盖。
- 原型工具中视觉模式标签写为“推荐视觉”和“中文现状基线”，并保留原生复盘入口。
- 推荐控件统一为 `13px / 20px / 500`，选中控件为 `600`；primary 三态仅匹配 `:enabled`，并在推荐作用域末尾明确 primary `:disabled` 外观，避免原 A hover 规则染蓝。
- 推荐模式的日期选择器按当前视图有效上限生成选项：观察到 `m`、结果到 `r`/组合可知边界、组合对比到 `compareCutoff()`，事件投影到 `eventLimit()`；这样共同结果截止在 2024-06-19 时不会继续展示 2025-02-06 等未来日期。baseline 保留 A 原始日期选项逻辑，便于直接对照。
- 复测曾发现推荐事件详情从比较来源进入时仍暴露来源 `eventLimit()` 之后的日期选项（FAIL）；已收紧为 `Math.min(state.v, state.m, eventLimit())`，使事件投影选择器只列到当前事件日及其合同边界，baseline 仍保持原 A 逻辑。
- A54 导航样板（200 导航项）本轮未实现，记录为范围缺口；本交付不将完整 A54 规格标记为通过。

## 验证

最终 `index.html` SHA256：`3520318c2d366988de0540928501122f3bce8ea884a6a4e3955e3bef72613071`。

| 门槛 | 结果 | 证据 |
| --- | --- | --- |
| 源 JS 语法 | PASS | `node --check /tmp/workbench-inline.js` |
| `layout-audit.js` 语法 | PASS | `node --check public/design-system-20261008/workbench/layout-audit.js` |
| 推荐日期选项截止逻辑 | PASS（静态） | `replayOptionLimit()` 按 observe/results/compare/event 分支过滤；baseline 分支返回原 A 上限 |
| 推荐控件权重与 disabled 级联 | PASS（静态） | 推荐 CSS 明确 `button/select/input` 字级/行高/权重，primary normal/hover/active 均带 `:enabled`，disabled 规则置于推荐块末尾 |
| 文件范围 | PASS | 仅新增 `public/design-system-20261008/workbench/**` 与本报告；未改原 `.scratch` 策略 A 或 app 代码 |
| 真实浏览器功能 / 图表回放 | NOT VERIFIED | 按任务边界交由 root 使用 3069 服务验收；本报告不把静态检查当浏览器证据 |
| 独立视觉对照 | NOT VERIFIED | 待 design_audit/root 直接比较 1440×900、1280×800 及窄屏渲染图 |
| 生产持久化 / 物理触屏 / IME | NOT APPLICABLE / NOT VERIFIED | 本次只复制可逆内存样板；生产数据库未触碰，物理触屏和 IME 由协调者按覆盖契约记录 |

## 启动与入口

样板由项目现有静态服务提供。入口为 `/design-system-20261008/workbench/index.html`；推荐模式默认加载，baseline 可用 `/design-system-20261008/workbench/index.html?appearance=baseline`。`scenario=running` 等场景查询参数沿用源 A。浏览器启动、截图和整页接受由 root 按当前任务服务与验收记录完成。
