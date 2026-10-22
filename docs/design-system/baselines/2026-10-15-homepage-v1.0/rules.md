# TradeReview 首页 v1.0 图文规则

## 基线与证据边界

本规则以当前 `master` 的 `7a5d137da3dcdf0f133a29714ee269693746472b` 为唯一实现基线。本附录为源码核查，浏览器补证见 `evidence/acceptance.md`。

- **S（source verified）**：当前源码可直接核对，引用文件和行号。
- **B（browser not verified）**：浏览器、真实数据、DOM/AX、鼠标、键盘、触摸、持久化和 computed style 的补证见 `evidence/acceptance.md`；本附录不把源码证据升级为浏览器通过。
- CSS 取最终级联：同一选择器由后出现的规则覆盖早期规则；媒体查询按视口和指针条件叠加。本文记录最终有效值，不把旧稿或未合并候选当成基线。

## 编号规则

### R01 页面骨架

- **前置状态**：进入交易室首页，范围初始化成功。
- **动作**：首次渲染。
- **预期**：依次出现 `我的交易室` 页头、收起的共享筛选条、`持仓照看`工作区、`历史交易与复盘`工作区；页头副标题为“持仓照看 · 复盘总结 · 持续进化”。
- **来源**：S — `app/components/dashboard/review-dashboard.tsx:1138-1370`；B — 首屏顺序和可见高度未实测。

### R02 默认范围与页头范围控件

- **前置状态**：无保存范围。
- **动作**：首次进入或点击范围控件。
- **预期**：默认实盘、全部市场、全部资产、今年至今；性质支持实盘/模拟盘/来源未知，账户支持全部/单账户，模拟盘显示运行选择，计价支持原币/HKD/CNY。
- **来源**：S — `app/lib/reviews/trading-room-scope.ts:219-231`、`review-dashboard.tsx:1075-1116`；B — 控件可达性、联动和选中样式未验证。

### R03 全局搜索与工具

- **前置状态**：搜索为空，通知与账户菜单关闭。
- **动作**：输入标的、选择结果、打开通知或账户菜单，按 Esc 或点击外部关闭。
- **预期**：搜索显示加载/错误/空结果/listbox 状态；通知 badge 与待处理事项可见；弹层关闭不改变共享范围。
- **来源**：S — `trading-room-global-tools.tsx`、`trading-room-global-tools.module.css:1`；B — 键盘、外点关闭和真实结果未验证。

### R04 共享筛选条

- **前置状态**：筛选条收起。
- **动作**：点击“筛选”；选择市场分类、资产类型、标的、账户、币种、复盘状态或模拟运行；清除附加筛选或恢复默认。
- **预期**：`aria-expanded` 切换；附加筛选生成 chip；“清除附加筛选”不改性质；恢复默认回到默认 scope；无效日期以 `role=alert` 呈现。
- **来源**：S — `review-dashboard.tsx:1148-1186`、`trading-room-scope.ts:219-231`、`review-dashboard.module.css:1328-1360`；B — 操作链和 AX 未验证。

### R05 持仓照看总览

- **前置状态**：有权限且范围不是未选择的模拟运行。
- **动作**：查看当前时点与汇总卡。
- **预期**：显示“关注当前仓位，回看历史持仓变化”、当前时点、持仓概览；模拟盘未选运行时显示独立运行提示，不能跨运行合并。
- **来源**：S — `review-dashboard.tsx:1188-1260`、`room-portfolio-summary.tsx`；B — 真实数值、空态和权限分支未验证。

### R06 历史持仓曲线

- **前置状态**：持仓历史可计算，默认指标 `marketValue`、粒度 `day`。
- **动作**：切换市值/未实现盈亏/收益率、日/周/月；点击 SVG 选点，打开或关闭日期详情；编辑观察期并应用或取消。
- **预期**：曲线、tooltip、日期详情与选中日期同步；未来日期不伪造数据；无效期间显示错误并允许重试。
- **来源**：S — `room-holdings-history.tsx:187-285`、`room-holdings-history.module.css:1-101,154-163`；B — 点选和重算未验证。

### R07 当前持仓资产分布

- **前置状态**：当前持仓可用；默认分布维度为按市场。
- **动作**：在“按市场/按资产类型”间切换；多原币时切换币种；展开现金基准或分组原因。
- **预期**：标题为“资产分布（持仓市值）”；按钮使用 `aria-pressed`；分布图、图例、覆盖时间、现金条和缺失原因同步；空数据、FX 缺失、不可用保留原因。
- **来源**：S — `room-allocation.tsx:22-24,195-209,241-267`、`room-allocation.module.css:1-63,111-176`。`min-width:821px`：panel `padding:7px 8px`、圆角 9px；标题 13px；按钮最小高 36px、圆角 5px、字体 14px；分布两列、gap 6px；图表最小高 150px。`max-width:760px` 改为两列较窄布局，`max-width:460px` 改为单列。B — 实际渲染比例与切换未验证。

### R08 当前持仓表

- **前置状态**：持仓列表加载完成，默认排序最近成交、页 1、搜索为空。
- **动作**：输入搜索、切换排序、导出 CSV、展开行详情、核对证据、重试行情、打开图表记录、翻页。
- **预期**：搜索重置到第 1 页；空筛选禁用导出；不可比较币种时浮盈亏排序禁用并解释；每页 5 行；重试中按钮禁用并显示状态。
- **来源**：S — `room-holdings.tsx:344-361,431-453`、`room-holdings.module.css:1-117,222-260`；`min-width:1121px`（含 1440）：基础面板 padding 14px、标题 h2 18px、圆角 12px、行高 48px；`min-width:821px and max-width:1120px`：后置紧凑覆盖为 padding `7px 9px`、标题 h2 17px、表格字号约 10–11px、行高 48px；`max-width:820px` 表格允许横向滚动（min-width 930px）。B — 表格滚动、导出和行级旅程未验证。

### R09 历史统计期间与摘要

- **前置状态**：历史范围为 YTD，统计未编辑。
- **动作**：选择近 3 月/今年/全部，自定义起止日期并应用、取消或选择全部历史；进入交易库；打开口径说明。
- **预期**：四张摘要卡显示已平仓回合净盈亏、完整回合数、合计胜率、待复盘；统计按平仓日期、已扣费用、不含浮盈亏；进入交易库携带关闭日期、复盘状态和 source snapshot。
- **来源**：S — `review-dashboard.tsx:1262-1345`、`review-dashboard.module.css:1492-1578`；`min-width:821px`：卡片最小高 76px、数值 18px、三列详情 gap 6–7px；窄屏规则另按 `max-width:759px`、`max-width:720px` 覆盖。B — 日期应用、导航和统计口径未验证。

### R10 收益趋势

- **前置状态**：历史区存在趋势数据，默认视图 `trend`、指标 P&L。
- **动作**：切换趋势层级、点击曲线点、选择重合候选、展开趋势数据详情。
- **预期**：SVG 点可命中；键盘 Enter/Space 与鼠标选择相同；重合点显示候选；正/负/零/不可用状态使用对应颜色并保留原因。
- **来源**：S — `room-performance.tsx:451-467,650-850`、`room-performance.module.css:45-118`；`min-width:821px` 的首页嵌入规则 chartStage 高 220px、chartFrame padding 6px、圆角 12px，趋势按钮高 36px/字体 14px；`max-width:620px` chartStage 高 240px。B — 图形命中、键盘和真实点数据未验证。

### R11 盈亏日历

- **前置状态**：日历默认统计期间 `endDate` 所在月并 clamp 到可用范围；默认 YTD 时为当前月，无选中日期。
- **动作**：切换月/年/全部年份，翻页，点击日期，沿范围路径返回。
- **预期**：未来单元格 disabled/低显著；无样本、范围外、不可用、排除和可信状态有独立表达；日期详情显示汇总、交易行和“打开复盘”。
- **来源**：S — `room-performance.tsx:855-916`、`room-performance.module.css:119-163,220-300`、`trading-room-time.ts:140`；`min-width:821px` 首页日历单元格高 34px、圆角 5px、padding `2px 3px`、字号 8–9px，日历容器 padding 6px；`max-width:620px` chartStage 高 240px且日历回到窄屏布局。B — 翻页、未来禁用和详情导航未验证。

### R12 贡献分解

- **前置状态**：历史样本存在，贡献维度默认市场。
- **动作**：切换市场/标的/账户；查看原币、折算值和 FX 说明。
- **预期**：贡献列表、正负条和样本覆盖说明同步；无可信样本、FX 不可用时显示解释，不转成 0。
- **来源**：S — `room-contribution.tsx:43-67`、`room-contribution.module.css:1-47`；`min-width:821px` panel padding `7px 8px`、标题 13px、按钮高 23px、正文 9–10px、条高 5px；`max-width:759px` 或 coarse 按钮至少 44px。B — 维度切换和金额状态未验证。

### R13 待复盘列表

- **前置状态**：待复盘列表加载完成，默认第 1 页，每页 3 条。
- **动作**：查看全部待复盘、开始复盘、翻页、展开价格详情。
- **预期**：按最近平仓日期列出；空列表有明确文案；页码当前项有 `aria-current`；开始复盘带入对应交易。
- **来源**：S — `room-pending-reviews.tsx:98,123-155`、`room-pending-reviews.module.css:1-25,45-75`；最终桌面 panel padding `8px 9px`（821–1120）或基础 14px、按钮 36px、圆角 6px、表格 10.5–12px；B — 导航和分页未验证。

### R14 可信度、未知值与错误

- **前置状态**：数据可能部分覆盖、缺 FX、未知资产、未来、无样本或请求失败。
- **动作**：阅读页面、展开诊断 details、重试。
- **预期**：保留“不可用”“暂无样本”“范围外”“数据不足”“多币种无法合计”“现金数据加载中…”“现金数据读取失败”“现金数据暂不可用”等原意；未知值不替换成 0，浮盈亏与已平仓净盈亏不混淆。
- **来源**：S — `review-dashboard.tsx`、`room-allocation.tsx`、`room-holdings.tsx`、`room-performance.tsx`；B — 每个后端错误分支和文案显现未验证。

### R15 响应式与命中区

- **前置状态**：视口分别为 1440、1280、1055/1054、820/821、760/759、390、320；或启用 coarse pointer。
- **动作**：重排页面并操作关键控件。
- **预期**：`max-width:1054px` 持仓总览单列；`max-width:759px` 根 padding `0 16px 30px`、页头工具满宽、工作区 padding 10px；工作区纵向由 `max-width:720px` 触发；`max-width:320px` 根 padding 12px；粗指针/窄屏主要控件至少 44px。分布在 460 以下变为单列，持仓表在 820 以下允许横向滚动。
- **来源**：S — `review-dashboard.module.css:1403-1446,1589-1591`、`room-allocation.module.css:65-110`、`room-holdings.module.css:118-221`、各模块 coarse 媒体查询；B — 所有断点、触摸与横向滚动未验证。

### R16 接受状态

- **前置状态**：本规则文档生成完成。
- **动作**：根代理进行独立首页验收。
- **预期**：源码规则可作为图文基线；浏览器截图、DOM/AX、鼠标、键盘、触摸、真实数据、持久化和 computed style 必须另行补证，未补证前保持 `NOT VERIFIED`。
- **来源**：S — 本文各条源码引用、`DESIGN-COVERAGE.md` 和前端控制审计标准；B — 浏览器补证见 `evidence/acceptance.md`。

## 最终级联索引

| 组件 | 最终关键值（当前源码） | 级联来源 |
| --- | --- | --- |
| 页面壳层 | 基础根 padding `0 24px 34px`、workspace margin-top 16px/padding 12px/圆角 9px；`min-width:821px` 桌面主题正文 `#edf5ff`、辅助 `#9ab0ca`、card `#101d31`；`max-width:759px` 根 padding `0 16px 30px`；`max-width:320px` 根 padding 12px；`max-width:759px` 后置规则使workspace padding 10px（覆盖早期720规则） | `review-dashboard.module.css:1262-1377,1411-1427,1462-1578` |
| 全局工具 | 基础搜索 36px、圆角 6px、字体 14px；图标按钮 36px；头像 27px；面板圆角 11px；`max-width:759px` 工具和输入至少 44px | `trading-room-global-tools.module.css:1` 及其媒体查询 |
| 资产分布 | `min-width:821px` panel padding `7px 8px`、圆角 9px；标题 13px；分布按钮高 36px/圆角 5px/字体 14px；分布 gap 6px；图表最小高 150px；`max-width:460px` 单列 | `room-allocation.module.css:1-63,65-110,111-176` |
| 持仓历史 | `min-width:821px` panel padding `8px 9px 7px`、标题 13px；控件高 36px、圆角 6px、字体 14px；嵌入首页 chart 高 220px；`max-width:700px` 或 coarse 控件至少 44px | `room-holdings-history.module.css:1-101,154-163` |
| 当前持仓 | `min-width:1121px`（含 1440）基础 panel padding 14px、标题 h2 18px、圆角 12px、行高 48px；`821px–1120px` 后置 compact padding `7px 9px`、标题 17px；`max-width:820px` 表格 min-width 930px | `room-holdings.module.css:1-117,118-221` |
| 收益趋势与日历 | `min-width:821px` 嵌入首页 chartFrame padding 6px、圆角 12px、chartStage 220px；同断点日历 cell 34px、圆角 5px、字号 8–9px；基础趋势按钮高 36px、圆角 8px、字体 14px | `room-performance.module.css:45-163,220-300` |
| 贡献分解 | `min-width:821px` panel padding `7px 8px`；标题 13px；按钮高 23px；最终正文 9–10px；条高 5px；`max-width:759px` 或 coarse 按钮至少 44px | `room-contribution.module.css:1-47` |
| 待复盘 | 基础 panel padding 14px、圆角 12px；`min-width:821px and max-width:1120px` padding `8px 9px`；按钮高 36px、圆角 6px；coarse 或 `max-width:620px` 按钮高 44px | `room-pending-reviews.module.css:1-25,45-75` |

历史候选 `4ca2`、`0ff3` 及旧稿只作为差异背景，不能覆盖以上当前 master 值。
