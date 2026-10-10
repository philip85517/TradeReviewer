# Recall 视觉样板实现记录

状态：推荐态 CSS 已按 root 的 S0-1440 截图反馈收敛；窄屏视觉验收仍 **NOT VERIFIED**。

## 范围

本 bounded 任务只修改：

- `app/components/design-prototype/recall-design-prototype.css`
- 本报告

本 CSS bounded task 未修改 RecallWorkspace 的 TS/TSX、生产 `recall.css`、业务数据和原始 chart-first 资料；推荐态使用现有 `data-design-prototype="recommended"` 作用域。baseline 不继承推荐工作区的角色字号、token、focus、图表字体或响应式规则。

## 实现证据

- 推荐 role scale 为工作区标题 18/24/600、分区 16/24/600、正文 14/22、控件 13/20/500、辅助信息 12/18；桌面控件 36px，900px 及以下为 44px。
- 推荐颜色 token 提供 page/surface/elevated、文字层级、`#2469c8` / `#2b72d3` / `#205bac` 主按钮三态、`#8cbdff` focus 与 `#58708f` 必要边界；原有 P&L 变量未重定义。
- 回放控制中当前“下一笔决策”按第四个直接按钮提供唯一实心 primary normal/hover/active；留存快照及其余带 `primary` class 的分支回落为次要控件；下一笔决策 disabled 规则置于最后并明确取消蓝底。
- 外层 intro 改为 eyebrow 与标题同行，桌面上下 padding 6px；storage note 收紧为单行 18px 内容区。窄屏仍保留操作按钮与说明内容的自然布局。
- 推荐 SVG 图标为 18px、stroke-width 1.75；图表 stage/canvas DOM 节点显式使用中文 fallback 字体链。
- 新增的 `.recall-stage-context[data-design-prototype="recommended"]` 使用 12/18/400 元数据样式，把阶段、行情可知截止和成交截止保持在 chart column 顶部同一 status 行；其内容由 recallagent 的真实 TSX 状态合同提供。
- 删除样板自身的 640px chart-and-plan 最低高度和 340px / 34vw 计划栏限制；900px 以下以现有结构自然下移计划栏，未新增固定复盘栏比例。
- 窄屏首轮证据（root `recall-first-390-fail.jpg`、`recall-final-900.jpg` 及 computed 记录）先记为 **FAIL**：生产 container 规则将推荐态 chart 压成 220px，展开多行原文与 OHLC 重叠，计划栏约 90px 且末段文字不可达；390px 页面虽未增大 scrollWidth，但 workspace 的 fixed height/clip 仍把主区截在视口内。
- 本轮修复仅在推荐态 `@media (max-width:900px)`：workspace/layout/main 改为自然块流，chart-and-plan 改为 chart 后计划的纵向 intrinsic flow；chart floor 校准为 480px，计划侧栏取消 max-height/内部滚动并由页面继续滚动，回放 cutoff/card 文本允许自然换行。`@media (max-width:600px)` 将 chart floor 校准为 720px，为 390px 多行图文与阶段说明保留可读空间；工具行保留内部横向可达和 44px 控件，不宣称物理触控验收。
- 随后 1280×900 实测仍记为 **FAIL**：主区约 1060px，虽 viewport 大于 900 仍命中生产 `recall-work(max-width:1105px)`，chart-shell/chart-stage 回到 220px，原判断末行裁切并与 OHLC 叠加。本轮将同一推荐态自然流边界扩展到 `@media (max-width:1330px)`；1440px 主区约 1220px 不命中，仍保留桌面布局。该 1280 repair 的截图与 plan 完整可达性继续由 root 复核。
- 推荐态保留本地行情入口的完整“本地数据”文案：在生产 toolbar 将其压缩为 `font-size:0` 后，样板恢复为不收缩的 90px 宽度（≤900px 为 44px 高），仍在工具行内部横向可达。
- 计划价格的原生 hit button 继续保留 aria-label、title、pointer/keyboard 行为；样板将其移到右侧金色 canvas 价格标签附近（`right:36px`、112px hit 区），仅把重复的按钮文本设为透明并保留 focus ring。此为推荐态的候选交互例外：避免 HTML 重复白字穿过 canvas 正文，同时不隐藏价格标签或移除控件；点击位置与多条计划线的实际对齐仍待 root 浏览器复核。
- 独立 390px 语义复核先记为 **FAIL**：展开完整文字后 canvas 轴侧成本/计划名称不可区分，两个 56.00 缺少计划/实际语义。样板修复为默认隐藏的 `.recall-prototype-price-roles`；≤600px 在 chart context 下以普通流显示完整计划与实际值，分别使用金色/ muted 行、12/18 字号、可换行、无固定高和省略号，不覆盖 canvas。该节点由 prototype seam 提供，桌面/900px 不增加可见 band。
- 1440px fit/focus 旅程的旧 `ad14a9...` 证据先记为 **FAIL**：推荐 chart shell `clientHeight=696`、`scrollHeight=724`、`overflow:hidden`、`scrollTop=28`，阶段 context 与底轴在 focus scroll 后被裁；修复为 ≥1331px 推荐态 chart column flex column，context 不收缩，chart-stage 使用 `flex:1 1 0; height:auto; min-height:0`，让 ReplayChart ResizeObserver 获得 shell 剩余高度。root 随后独立复验“适应全部→Tab到价格→点击止损定位”时阶段、轴和底部可见；文字编辑焦点全旅程未验证；本报告保留该历史 FAIL 作为修复前证据。
- 新一轮 390px 操作证据先记为 **FAIL**：回放 controls 仍是横向滚动，初始静止视口裁掉“下一笔决策”；此前自动 `scrollIntoView` 后的点击只能证明动作可达，不能证明静止可辨。本轮推荐态 ≤600px 改为 controls 正常 `flex-wrap` 多行、`overflow:visible`，保持原 DOM/Tab 顺序和全部控件；仅回放 controls 改为完整操作优先，header chart toolbar 继续独立横向滚动。
- 修复后的 900/390/1280 截图、canvas 实际字体、键盘 focus 与 overflow 仍由 root 独立验收；在其证据到达前保持 **NOT VERIFIED**，不把 CSS source 修复称作浏览器通过。

## Canvas 字体限制

当前 lightweight-charts 与 DrawingCanvas 的实际绘制字体由 TS/TSX 内的 Canvas/API 调用设置；本 bounded CSS 任务不能注入 `fontFamily/fontSize`。因此截图中 Canvas 正文若呈现为 600 字重，需由 recallagent 在其源实现中改为推荐正文 14/22/400。本报告不把 CSS DOM 字体链当作 Canvas API 已验证证据。

## 验证

已运行：

```sh
node - <<'NODE'
const fs = require('fs');
const postcss = require('postcss');
const path = 'app/components/design-prototype/recall-design-prototype.css';
const source = fs.readFileSync(path, 'utf8');
postcss.parse(source, { from: path });
console.log(`CSS parse OK: ${source.split(/\n/).length} lines`);
NODE
```

另检查目标 CSS 已不含 `640px`、`340px`、`34vw` chart-first 限制。root 已完成 S0-1440 截图审阅；900/390、实际字体 glyph、Canvas 绘制字体、键盘 focus 和 overflow 仍待独立浏览器证据，保持 NOT VERIFIED。
